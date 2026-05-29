// Raw Apps Script source served to teachers via the Google Drive setup
// wizard. Placeholders (between `__…__`) are replaced at generation
// time by `appsScriptGenerator.js`.
//
// Per-teacher script (Phase 3+): one script per teacher, reusable
// across every class and every challenge book. The script does not
// know about any specific class — it accepts submissions, validates a
// public-key-based bouncer, and upserts a row in a per-book sheet.

export const APPS_SCRIPT_TEMPLATE = `// ==============================================================
// KaraWeb cloud-save backend — one per TEACHER (not per class).
// Generated at __GENERATED_AT__ by KaraWeb.
//
// Deploy: New project on script.google.com → paste this file → Deploy
// → New deployment → Web app, Execute as: Me, Who has access: Anyone.
// Copy the Web App URL into the KaraWeb Cloud Save tab.
//
// You only need to re-paste this script if you ROTATE your teacher
// keypair. Adding/removing students or new challenge books does not
// require any change here.
// ==============================================================

// 32-hex (128-bit) fingerprint of the teacher's RSA public modulus.
// Used purely as the submission bouncer concat — never as a real
// crypto secret, just as proof that the submitter has read the
// challenges JSON. We deliberately do NOT bake the full modulus
// into the deployed script, so a leak of the script source doesn't
// give an attacker the means to derive student codes from usernames.
var TEACHER_PUBLIC_KEY_FP = "__TEACHER_PUBLIC_KEY_FP__";
var ADMIN_TOKEN_HASH      = "__ADMIN_TOKEN_HASH__";

// Derived from the teacher's keydetails password (PBKDF2-SHA256 over
// publicKey.n, base64). Empty string when the teacher did NOT
// password-protect their keydetails — in which case the doGet check
// below is skipped. Re-generate + re-deploy this script after
// changing your keydetails password.
var SUBMISSION_VERIFIER = "__SUBMISSION_VERIFIER__";

// ── Data retention (edit me) ──────────────────────────────────────────
// Submission rows older than this many days are removed automatically
// when YOU (the teacher) next fetch results in KaraWeb's Submissions
// tab. Set to 0 to keep rows forever (auto-deletion disabled).
//
// Why bother: if your keydetails file is ever lost or accidentally
// shared, anyone with it can decrypt every row in your sheet, INCLUDING
// historical ones. A shorter retention reduces the window of past data
// exposure. 3 years (1095 days) is a sensible default for classroom use.
var ROW_RETENTION_DAYS = 1095;
// ──────────────────────────────────────────────────────────────────────

// System wiring (do not edit).
var _VERIFY_PROXY_URL  = "__VERIFY_PROXY_URL__";
var TURNSTILE_REQUIRED = __TURNSTILE_REQUIRED__;
var MAX_PAYLOAD_CHARS  = 14000;     // ~10 KB plaintext after RSA-OAEP+base64
var SHEET_FOLDER_NAME  = "karaweb";

// ── App-level rate limits (edit if your school has different needs) ──
// All four caps are enforced server-side BEFORE a row is inserted /
// updated. On breach the script returns one of:
//   cap_reached            — per-cell submission count exhausted
//   too_many_per_minute    — burst rate across all students (this script)
//   too_many_new_students  — new-student introduction limit for today
//   too_many_new_challenges — this student tried too many distinct
//                            challenges today
// Counters are stored in Apps Script's PropertiesService keyed by UTC
// date/minute and pruned to a 7-day window during the same
// housekeeping pass that prunes long-term result rows.
//
// Set any cap to 0 to disable that single check; the others stay
// active. The script-level Properties store is shared across all
// challenge books this teacher has deployed under this Apps Script.
var MAX_SUBMISSIONS_PER_CELL              = 100;  // per (file, student, challenge)
var MAX_NEW_STUDENTS_PER_DAY              = 250;  // new studentCodeHash per teacher per UTC day
var MAX_NEW_CHALLENGES_PER_STUDENT_PER_DAY = 50;  // distinct new challenges this student hits per UTC day
var MAX_SUBMISSIONS_PER_MINUTE            = 55;   // bursts across all students per teacher per rolling minute
// ──────────────────────────────────────────────────────────────────────

// Envelope sanity bounds — the encryptedSolution string must start
// with this header, then a single newline, then valid JSON carrying
// exactly these fields with sensible base64 lengths.
var ENVELOPE_HEADER  = "KaraWeb Cloud Save";
var ENVELOPE_FORMAT  = "karaweb-result-hybrid-v1";
var ENVELOPE_ALGO    = "RSA-OAEP-256+A256GCM";
// RSA-4096 OAEP wraps a 32-byte AES key → 512-byte ciphertext →
// base64 ≈ 684 chars. Allow ±64 char slack for any padding/wrapping
// edge cases.
var ENV_KEY_MIN = 620; var ENV_KEY_MAX = 750;
// 12-byte AES-GCM IV → base64 16 chars (always exactly 16 with padding).
var ENV_IV_MIN  = 14;  var ENV_IV_MAX  = 32;

// Spreadsheet column layout (privacy-tightened — no plaintext user
// numbers persisted; the teacher decrypts both columns H + G locally
// at fetch time to recover the original 6-digit codes).
//   A  timestamp (last submission)
//   B  studentCodeHash (16-hex dedup key)
//   C  challengeGuid
//   D  submissionCount
//   E  firstAttemptPassed (true/false)
//   F  latestPassed (true/false)
//   G  encryptedSolution
//   H  wrappedStudentCode (RSA-OAEP envelope wrapping the 6-digit code)
var COL = { TIMESTAMP:1, STUDENT_HASH:2, CHALLENGE:3, COUNT:4, FIRST:5, LATEST:6, BLOB:7, STUDENT_ENC:8 };
var HEADER_ROW = ["timestamp","studentCodeHash","challengeGuid","submissionCount","firstAttemptPassed","latestPassed","encryptedSolution","wrappedStudentCode"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) {
    return _json({status: "server_busy"});
  }
  try {
    var data;
    try {
      data = JSON.parse(e.postData ? e.postData.contents : "{}");
    } catch (err) {
      return _json({status: "bad_request"});
    }

    // DEFENCE 0: honeypot. A real KaraWeb client never sends
    // b_phone_number; spray-and-pray scanners that flood the
    // endpoint with common form fields sometimes do.
    if (data && typeof data.b_phone_number === "string" && data.b_phone_number.length > 0) {
      return _json({status: "rejected"});
    }

    // DEFENCE 1: payload-size cap on the encrypted solution blob.
    if (!data || !data.encryptedSolution
        || typeof data.encryptedSolution !== "string"
        || data.encryptedSolution.length > MAX_PAYLOAD_CHARS) {
      return _json({status: "invalid_length"});
    }
    // DEFENCE 2: shape — studentCodeHash is 16 hex; both GUIDs are
    // checksummed (UUID-v4 + "-c" + 3 digits, 41 chars total). The
    // plaintext 6-digit code never leaves the client — its
    // RSA-OAEP-wrapped form rides along in wrappedStudentCode.
    var studentCodeHash    = String(data.studentCodeHash || "");
    var wrappedStudentCode = String(data.wrappedStudentCode || "");
    var challengeGuid      = String(data.challengeGuid || "");
    var challengeFileGuid  = String(data.challengeFileGuid || "");
    if (!/^[0-9a-f]{16}$/i.test(studentCodeHash))  return _json({status: "invalid_user"});
    if (!_guidChecksumOk(challengeGuid))           return _json({status: "invalid_challenge"});
    if (!_guidChecksumOk(challengeFileGuid))       return _json({status: "invalid_book"});
    if (typeof data.passed !== "boolean")          return _json({status: "invalid_passed"});

    // DEFENCE 2b: the encryptedSolution AND wrappedStudentCode must
    // both be valid KaraWeb envelopes — header, parseable JSON,
    // expected fields with sensible sizes.
    if (!_envelopeOk(data.encryptedSolution))      return _json({status: "bad_envelope"});
    if (!_envelopeOk(wrappedStudentCode))          return _json({status: "bad_envelope"});

    // DEFENCE 3: bouncer secret = TEACHER_PUBLIC_KEY_FP + studentCodeHash.
    // The fingerprint is the 32-hex sha256 of the teacher modulus —
    // anyone with the challenges JSON can derive it; the bouncer just
    // proves the submitter has read that JSON for this teacher.
    var expectedSecret = TEACHER_PUBLIC_KEY_FP + studentCodeHash;
    if (String(data.secret || "") !== expectedSecret) {
      return _json({status: "unauthorized"});
    }

    // DEFENCE 4: Turnstile token, verified via the karaweb Worker.
    if (TURNSTILE_REQUIRED) {
      var tkn = String(data.tkn || "");
      if (!tkn) return _json({status: "missing_captcha"});
      var ok = false;
      try {
        var resp = UrlFetchApp.fetch(_VERIFY_PROXY_URL, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({tkn: tkn}),
          muteHttpExceptions: true,
        });
        var verdict = JSON.parse(resp.getContentText());
        ok = verdict && verdict.success === true;
      } catch (err) {
        ok = false;
      }
      if (!ok) return _json({status: "bot_detected"});
    }

    // Find or create folder + per-book spreadsheet, then upsert the
    // (studentCode, challengeGuid) row.
    var folder = _findOrCreateFolder(SHEET_FOLDER_NAME);
    var ss = _findOrCreateSpreadsheet(folder, challengeFileGuid);
    var sheet = ss.getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADER_ROW);
    }

    var passed = !!data.passed;
    var now = new Date();
    var rowIndex = _findRow(sheet, studentCodeHash, challengeGuid);
    // Rate-limit checks run BEFORE the per-cell cap so counters reflect
    // every attempted submission, not just inserts.
    var isNewPair = rowIndex < 0;
    var isNewStudent = isNewPair && _findRowByStudent_(sheet, studentCodeHash) < 0;
    var rl = _enforceRateLimits_(studentCodeHash, isNewStudent, isNewPair);
    if (!rl.ok) {
      return _json({status: rl.error});
    }
    if (rowIndex < 0) {
      sheet.appendRow([now, studentCodeHash, challengeGuid, 1, passed, passed, data.encryptedSolution, wrappedStudentCode]);
      return _json({status: "success", created: true});
    }
    var existing = sheet.getRange(rowIndex, 1, 1, 8).getValues()[0];
    var count = Number(existing[COL.COUNT - 1]) || 0;
    if (MAX_SUBMISSIONS_PER_CELL > 0 && count >= MAX_SUBMISSIONS_PER_CELL) {
      return _json({status: "cap_reached", count: count});
    }
    var firstAttemptPassed = (existing[COL.FIRST - 1] === true || existing[COL.FIRST - 1] === "true");
    sheet.getRange(rowIndex, 1, 1, 8).setValues([[
      now, studentCodeHash, challengeGuid, count + 1, firstAttemptPassed, passed, data.encryptedSolution, wrappedStudentCode,
    ]]);
    return _json({status: "success", updated: true, count: count + 1});
  } catch (err) {
    return _json({status: "internal_error", detail: String(err)});
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  // Cheap liveness check.
  if (e && e.parameter && e.parameter.ping === "1") {
    return _json({status: "ok"});
  }
  // Teacher analyse fetch — requires admin token AND a challengeFileGuid.
  var adminKey = String((e && e.parameter && e.parameter.adminKey) || "");
  if (!adminKey) return _json({status: "missing_admin_key"});
  if (_sha256Hex(adminKey) !== ADMIN_TOKEN_HASH) {
    return _json({status: "unauthorized"});
  }
  // Password-derived verifier — only enforced if the teacher
  // password-protected their keydetails (and re-generated this
  // script). Empty SUBMISSION_VERIFIER → no enforcement.
  if (SUBMISSION_VERIFIER.length > 0) {
    var pwVerifier = String((e && e.parameter && e.parameter.pwVerifier) || "");
    if (!pwVerifier) return _json({status: "pw_required"});
    if (pwVerifier !== SUBMISSION_VERIFIER) return _json({status: "pw_mismatch"});
  }
  var challengeFileGuid = String((e && e.parameter && e.parameter.challengeFileGuid) || "");
  if (!_guidChecksumOk(challengeFileGuid)) return _json({status: "invalid_book"});

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) {
    return _json({status: "server_busy"});
  }
  try {
    var folder = _findOrCreateFolder(SHEET_FOLDER_NAME);
    var files = folder.getFilesByName(challengeFileGuid);
    if (!files.hasNext()) return _json({status: "success", rows: []});
    var ss = SpreadsheetApp.open(files.next());
    var sheet = ss.getActiveSheet();

    // Prune rows older than ROW_RETENTION_DAYS first so the read below
    // returns the post-prune state. Skipped when retention is 0.
    var prunedRows = (ROW_RETENTION_DAYS > 0)
      ? _pruneOldRows(sheet, ROW_RETENTION_DAYS)
      : 0;
    // Also drop rate-limit counters older than 7 days so PropertiesService
    // doesn't grow without bound across the lifetime of this script.
    _pruneRateLimitCounters_();

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return _json({status: "success", rows: [], prunedRows: prunedRows});
    var values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    var rows = values.map(function (r) {
      return {
        submittedAt:         (r[0] instanceof Date) ? r[0].toISOString() : String(r[0]),
        studentCodeHash:     String(r[1]),
        challengeGuid:       String(r[2]),
        submissionCount:     Number(r[3]) || 0,
        firstAttemptPassed:  r[4] === true || r[4] === "true",
        latestPassed:        r[5] === true || r[5] === "true",
        encryptedSolution:   String(r[6] || ""),
        wrappedStudentCode:  String(r[7] || ""),
      };
    });
    return _json({status: "success", rows: rows, prunedRows: prunedRows});
  } finally {
    lock.releaseLock();
  }
}

// Walk the sheet bottom-up; delete any row whose timestamp is older
// than the given number of days. Batches contiguous deletions via
// deleteRows() to minimise API calls. Returns the count of removed rows.
function _pruneOldRows(sheet, days) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var cutoff = Date.now() - days * 86400000;
  var timestamps = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var pruned = 0;
  var i = timestamps.length - 1;
  while (i >= 0) {
    var ts = timestamps[i][0];
    var tsMs = (ts instanceof Date) ? ts.getTime() : Date.parse(ts);
    if (!isNaN(tsMs) && tsMs < cutoff) {
      // Find the contiguous run of expired rows ending at i.
      var runEnd = i;
      while (i - 1 >= 0) {
        var prev = timestamps[i - 1][0];
        var prevMs = (prev instanceof Date) ? prev.getTime() : Date.parse(prev);
        if (isNaN(prevMs) || prevMs >= cutoff) break;
        i -= 1;
      }
      var runStart = i;
      var howMany = (runEnd - runStart + 1);
      // sheet rows are 1-indexed and the header is row 1; data starts at 2.
      sheet.deleteRows(runStart + 2, howMany);
      pruned += howMany;
    }
    i -= 1;
  }
  return pruned;
}

// ── helpers ────────────────────────────────────────────────────────

function _json(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function _findOrCreateFolder(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function _findOrCreateSpreadsheet(folder, name) {
  var files = folder.getFilesByName(name);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  var ss = SpreadsheetApp.create(name);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  return ss;
}

function _findRow(sheet, studentCodeHash, challengeGuid) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var values = sheet.getRange(2, COL.STUDENT_HASH, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === studentCodeHash && String(values[i][1]) === challengeGuid) {
      return i + 2;
    }
  }
  return -1;
}

// Returns the first row index whose studentCodeHash matches, regardless
// of challengeGuid — used by the rate-limit code to decide "is this a
// brand-new student we've never seen before?".
function _findRowByStudent_(sheet, studentCodeHash) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var values = sheet.getRange(2, COL.STUDENT_HASH, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === studentCodeHash) return i + 2;
  }
  return -1;
}

// ── Rate-limit enforcement (PropertiesService-backed counters) ──────
// See the constants block at the top of this file for the four limits
// and their semantics. Each counter is a simple integer stored under
// a date- or minute-stamped key; bumping is read-modify-write, which
// is safe because doPost already holds a script-level lock for the
// duration of the request.
function _enforceRateLimits_(studentCodeHash, isNewStudent, isNewPair) {
  var now = new Date();
  var date   = Utilities.formatDate(now, "UTC", "yyyy-MM-dd");
  var minute = Utilities.formatDate(now, "UTC", "yyyy-MM-dd'T'HH:mm");
  var props  = PropertiesService.getScriptProperties();

  if (MAX_SUBMISSIONS_PER_MINUTE > 0) {
    if (_getCounter_(props, "rl:minute:" + minute) >= MAX_SUBMISSIONS_PER_MINUTE) {
      return {ok: false, error: "too_many_per_minute"};
    }
  }
  if (isNewStudent && MAX_NEW_STUDENTS_PER_DAY > 0) {
    if (_getCounter_(props, "rl:students:" + date) >= MAX_NEW_STUDENTS_PER_DAY) {
      return {ok: false, error: "too_many_new_students"};
    }
  }
  if (isNewPair && MAX_NEW_CHALLENGES_PER_STUDENT_PER_DAY > 0) {
    if (_getCounter_(props, "rl:challenges:" + date + ":" + studentCodeHash)
        >= MAX_NEW_CHALLENGES_PER_STUDENT_PER_DAY) {
      return {ok: false, error: "too_many_new_challenges"};
    }
  }

  // All caps passed — bump every counter we consulted.
  if (MAX_SUBMISSIONS_PER_MINUTE > 0) {
    _bumpCounter_(props, "rl:minute:" + minute);
  }
  if (isNewStudent && MAX_NEW_STUDENTS_PER_DAY > 0) {
    _bumpCounter_(props, "rl:students:" + date);
  }
  if (isNewPair && MAX_NEW_CHALLENGES_PER_STUDENT_PER_DAY > 0) {
    _bumpCounter_(props, "rl:challenges:" + date + ":" + studentCodeHash);
  }
  return {ok: true};
}

function _getCounter_(props, key) {
  var raw = props.getProperty(key);
  return raw ? (Number(raw) || 0) : 0;
}

function _bumpCounter_(props, key) {
  try {
    var raw = props.getProperty(key);
    var n = raw ? (Number(raw) || 0) : 0;
    props.setProperty(key, String(n + 1));
  } catch (err) {
    // PropertiesService quota errors are non-fatal — better to over-
    // allow submissions than to reject legitimate ones.
  }
}

// Removes rate-limit counter keys whose embedded date is older than 7
// days. Called from doGet alongside the long-term row prune so it
// runs once per teacher fetch.
function _pruneRateLimitCounters_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties();
    var cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
    var cutoffDate = Utilities.formatDate(cutoff, "UTC", "yyyy-MM-dd");
    var stale = [];
    for (var key in all) {
      if (!key.indexOf || key.indexOf("rl:") !== 0) continue;
      // Extract the embedded YYYY-MM-DD by finding the first
      // 10-character date-like substring after the scope prefix.
      var m = key.match(/(\d{4}-\d{2}-\d{2})/);
      if (!m) continue;
      if (m[1] < cutoffDate) stale.push(key);
    }
    for (var i = 0; i < stale.length; i++) props.deleteProperty(stale[i]);
    return stale.length;
  } catch (err) {
    return 0;
  }
}

function _sha256Hex(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8,
  );
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i] & 0xff;
    hex += (v < 16 ? "0" : "") + v.toString(16);
  }
  return hex;
}

// FNV-1a 32-bit hash. Mirrors src/utils/guidChecksum.js exactly so
// the same checksum the client computes is reproduced server-side.
function _fnv1a32(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h = h ^ s.charCodeAt(i);
    // Equivalent to h *= 0x01000193 with 32-bit overflow.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

// Verify a checksummed GUID is of the form "<uuid-36>-c<3 digits>"
// AND the suffix matches the FNV-1a checksum of the UUID prefix.
function _guidChecksumOk(guid) {
  var s = String(guid || "");
  if (s.length !== 41) return false;
  // UUID v4 pattern + "-c" + 3 digits.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-c\\d{3}$/i.test(s)) {
    return false;
  }
  var uuid = s.slice(0, 36);
  var expected = ("00" + (_fnv1a32(uuid) % 1000)).slice(-3);
  return expected === s.slice(38);
}

// Verify the encryptedSolution is a valid envelope: correct header,
// parseable JSON body with the expected fields and sensible base64
// lengths for the wrapped AES key and the AES-GCM IV.
function _envelopeOk(text) {
  var s = String(text || "");
  var headerNl = ENVELOPE_HEADER + "\\n";
  if (s.indexOf(headerNl) !== 0) return false;
  var body;
  try { body = JSON.parse(s.slice(headerNl.length)); } catch (err) { return false; }
  if (!body || body.format !== ENVELOPE_FORMAT) return false;
  if (body.algorithm !== ENVELOPE_ALGO) return false;
  if (typeof body.encryptedKey !== "string"
      || body.encryptedKey.length < ENV_KEY_MIN
      || body.encryptedKey.length > ENV_KEY_MAX) return false;
  if (typeof body.iv !== "string"
      || body.iv.length < ENV_IV_MIN
      || body.iv.length > ENV_IV_MAX) return false;
  if (typeof body.ciphertext !== "string" || body.ciphertext.length === 0) return false;
  return true;
}
`;
