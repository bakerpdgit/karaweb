import crypto from "crypto";
import { app, Datastore } from "codehooks-js";

const COLLECTION = "submissions";
const CHALLENGE_COLLECTION = "teacher_challenges";
const SESSION_COLLECTION = "teacher_sessions";
const MAX_PAYLOAD_CHARS = 200 * 1024;
const MAX_TURNSTILE_CHARS = 2048;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const SUBMISSION_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const RESULT_FILE_FORMAT = "unitester-result-hybrid-v1";
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

app.auth("/api/public/*", (req, res, next) => {
  next();
});

app.get("/api/public/health", (req, res) => {
  if (!prepareRequest(req, res)) {
    return;
  }
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/public/teacher/challenge", async (req, res) => {
  if (!prepareRequest(req, res)) {
    return;
  }

  try {
    const challengeId = crypto.randomUUID();
    const nonce = randomToken(32);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
    const conn = await Datastore.open();

    await conn.insertOne(CHALLENGE_COLLECTION, {
      challengeId,
      nonceHash: sha256(nonce),
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    });

    const encryptedChallenge = encryptPayloadWithTeacherPublicKey({
      version: 1,
      type: "unitester-teacher-challenge",
      challengeId,
      nonce,
      expiresAt,
    });

    res.json({
      success: true,
      challengeId,
      encryptedChallenge,
      expiresAt,
    });
  } catch (error) {
    console.error("Teacher challenge failed", error);
    res.status(500).json({ error: "Failed to create teacher challenge" });
  }
});

app.post("/api/public/teacher/session", async (req, res) => {
  if (!prepareRequest(req, res)) {
    return;
  }

  try {
    const body = req.body || {};
    const challengeId = String(body.challengeId || "");
    const nonce = String(body.nonce || "");
    if (!GUID_PATTERN.test(challengeId) || !nonce) {
      res.status(400).json({ error: "Invalid teacher challenge response" });
      return;
    }

    const conn = await Datastore.open();
    const challenge = await conn.findOneOrNull(CHALLENGE_COLLECTION, {
      challengeId,
    });
    if (!challenge || challenge.used || isExpired(challenge.expiresAt)) {
      res.status(403).json({ error: "Teacher challenge expired" });
      return;
    }
    if (challenge.nonceHash !== sha256(nonce)) {
      res.status(403).json({ error: "Teacher challenge failed" });
      return;
    }

    await conn.updateOne(
      CHALLENGE_COLLECTION,
      { challengeId },
      {
        used: true,
        usedAt: new Date().toISOString(),
      },
    );

    const sessionToken = randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await conn.insertOne(SESSION_COLLECTION, {
      tokenHash: sha256(sessionToken),
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      sessionToken,
      expiresAt,
    });
  } catch (error) {
    console.error("Teacher session failed", error);
    res.status(500).json({ error: "Failed to create teacher session" });
  }
});

app.post("/api/public/submissions", async (req, res) => {
  if (!prepareRequest(req, res)) {
    return;
  }

  try {
    const body = req.body || {};
    if (String(body.b_phone_number || "").trim()) {
      res.status(400).json({ error: "Submission rejected" });
      return;
    }

    const validationError = validateSubmissionBody(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const turnstile = await verifyTurnstile(body.turnstileToken);
    if (!turnstile.success) {
      res.status(403).json({ error: "Turnstile verification failed" });
      return;
    }

    const conn = await Datastore.open();
    const existing = await conn.findOneOrNull(COLLECTION, {
      submissionGuid: body.submissionGuid,
    });
    if (existing) {
      res.status(409).json({ error: "Duplicate submissionGuid" });
      return;
    }

    const now = new Date().toISOString();
    const record = {
      schemaVersion: 2,
      testId: body.testId,
      submissionGuid: body.submissionGuid,
      submittedAt: body.submittedAt,
      receivedAt: now,
      teacherPayload: body.teacherPayload,
      reviewPayload: body.reviewPayload,
    };
    const inserted = await conn.insertOne(COLLECTION, record);

    res.json({
      success: true,
      id: inserted._id,
      testId: record.testId,
      submissionGuid: record.submissionGuid,
      receivedAt: record.receivedAt,
    });
  } catch (error) {
    console.error("Submission failed", error);
    res.status(500).json({ error: "Failed to process submission" });
  }
});

app.get("/api/public/submissions/:submissionGuid", async (req, res) => {
  if (!prepareRequest(req, res)) {
    return;
  }

  const { submissionGuid } = req.params;
  if (!GUID_PATTERN.test(String(submissionGuid || ""))) {
    res.status(400).json({ error: "Invalid submissionGuid" });
    return;
  }

  const conn = await Datastore.open();
  const record = await conn.findOneOrNull(COLLECTION, { submissionGuid });
  if (!record) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  res.json({
    success: true,
    submission: publicReviewRecord(record),
  });
});

app.get("/api/public/teacher/submissions/:testId", async (req, res) => {
  if (!prepareRequest(req, res)) {
    return;
  }

  if (!(await hasValidTeacherSession(req))) {
    res.status(401).json({ error: "Teacher session required" });
    return;
  }

  const { testId } = req.params;
  if (!TEST_ID_PATTERN.test(String(testId || ""))) {
    res.status(400).json({ error: "Invalid testId" });
    return;
  }

  const conn = await Datastore.open();
  const cleanup = await runTeacherFetchHousekeeping(conn);
  const records = await conn
    .getMany(
      COLLECTION,
      { testId },
      {
        sort: { submittedAt: 1 },
        limit: 1000,
      },
    )
    .toArray();

  res.json({
    success: true,
    testId,
    cleanup,
    submissions: records.map(teacherRecord),
  });
});

app.delete("/api/public/teacher/submissions/:submissionGuid", async (req, res) => {
  if (!prepareRequest(req, res)) {
    return;
  }

  if (!(await hasValidTeacherSession(req))) {
    res.status(401).json({ error: "Teacher session required" });
    return;
  }

  const { submissionGuid } = req.params;
  if (!GUID_PATTERN.test(String(submissionGuid || ""))) {
    res.status(400).json({ error: "Invalid submissionGuid" });
    return;
  }

  const conn = await Datastore.open();
  const existing = await conn.findOneOrNull(COLLECTION, { submissionGuid });
  if (!existing) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  await conn.removeOne(COLLECTION, { submissionGuid });
  res.json({
    success: true,
    submissionGuid,
  });
});

app.all("/*", (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(req)) {
      res.status(403).end();
      return;
    }
    res.status(204).end();
    return;
  }
  res.status(404).json({ error: "Not found" });
});

function prepareRequest(req, res) {
  applyCors(req, res);
  if (!isOriginAllowed(req)) {
    res.status(403).json({ error: "Origin not allowed" });
    return false;
  }
  return true;
}

function allowedOrigins() {
  return String(
    process.env.ALLOWED_ORIGINS || "https://unitest.classinteractives.co.uk",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function originFromReferer(value) {
  if (!value) {
    return "";
  }
  try {
    return new URL(value).origin;
  } catch (error) {
    return "";
  }
}

function requestOrigin(req) {
  return (
    req.headers.origin ||
    originFromReferer(req.headers.referer || req.headers.referrer)
  );
}

function localChecksDisabled() {
  return String(process.env.DISABLE_ORIGIN_CHECKS || "").toLowerCase() === "true";
}

function isOriginAllowed(req) {
  if (localChecksDisabled()) {
    return true;
  }
  const origin = requestOrigin(req);
  if (!origin) {
    return false;
  }
  return allowedOrigins().includes(origin);
}

function applyCors(req, res) {
  const origin = requestOrigin(req);
  const origins = allowedOrigins();
  const corsOrigin =
    (origin && (localChecksDisabled() || origins.includes(origin)) && origin) ||
    origins[0] ||
    "";

  if (corsOrigin) {
    res.set("Access-Control-Allow-Origin", corsOrigin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.set("Access-Control-Max-Age", "86400");
}

function validateSubmissionBody(body) {
  if (Number(body.schemaVersion) !== 2) {
    return "Invalid schemaVersion";
  }
  if (!TEST_ID_PATTERN.test(String(body.testId || ""))) {
    return "Invalid testId";
  }
  if (!GUID_PATTERN.test(String(body.submissionGuid || ""))) {
    return "Invalid submissionGuid";
  }
  if (!validRecentTimestamp(body.submittedAt)) {
    return "Invalid submittedAt";
  }
  if (!validEncryptedPayload(body.teacherPayload)) {
    return "Invalid teacherPayload";
  }
  if (!validReviewPayload(body.reviewPayload)) {
    return "Invalid reviewPayload";
  }
  if (String(body.turnstileToken || "").length > MAX_TURNSTILE_CHARS) {
    return "Invalid turnstileToken";
  }
  return "";
}

function validRecentTimestamp(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return false;
  }
  const diff = Math.abs(Date.now() - time);
  return diff <= 30 * 60 * 1000;
}

function validEncryptedPayload(value) {
  return typeof value === "string" && value.length > 20 && value.length <= MAX_PAYLOAD_CHARS;
}

function validReviewPayload(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value.format !== "unitester-review-aes-gcm-v1") {
    return false;
  }
  return (
    validCompactBase64(value.iv, 64) &&
    validCompactBase64(value.ciphertext, MAX_PAYLOAD_CHARS)
  );
}

function validCompactBase64(value, maxLength) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

async function verifyTurnstile(token) {
  if (String(process.env.TURNSTILE_REQUIRED || "true").toLowerCase() === "false") {
    return { success: true, skipped: true };
  }
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: false, error: "missing-secret" };
  }
  if (!token || typeof token !== "string" || token.length > MAX_TURNSTILE_CHARS) {
    return { success: false, error: "missing-token" };
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        response: token,
      }),
    },
  );
  if (!response.ok) {
    return { success: false, error: "siteverify-http-" + response.status };
  }
  return response.json();
}

async function hasValidTeacherSession(req) {
  const authorization = String(req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }
  const conn = await Datastore.open();
  const session = await conn.findOneOrNull(SESSION_COLLECTION, {
    tokenHash: sha256(match[1]),
  });
  return Boolean(session && !isExpired(session.expiresAt));
}

async function runTeacherFetchHousekeeping(conn) {
  const now = new Date();
  const submissionCutoff = new Date(now.getTime() - SUBMISSION_RETENTION_MS).toISOString();
  const expiredCutoff = now.toISOString();

  return {
    retentionDays: Math.floor(SUBMISSION_RETENTION_MS / (24 * 60 * 60 * 1000)),
    removedSubmissions: await safeRemoveMany(conn, COLLECTION, {
      receivedAt: { $lt: submissionCutoff },
    }),
    removedExpiredChallenges: await safeRemoveMany(conn, CHALLENGE_COLLECTION, {
      expiresAt: { $lt: expiredCutoff },
    }),
    removedExpiredSessions: await safeRemoveMany(conn, SESSION_COLLECTION, {
      expiresAt: { $lt: expiredCutoff },
    }),
  };
}

async function safeRemoveMany(conn, collection, query) {
  try {
    const result = await conn.removeMany(collection, query);
    return removeCount(result);
  } catch (error) {
    console.warn("Housekeeping failed for " + collection, error);
    return null;
  }
}

function removeCount(result) {
  if (!result || typeof result !== "object") {
    return 0;
  }
  return (
    Number(result.deletedCount) ||
    Number(result.removedCount) ||
    Number(result.count) ||
    Number(result.removed) ||
    0
  );
}

function isExpired(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) || time <= Date.now();
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function teacherPublicKeyJwk() {
  const encoded = process.env.TEACHER_PUBLIC_KEY_B64;
  if (!encoded) {
    throw new Error("TEACHER_PUBLIC_KEY_B64 is not configured");
  }
  const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const publicKeyJwk = parsed.publicKeyJwk || parsed.publicKey || parsed.keys?.publicKeyJwk || (parsed.kty === "RSA" ? parsed : null);
  if (!publicKeyJwk || publicKeyJwk.kty !== "RSA") {
    throw new Error("TEACHER_PUBLIC_KEY_B64 does not contain an RSA public key");
  }
  return publicKeyJwk;
}

function encryptPayloadWithTeacherPublicKey(payload) {
  const aesKey = crypto.randomBytes(32);
  const encryptedKey = rsaOaepEncrypt(aesKey, teacherPublicKeyJwk());
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const envelope = {
    format: RESULT_FILE_FORMAT,
    algorithm: "RSA-OAEP-256+A256GCM",
    encryptedKey: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return "Unitester Teacher Challenge\n" + JSON.stringify(envelope);
}

function rsaOaepEncrypt(message, jwk) {
  const n = base64UrlToBuffer(jwk.n);
  const e = base64UrlToBuffer(jwk.e);
  const k = n.length;
  const hLen = 32;
  if (message.length > k - 2 * hLen - 2) {
    throw new Error("Message too long for RSA-OAEP");
  }

  const lHash = crypto.createHash("sha256").update(Buffer.alloc(0)).digest();
  const ps = Buffer.alloc(k - message.length - 2 * hLen - 2);
  const db = Buffer.concat([lHash, ps, Buffer.from([0x01]), message]);
  const seed = crypto.randomBytes(hLen);
  const maskedDb = xorBuffers(db, mgf1(seed, k - hLen - 1));
  const maskedSeed = xorBuffers(seed, mgf1(maskedDb, hLen));
  const encoded = Buffer.concat([Buffer.from([0x00]), maskedSeed, maskedDb]);

  const encrypted = modPow(bufferToBigInt(encoded), bufferToBigInt(e), bufferToBigInt(n));
  return bigIntToBuffer(encrypted, k);
}

function mgf1(seed, length) {
  const chunks = [];
  let counter = 0;
  while (Buffer.concat(chunks).length < length) {
    const c = Buffer.alloc(4);
    c.writeUInt32BE(counter, 0);
    chunks.push(crypto.createHash("sha256").update(seed).update(c).digest());
    counter += 1;
  }
  return Buffer.concat(chunks).subarray(0, length);
}

function xorBuffers(left, right) {
  const result = Buffer.alloc(left.length);
  for (let index = 0; index < left.length; index += 1) {
    result[index] = left[index] ^ right[index];
  }
  return result;
}

function base64UrlToBuffer(value) {
  let base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

function bufferToBigInt(buffer) {
  return BigInt("0x" + buffer.toString("hex"));
}

function bigIntToBuffer(value, length) {
  let hex = value.toString(16);
  if (hex.length % 2) {
    hex = "0" + hex;
  }
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length > length) {
    return bytes.subarray(bytes.length - length);
  }
  if (bytes.length === length) {
    return bytes;
  }
  return Buffer.concat([Buffer.alloc(length - bytes.length), bytes]);
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;
  while (power > 0n) {
    if (power & 1n) {
      result = (result * factor) % modulus;
    }
    factor = (factor * factor) % modulus;
    power >>= 1n;
  }
  return result;
}

function publicReviewRecord(record) {
  return {
    schemaVersion: record.schemaVersion,
    testId: record.testId,
    submissionGuid: record.submissionGuid,
    submittedAt: record.submittedAt,
    receivedAt: record.receivedAt,
    reviewPayload: record.reviewPayload,
  };
}

function teacherRecord(record) {
  return {
    _id: record._id,
    schemaVersion: record.schemaVersion,
    testId: record.testId,
    submissionGuid: record.submissionGuid,
    submittedAt: record.submittedAt,
    receivedAt: record.receivedAt,
    teacherPayload: record.teacherPayload,
  };
}

export default app.init();
