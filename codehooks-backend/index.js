// KaraWeb Cloud Save backend.
//
// Per-teacher (public-key-fingerprint) scoping — no per-class
// registration. The teacher's RSA public modulus IS the identity,
// so the same backend can serve any number of classes / books a
// teacher hands out, with results scoped purely by pubFingerprint
// (and optionally by challengeFileGuid).
//
// Collections:
//   pub_settings         { pubFingerprint, submissionVerifier (optional —
//                          base64 PBKDF2 of the teacher's keydetails
//                          password; trust-on-first-use), createdAt,
//                          updatedAt }
//                        — only exists when the teacher has password-
//                          protected their keydetails. Acts as a per-
//                          teacher record that /teacher/challenge
//                          consults to require a matching pwVerifier
//                          on subsequent calls.
//   results              { pubFingerprint, challengeFileGuid, studentCode,
//                          challengeGuid, count, firstAttemptPassed,
//                          latestPassed, encryptedPayload, submittedAt,
//                          receivedAt }
//                        — one row per (pubFingerprint, challengeFileGuid,
//                          studentCode, challengeGuid); subsequent
//                          submissions increment `count` and overwrite
//                          `latestPassed` + `encryptedPayload`.
//   teacher_challenges   { challengeId, pubFingerprint, nonceHash,
//                          expiresAt, used }
//   teacher_sessions     { tokenHash, pubFingerprint, expiresAt,
//                          createdAt }
//
// Student usernames + 6-digit codes are NOT stored on the backend.
// The teacher derives codes client-side from
// `sha256(publicKey.n + "|" + username)`, so codes a student types
// when logging in are validated locally against the publicKey already
// in the cloud-save block.

import crypto from "crypto";
import { app, Datastore } from "codehooks-js";

// ── Deployment defaults (edit if you fork) ──────────────────────────
// These bake in the production answers so a fresh Codehooks deploy
// works out of the box. Teachers following the in-app setup wizard
// never need to touch Codehooks env vars — these defaults cover the
// shipped KaraWeb deployment at karaweb.classinteractives.co.uk and
// route bot-protection through the maintainer's shared Cloudflare
// Worker (so no per-teacher Turnstile secret distribution).
//
// Optional MAINTAINER env-var overrides (set in Codehooks Studio →
// Settings → Environment variables) — only the maintainer typically
// needs these, e.g. for personal-dev / localhost testing:
//
//   ALLOWED_ORIGINS         comma-separated list of allowed Origin
//                           headers (default: the single live URL below)
//   DISABLE_ORIGIN_CHECKS   "true" to skip the allowlist (default false)
//   TURNSTILE_REQUIRED      "false" to skip bot verification entirely
//                           (default true — recommended for any live
//                           deployment)
//   TURNSTILE_VERIFY_URL    override the verification proxy URL
//                           (default points at the shared Worker)
//
// `TURNSTILE_SECRET_KEY` is NO LONGER read by this backend — the
// Worker proxy holds the only copy.
const DEFAULT_ALLOWED_ORIGINS = ["https://karaweb.classinteractives.co.uk"];
// Branded Worker Route on the classinteractives.co.uk Cloudflare
// zone — set up via cloudflare-worker/wrangler.toml's [[routes]]
// block. Override via the TURNSTILE_VERIFY_URL env var if running
// your own Worker.
const DEFAULT_TURNSTILE_VERIFY_URL =
  "https://karaweb.classinteractives.co.uk/api/verify-turnstile";
const DEFAULT_TURNSTILE_REQUIRED = true;
// ────────────────────────────────────────────────────────────────────

const PUB_SETTINGS_COLLECTION = "pub_settings";
const RESULTS_COLLECTION = "results";
const CHALLENGE_COLLECTION = "teacher_challenges";
const SESSION_COLLECTION = "teacher_sessions";
const RATE_LIMITS_COLLECTION = "rate_limits";

const MAX_PAYLOAD_CHARS = 14000; // matches Apps Script
const MAX_TURNSTILE_CHARS = 2048;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// ── App-level rate limits (edit if your school has different needs) ─
// All four caps are enforced server-side BEFORE a row is inserted /
// updated. On breach the backend returns HTTP 429 with one of:
//   cap_reached            — per-cell submission count exhausted
//   too_many_per_minute    — burst rate across all this teacher's students
//   too_many_new_students  — new-student introduction limit for today
//   too_many_new_challenges — this student tried too many distinct
//                            challenges today
// Counters are stored in the `rate_limits` collection, keyed by UTC
// date/minute, and pruned to a 7-day window during the same
// housekeeping pass that prunes long-term results.
//
// Set any cap to 0 to disable that single check; the others stay
// active. Adjust freely — these defaults assume a single teacher
// with up to ~10 normal-sized classes across one day.
const MAX_SUBMISSIONS_PER_CELL = 100;             // per (teacher, file, student, challenge)
const MAX_NEW_STUDENTS_PER_DAY = 250;             // new (never-seen) studentCodeHash per teacher per UTC day
const MAX_NEW_CHALLENGES_PER_STUDENT_PER_DAY = 50; // distinct new challenges this student hits per UTC day
const MAX_SUBMISSIONS_PER_MINUTE = 55;            // bursts across all students per teacher per rolling minute
// ────────────────────────────────────────────────────────────────────

// ── Data retention (edit me) ────────────────────────────────────────
// Submission rows older than this many days are removed automatically
// when YOU (the teacher) next fetch results in KaraWeb's Submissions
// tab. Set to 0 to keep rows forever (auto-deletion disabled).
//
// Why bother: if your keydetails file is ever lost or shared, anyone
// with it can decrypt every row in your collection — including
// historical ones. A shorter retention reduces that exposure window.
// 3 years (1095 days) is a sensible default for classroom use.
const RESULT_RETENTION_DAYS = 1095;
// ────────────────────────────────────────────────────────────────────
const RESULT_RETENTION_MS = RESULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Bare UUID v4 (used internally only — challengeId for teacher sessions).
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Checksummed GUID: "<uuid-36>-c<3 digits>". Used for the external
// challengeGuid + challengeFileGuid identifiers, with the FNV-1a
// checksum verified before storage.
const CHECKSUMMED_GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-c\d{3}$/i;
// 32 hex chars = first 128 bits of sha256(publicKey.n).
const PUB_FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/i;
const STUDENT_CODE_PATTERN = /^\d{6}$/;
// 16-hex (64-bit) sha256 prefix of (publicKey.n + "|" + studentCode).
// Stable per-(teacher, student) — used as the dedup key in place of
// the plaintext 6-digit code, so a backend breach reveals only
// pseudonyms.
const STUDENT_CODE_HASH_PATTERN = /^[0-9a-f]{16}$/i;

const ENVELOPE_HEADER = "KaraWeb Cloud Save";
const ENVELOPE_FORMAT = "karaweb-result-hybrid-v1";
const ENVELOPE_ALGO = "RSA-OAEP-256+A256GCM";
// RSA-4096 OAEP-wrapped 32-byte AES key → 512-byte ciphertext →
// base64 ≈ 684 chars. AES-GCM IV is always 12 bytes → base64 16 chars.
const ENV_KEY_MIN = 620;
const ENV_KEY_MAX = 750;
const ENV_IV_MIN = 14;
const ENV_IV_MAX = 32;

// Mark everything under /api/public/ as no-auth (we run our own
// CORS + per-class bearer-token checks). Use an explicit RegExp
// rather than a glob string so codehooks-js path matchers across
// versions reliably treat this as "any path with this prefix".
app.auth(/^\/api\/public\//, (req, res, next) => {
  next();
});

app.get("/api/public/health", (req, res) => {
  if (!prepareRequest(req, res)) return;
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Teacher challenge/response ──────────────────────────────────────────
// Caller supplies their full RSA public-key JWK. Server derives the
// pubFingerprint, encrypts a fresh nonce with the supplied key, and
// returns the envelope. Caller must decrypt the nonce with their
// matching private key to prove possession, then call /teacher/session.
//
// Optional pwVerifier flow (TOFU):
//   - If a `pub_settings` doc already exists for this pubFingerprint
//     with a non-empty submissionVerifier, the caller MUST supply a
//     matching `pwVerifier` in the body.
//   - If no doc exists and the caller supplies a `pwVerifier`, we
//     install it (trust on first use).
//   - If no doc exists and no `pwVerifier`, no enforcement (the
//     teacher's keydetails are un-passworded).
app.post("/api/public/teacher/challenge", async (req, res) => {
  if (!prepareRequest(req, res)) return;
  try {
    const body = req.body || {};
    const publicKeyJwk = body.publicKeyJwk;
    if (!isPublicKeyJwk(publicKeyJwk)) {
      res.status(400).json({ error: "Invalid publicKeyJwk" });
      return;
    }
    const pubFingerprint = await derivePubFingerprint(publicKeyJwk);
    const conn = await Datastore.open();
    const settings = await conn.findOneOrNull(PUB_SETTINGS_COLLECTION, {
      pubFingerprint,
    });
    const pwVerifier =
      typeof body.pwVerifier === "string" && body.pwVerifier.length > 0
        ? body.pwVerifier
        : "";
    if (settings && settings.submissionVerifier) {
      if (!pwVerifier) {
        res.status(401).json({ error: "pw_required" });
        return;
      }
      if (pwVerifier !== settings.submissionVerifier) {
        res.status(401).json({ error: "pw_mismatch" });
        return;
      }
    } else if (pwVerifier) {
      // TOFU install. Future challenges must match this verifier.
      const now = new Date().toISOString();
      if (settings) {
        await conn.updateOne(
          PUB_SETTINGS_COLLECTION,
          { pubFingerprint },
          { submissionVerifier: pwVerifier, updatedAt: now },
        );
      } else {
        await conn.insertOne(PUB_SETTINGS_COLLECTION, {
          pubFingerprint,
          submissionVerifier: pwVerifier,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const challengeId = crypto.randomUUID();
    const nonce = randomToken(32);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
    await conn.insertOne(CHALLENGE_COLLECTION, {
      challengeId,
      pubFingerprint,
      nonceHash: sha256(nonce),
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    });
    const encryptedChallenge = encryptForPublicKey(
      {
        version: 1,
        type: "karaweb-teacher-challenge",
        challengeId,
        pubFingerprint,
        nonce,
        expiresAt,
      },
      publicKeyJwk,
    );
    res.json({
      success: true,
      challengeId,
      pubFingerprint,
      encryptedChallenge,
      expiresAt,
    });
  } catch (err) {
    console.error("teacher/challenge failed", err);
    res.status(500).json({ error: "Failed to create teacher challenge" });
  }
});

app.post("/api/public/teacher/session", async (req, res) => {
  if (!prepareRequest(req, res)) return;
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
      { used: true, usedAt: new Date().toISOString() },
    );
    const sessionToken = randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await conn.insertOne(SESSION_COLLECTION, {
      tokenHash: sha256(sessionToken),
      pubFingerprint: challenge.pubFingerprint,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
    res.json({
      success: true,
      pubFingerprint: challenge.pubFingerprint,
      sessionToken,
      expiresAt,
    });
  } catch (err) {
    console.error("teacher/session failed", err);
    res.status(500).json({ error: "Failed to create teacher session" });
  }
});

// ── Student result submission ───────────────────────────────────────────
app.post("/api/public/results", async (req, res) => {
  if (!prepareRequest(req, res)) return;
  try {
    const body = req.body || {};
    if (String(body.b_phone_number || "").trim()) {
      res.status(400).json({ error: "Submission rejected" });
      return;
    }
    const pubFingerprint = String(body.pubFingerprint || "").toLowerCase();
    const studentCodeHash = String(body.studentCodeHash || "").toLowerCase();
    const wrappedStudentCode = String(body.wrappedStudentCode || "");
    const challengeGuid = String(body.challengeGuid || "");
    const challengeFileGuid = String(body.challengeFileGuid || "");
    if (!PUB_FINGERPRINT_PATTERN.test(pubFingerprint)) {
      res.status(400).json({ error: "Invalid pubFingerprint" });
      return;
    }
    if (!STUDENT_CODE_HASH_PATTERN.test(studentCodeHash)) {
      res.status(400).json({ error: "Invalid studentCodeHash" });
      return;
    }
    if (!verifyGuidChecksum(challengeGuid)) {
      res.status(400).json({ error: "Invalid challengeGuid" });
      return;
    }
    if (!verifyGuidChecksum(challengeFileGuid)) {
      res.status(400).json({ error: "Invalid challengeFileGuid" });
      return;
    }
    if (typeof body.passed !== "boolean") {
      res.status(400).json({ error: "Invalid passed" });
      return;
    }
    const payload = body.encryptedPayload;
    if (
      typeof payload !== "string" ||
      payload.length < 20 ||
      payload.length > MAX_PAYLOAD_CHARS
    ) {
      res.status(400).json({ error: "Invalid encryptedPayload" });
      return;
    }
    if (!envelopeOk(payload)) {
      res.status(400).json({ error: "Bad envelope" });
      return;
    }
    // wrappedStudentCode is the same KaraWeb-envelope shape as the
    // payload — RSA-OAEP-256+A256GCM, ~700 chars base64 — so we
    // reuse the same validator.
    if (
      typeof wrappedStudentCode !== "string" ||
      wrappedStudentCode.length < 20 ||
      wrappedStudentCode.length > MAX_PAYLOAD_CHARS
    ) {
      res.status(400).json({ error: "Invalid wrappedStudentCode" });
      return;
    }
    if (!envelopeOk(wrappedStudentCode)) {
      res.status(400).json({ error: "Bad wrappedStudentCode envelope" });
      return;
    }
    const submittedAt = body.submittedAt;
    if (!validRecentTimestamp(submittedAt)) {
      res.status(400).json({ error: "Invalid submittedAt" });
      return;
    }
    if (String(body.turnstileToken || "").length > MAX_TURNSTILE_CHARS) {
      res.status(400).json({ error: "Invalid turnstileToken" });
      return;
    }
    const ts = await verifyTurnstile(body.turnstileToken);
    if (!ts.success) {
      res.status(403).json({ error: "Turnstile verification failed" });
      return;
    }
    const conn = await Datastore.open();
    const passed = !!body.passed;
    const now = new Date().toISOString();
    // Upsert key uses the studentCodeHash (pseudonym), never the
    // plaintext code. The wrappedStudentCode rides along on the
    // row but isn't part of the lookup key.
    const key = {
      pubFingerprint,
      challengeFileGuid,
      studentCodeHash,
      challengeGuid,
    };
    const existing = await conn.findOneOrNull(RESULTS_COLLECTION, key);
    // Rate-limit checks happen BEFORE the per-cell cap so a teacher's
    // counters reflect every attempted submission, not just those that
    // would have been inserts.
    const isNewPair = !existing;
    const isNewStudent = isNewPair && !(await conn.findOneOrNull(
      RESULTS_COLLECTION,
      { pubFingerprint, studentCodeHash },
    ));
    const rl = await enforceRateLimits(conn, pubFingerprint, studentCodeHash, isNewStudent, isNewPair);
    if (!rl.ok) {
      res.status(429).json({ error: rl.error });
      return;
    }
    if (existing) {
      const count = Number(existing.count) || 0;
      if (MAX_SUBMISSIONS_PER_CELL > 0 && count >= MAX_SUBMISSIONS_PER_CELL) {
        res.status(429).json({ error: "cap_reached", count });
        return;
      }
      await conn.updateOne(
        RESULTS_COLLECTION,
        { _id: existing._id },
        {
          count: count + 1,
          latestPassed: passed,
          encryptedPayload: payload,
          wrappedStudentCode,
          submittedAt,
          receivedAt: now,
        },
      );
      res.json({
        success: true,
        receivedAt: now,
        count: count + 1,
        updated: true,
      });
      return;
    }
    const inserted = await conn.insertOne(RESULTS_COLLECTION, {
      ...key,
      wrappedStudentCode,
      count: 1,
      firstAttemptPassed: passed,
      latestPassed: passed,
      encryptedPayload: payload,
      submittedAt,
      receivedAt: now,
    });
    res.json({
      success: true,
      id: inserted._id,
      receivedAt: now,
      created: true,
    });
  } catch (err) {
    console.error("results POST failed", err);
    res.status(500).json({ error: "Failed to record result" });
  }
});

// ── Teacher: fetch results for the authenticated teacher ───────────────
// The bearer-token session carries the pubFingerprint (set when the
// teacher passed the challenge/response). Optional `?challengeFileGuid=…`
// filters to one book; without the filter every row under this
// teacher's pubFingerprint is returned.
app.get("/api/public/teacher/results", async (req, res) => {
  if (!prepareRequest(req, res)) return;
  const session = await loadTeacherSession(req);
  if (!session) {
    res.status(401).json({ error: "Teacher session required" });
    return;
  }
  const fileGuid = String((req.query && req.query.challengeFileGuid) || "");
  if (fileGuid && !verifyGuidChecksum(fileGuid)) {
    res.status(400).json({ error: "Invalid challengeFileGuid" });
    return;
  }
  try {
    const conn = await Datastore.open();
    const cleanup = await runTeacherFetchHousekeeping(conn);
    const filter = fileGuid
      ? { pubFingerprint: session.pubFingerprint, challengeFileGuid: fileGuid }
      : { pubFingerprint: session.pubFingerprint };
    const records = await conn
      .getMany(RESULTS_COLLECTION, filter, {
        sort: { receivedAt: 1 },
        limit: 5000,
      })
      .toArray();
    res.json({
      success: true,
      pubFingerprint: session.pubFingerprint,
      challengeFileGuid: fileGuid || null,
      cleanup,
      results: records.map(toResultRecord),
    });
  } catch (err) {
    console.error("teacher/results GET failed", err);
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

// ── Teacher: delete a single result by _id ─────────────────────────────
app.delete("/api/public/teacher/results/:recordId", async (req, res) => {
  if (!prepareRequest(req, res)) return;
  const session = await loadTeacherSession(req);
  if (!session) {
    res.status(401).json({ error: "Teacher session required" });
    return;
  }
  const recordId = String(req.params.recordId || "");
  try {
    const conn = await Datastore.open();
    const existing = await conn.findOneOrNull(RESULTS_COLLECTION, {
      _id: recordId,
      pubFingerprint: session.pubFingerprint,
    });
    if (!existing) {
      res.status(404).json({ error: "Result not found" });
      return;
    }
    await conn.removeOne(RESULTS_COLLECTION, {
      _id: recordId,
      pubFingerprint: session.pubFingerprint,
    });
    res.json({ success: true, recordId });
  } catch (err) {
    console.error("teacher/results DELETE failed", err);
    res.status(500).json({ error: "Failed to delete result" });
  }
});

// ── Catch-all (CORS + 404) ─────────────────────────────────────────────
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

// ── CORS / origin checking ─────────────────────────────────────────────
function prepareRequest(req, res) {
  applyCors(req, res);
  if (!isOriginAllowed(req)) {
    res.status(403).json({ error: "Origin not allowed" });
    return false;
  }
  return true;
}

function allowedOrigins() {
  const fromEnv = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS.slice();
}

function originFromReferer(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
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
  return (
    String(process.env.DISABLE_ORIGIN_CHECKS || "").toLowerCase() === "true"
  );
}

function isOriginAllowed(req) {
  if (localChecksDisabled()) return true;
  const origin = requestOrigin(req);
  if (!origin) return false;
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

// ── Turnstile ──────────────────────────────────────────────────────────
// Verification is routed through a shared Cloudflare Worker
// (DEFAULT_TURNSTILE_VERIFY_URL) that holds the secret half of the
// Turnstile widget pair. Codehooks never sees or stores the secret —
// it just POSTs the student-supplied token to the Worker and reads
// back the verdict. Same proxy pattern the Apps Script backend uses.
async function verifyTurnstile(token) {
  const requiredEnv = String(
    process.env.TURNSTILE_REQUIRED || "",
  ).toLowerCase();
  const required = requiredEnv
    ? requiredEnv !== "false"
    : DEFAULT_TURNSTILE_REQUIRED;
  if (!required) return { success: true, skipped: true };
  if (
    !token ||
    typeof token !== "string" ||
    token.length > MAX_TURNSTILE_CHARS
  ) {
    return { success: false, error: "missing-token" };
  }
  const verifyUrl =
    process.env.TURNSTILE_VERIFY_URL || DEFAULT_TURNSTILE_VERIFY_URL;
  let r;
  try {
    r = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tkn: token }),
    });
  } catch (err) {
    return {
      success: false,
      error: "verify-proxy-unreachable",
      detail: String(err),
    };
  }
  if (!r.ok) return { success: false, error: "verify-proxy-http-" + r.status };
  let body;
  try {
    body = await r.json();
  } catch {
    return { success: false, error: "verify-proxy-non-json" };
  }
  return { success: !!body.success, errors: body.errors ?? [] };
}

// ── Teacher sessions ───────────────────────────────────────────────────
// Returns `{ pubFingerprint, expiresAt, ... }` for a valid bearer
// token in the request's Authorization header, or `null` when the
// header is missing / invalid / expired.
async function loadTeacherSession(req) {
  const authz = String(req.headers.authorization || "");
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const conn = await Datastore.open();
  const sess = await conn.findOneOrNull(SESSION_COLLECTION, {
    tokenHash: sha256(m[1]),
  });
  if (!sess || isExpired(sess.expiresAt)) return null;
  return sess;
}

async function runTeacherFetchHousekeeping(conn) {
  const now = new Date();
  const cutoffNow = now.toISOString();
  // Long-term row pruning is skipped entirely when the teacher has
  // set RESULT_RETENTION_DAYS to 0. Expired challenge nonces and
  // bearer-token sessions are always cleaned up (they have their
  // own per-record `expiresAt` TTLs, unrelated to long-term
  // submission retention).
  const removedResults =
    RESULT_RETENTION_DAYS > 0
      ? await safeRemoveMany(conn, RESULTS_COLLECTION, {
          receivedAt: {
            $lt: new Date(now.getTime() - RESULT_RETENTION_MS).toISOString(),
          },
        })
      : 0;
  // Rate-limit counter rows older than 7 days are useless (their window
  // string is already in the past, so they'll never be matched on a new
  // submission). Cleanup keeps the collection bounded.
  const rateCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const removedRateLimits = await safeRemoveMany(conn, RATE_LIMITS_COLLECTION, {
    window: { $lt: rateCutoff },
  });
  return {
    retentionDays: RESULT_RETENTION_DAYS,
    removedResults,
    removedRateLimits,
    removedChallenges: await safeRemoveMany(conn, CHALLENGE_COLLECTION, {
      expiresAt: { $lt: cutoffNow },
    }),
    removedSessions: await safeRemoveMany(conn, SESSION_COLLECTION, {
      expiresAt: { $lt: cutoffNow },
    }),
  };
}

// ── App-level rate-limit enforcement ───────────────────────────────────
// Reads (and creates as needed) per-(pubFingerprint, window) counter
// docs in the rate_limits collection, and rejects when any of the four
// caps would be exceeded. Returns { ok: true } on pass, or
// { ok: false, error: '<machine_string>' } on breach.
//
// Each cap can be disabled individually by setting its constant to 0.
async function enforceRateLimits(conn, pubFingerprint, studentCodeHash, isNewStudent, isNewPair) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);          // YYYY-MM-DD
  const minute = now.toISOString().slice(0, 16);        // YYYY-MM-DDTHH:MM

  // 1. Per-minute burst cap (always-charged: even repeat submissions count).
  if (MAX_SUBMISSIONS_PER_MINUTE > 0) {
    const cur = await getOrInitCounter(conn, pubFingerprint, "minute", "", minute);
    if (cur >= MAX_SUBMISSIONS_PER_MINUTE) {
      return { ok: false, error: "too_many_per_minute" };
    }
  }

  // 2. New-student cap (only charged when this hash hasn't been seen before).
  if (isNewStudent && MAX_NEW_STUDENTS_PER_DAY > 0) {
    const cur = await getOrInitCounter(conn, pubFingerprint, "students", "", date);
    if (cur >= MAX_NEW_STUDENTS_PER_DAY) {
      return { ok: false, error: "too_many_new_students" };
    }
  }

  // 3. New-challenge-per-student cap (only charged when this student hits
  //    a challengeGuid they hadn't yet today).
  if (isNewPair && MAX_NEW_CHALLENGES_PER_STUDENT_PER_DAY > 0) {
    const cur = await getOrInitCounter(conn, pubFingerprint, "challenges", studentCodeHash, date);
    if (cur >= MAX_NEW_CHALLENGES_PER_STUDENT_PER_DAY) {
      return { ok: false, error: "too_many_new_challenges" };
    }
  }

  // All caps passed — now bump the counters we just consulted.
  if (MAX_SUBMISSIONS_PER_MINUTE > 0) {
    await bumpCounter(conn, pubFingerprint, "minute", "", minute);
  }
  if (isNewStudent && MAX_NEW_STUDENTS_PER_DAY > 0) {
    await bumpCounter(conn, pubFingerprint, "students", "", date);
  }
  if (isNewPair && MAX_NEW_CHALLENGES_PER_STUDENT_PER_DAY > 0) {
    await bumpCounter(conn, pubFingerprint, "challenges", studentCodeHash, date);
  }
  return { ok: true };
}

async function getOrInitCounter(conn, pubFingerprint, scope, key, window) {
  const doc = await conn.findOneOrNull(RATE_LIMITS_COLLECTION, {
    pubFingerprint, scope, key, window,
  });
  return doc ? Number(doc.count) || 0 : 0;
}

async function bumpCounter(conn, pubFingerprint, scope, key, window) {
  // Two-step "upsert by hand" — Codehooks Datastore doesn't expose a
  // single atomic $inc. Race-tolerant: two concurrent inserts may
  // produce duplicate docs which over-count slightly, but never
  // under-count (the cap check above runs against the higher number).
  try {
    const doc = await conn.findOneOrNull(RATE_LIMITS_COLLECTION, {
      pubFingerprint, scope, key, window,
    });
    if (doc) {
      await conn.updateOne(RATE_LIMITS_COLLECTION, { _id: doc._id }, {
        count: (Number(doc.count) || 0) + 1,
      });
    } else {
      await conn.insertOne(RATE_LIMITS_COLLECTION, {
        pubFingerprint, scope, key, window, count: 1,
      });
    }
  } catch (err) {
    console.warn("rate-limit counter bump failed", err);
  }
}

async function safeRemoveMany(conn, collection, query) {
  try {
    const r = await conn.removeMany(collection, query);
    return removeCount(r);
  } catch (err) {
    console.warn("Housekeeping failed for " + collection, err);
    return null;
  }
}

function removeCount(r) {
  if (!r || typeof r !== "object") return 0;
  return (
    Number(r.deletedCount) ||
    Number(r.removedCount) ||
    Number(r.count) ||
    Number(r.removed) ||
    0
  );
}

// ── Shape helpers ──────────────────────────────────────────────────────
function toResultRecord(r) {
  return {
    _id: r._id,
    pubFingerprint: r.pubFingerprint,
    challengeFileGuid: r.challengeFileGuid,
    studentCodeHash: r.studentCodeHash,
    wrappedStudentCode: r.wrappedStudentCode,
    challengeGuid: r.challengeGuid,
    submissionCount: Number(r.count) || 0,
    firstAttemptPassed: !!r.firstAttemptPassed,
    latestPassed: !!r.latestPassed,
    encryptedPayload: r.encryptedPayload,
    submittedAt: r.submittedAt,
    receivedAt: r.receivedAt,
  };
}

// Derive the same 32-hex pubFingerprint the client computes via
// src/utils/pubFingerprint.js: sha256(publicKey.n) → first 32 hex chars.
async function derivePubFingerprint(publicKeyJwk) {
  const n = String(publicKeyJwk?.n || "").trim();
  if (!n) throw new Error("derivePubFingerprint: publicKey.n required");
  return sha256(n).slice(0, 32);
}

function isPublicKeyJwk(v) {
  return !!(
    v &&
    typeof v === "object" &&
    v.kty === "RSA" &&
    typeof v.n === "string" &&
    typeof v.e === "string" &&
    !v.d
  ); // explicitly reject private keys
}

function validRecentTimestamp(value) {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  return Math.abs(Date.now() - t) <= 30 * 60 * 1000;
}

function isExpired(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) || t <= Date.now();
}

function randomToken(n) {
  return crypto.randomBytes(n).toString("base64url");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

// FNV-1a 32-bit — mirrors src/utils/guidChecksum.js so server-side
// verification reproduces what the client computed.
function fnv1a32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

function verifyGuidChecksum(guid) {
  const s = String(guid || "");
  if (!CHECKSUMMED_GUID_PATTERN.test(s)) return false;
  const expected = String(fnv1a32(s.slice(0, 36)) % 1000).padStart(3, "0");
  return expected === s.slice(38);
}

// Validate the envelope text shape produced by client-side
// src/utils/crypto/envelope.js — same header + JSON-body sniff the
// Apps Script applies.
function envelopeOk(text) {
  const s = String(text || "");
  const headerNl = ENVELOPE_HEADER + "\n";
  if (s.indexOf(headerNl) !== 0) return false;
  let body;
  try {
    body = JSON.parse(s.slice(headerNl.length));
  } catch {
    return false;
  }
  if (!body || body.format !== ENVELOPE_FORMAT) return false;
  if (body.algorithm !== ENVELOPE_ALGO) return false;
  if (
    typeof body.encryptedKey !== "string" ||
    body.encryptedKey.length < ENV_KEY_MIN ||
    body.encryptedKey.length > ENV_KEY_MAX
  )
    return false;
  if (
    typeof body.iv !== "string" ||
    body.iv.length < ENV_IV_MIN ||
    body.iv.length > ENV_IV_MAX
  )
    return false;
  if (typeof body.ciphertext !== "string" || body.ciphertext.length === 0)
    return false;
  return true;
}

// ── RSA-OAEP encryption (manual; mirrors unitester pattern) ───────────
//
// The Codehooks runtime may not expose Node's WebCrypto SubtleCrypto for
// RSA-OAEP, so we implement RSA-OAEP-SHA256 wrapping with primitive
// BigInt modular exponentiation, just like unitester's backend does.

function encryptForPublicKey(payload, publicKeyJwk) {
  const aesRaw = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesRaw, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const wrappedKey = rsaOaepEncrypt(aesRaw, publicKeyJwk);
  const envelope = {
    format: ENVELOPE_FORMAT,
    algorithm: "RSA-OAEP-256+A256GCM",
    encryptedKey: wrappedKey.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return ENVELOPE_HEADER + "\n" + JSON.stringify(envelope);
}

function rsaOaepEncrypt(message, jwk) {
  const n = base64UrlToBuffer(jwk.n);
  const e = base64UrlToBuffer(jwk.e);
  const k = n.length;
  const hLen = 32;
  if (message.length > k - 2 * hLen - 2)
    throw new Error("Message too long for RSA-OAEP");
  const lHash = crypto.createHash("sha256").update(Buffer.alloc(0)).digest();
  const ps = Buffer.alloc(k - message.length - 2 * hLen - 2);
  const db = Buffer.concat([lHash, ps, Buffer.from([0x01]), message]);
  const seed = crypto.randomBytes(hLen);
  const maskedDb = xorBuffers(db, mgf1(seed, k - hLen - 1));
  const maskedSeed = xorBuffers(seed, mgf1(maskedDb, hLen));
  const encoded = Buffer.concat([Buffer.from([0x00]), maskedSeed, maskedDb]);
  const encrypted = modPow(
    bufferToBigInt(encoded),
    bufferToBigInt(e),
    bufferToBigInt(n),
  );
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
  const out = Buffer.alloc(left.length);
  for (let i = 0; i < left.length; i++) out[i] = left[i] ^ right[i];
  return out;
}

function base64UrlToBuffer(value) {
  let b = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return Buffer.from(b, "base64");
}

function bufferToBigInt(buf) {
  return BigInt("0x" + buf.toString("hex"));
}

function bigIntToBuffer(value, length) {
  let hex = value.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length > length) return bytes.subarray(bytes.length - length);
  if (bytes.length === length) return bytes;
  return Buffer.concat([Buffer.alloc(length - bytes.length), bytes]);
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  let factor = base % modulus;
  let p = exponent;
  while (p > 0n) {
    if (p & 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    p >>= 1n;
  }
  return result;
}

export default app.init();
