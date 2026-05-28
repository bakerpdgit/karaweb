// Student-code helpers.
//
// Per-teacher model: a student's 6-digit numeric code is derived
// deterministically from `sha256(publicKey.n + "|" + username)`. The
// teacher's RSA public modulus acts as the salt — so the *same*
// username under teacher A maps to a *different* code than under
// teacher B. This prevents a rainbow-table built against one
// teacher's class from working against another's, and unifies the
// Google Drive and Codehooks backends on a single algorithm.
//
// Same hash is used by:
//   - ClassListPanel (teacher generates the codes shown in the table /
//     exported .txt)
//   - StudentLoginModal (recomputes the expected code from the typed
//     username + the publicKey embedded in the loaded cloud-save block)
//   - suggestSuffix (resolves collisions by appending a digit)

const enc = new TextEncoder();

async function sha256(text) {
  if (!(typeof crypto !== 'undefined' && crypto.subtle)) {
    throw new Error('This browser does not support Web Crypto (SHA-256).');
  }
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return new Uint8Array(buf);
}

function bytesTo6Digit(bytes) {
  // Take the first 3 bytes (24 bits = 0..16,777,215), mod 1,000,000,
  // zero-padded to 6 characters.
  const n = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  const code = n % 1_000_000;
  return String(code).padStart(6, '0');
}

function requirePub(publicKeyN) {
  const n = String(publicKeyN || '').trim();
  if (!n) throw new Error('Student-code derivation needs the teacher publicKey.n.');
  return n;
}

export async function hashStudentCode(username, publicKeyN) {
  const n = requirePub(publicKeyN);
  const digest = await sha256(`${n}|${String(username).toLowerCase()}`);
  return bytesTo6Digit(digest);
}

// Stable 16-hex (64-bit) dedup key used by both backends to identify
// a (teacher, student) pair without persisting the plaintext 6-digit
// code. Each submission also carries the RSA-OAEP-wrapped form of
// the code so the teacher can recover the original locally.
export async function studentCodeDedupHash(publicKeyN, studentCode) {
  const n = requirePub(publicKeyN);
  const code = String(studentCode || '').trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error('studentCodeDedupHash needs a 6-digit student code.');
  }
  const digest = await sha256(`${n}|${code}`);
  let out = '';
  for (let i = 0; i < 8; i++) out += digest[i].toString(16).padStart(2, '0');
  return out;
}

export async function computeStudentCodes(usernames, publicKeyN) {
  const n = requirePub(publicKeyN);
  const seen = new Map();
  const students = [];
  for (const raw of usernames) {
    const username = String(raw || '').trim().toLowerCase();
    if (!username) continue;
    const code = await hashStudentCode(username, n);
    students.push({ username, code, suffixApplied: false });
    if (!seen.has(code)) seen.set(code, []);
    seen.get(code).push(username);
  }
  const collisions = [];
  for (const [code, list] of seen.entries()) {
    if (list.length > 1) collisions.push({ code, usernames: list });
  }
  return { students, collisions };
}

export async function suggestSuffix(username, takenCodes, publicKeyN) {
  const n = requirePub(publicKeyN);
  for (let i = 1; i <= 100; i++) {
    const candidate = `${username}${i}`;
    const code = await hashStudentCode(candidate, n);
    if (!takenCodes.has(code)) return { suffix: String(i), username: candidate, code };
  }
  return null;
}

// ── Shared ─────────────────────────────────────────────────────────────

// Split user-pasted text into a clean list of usernames using newlines,
// commas or semicolons as separators. Trims, lower-cases, dedupes.
export function parseBulkUsernames(text) {
  const parts = String(text || '')
    .split(/[\n,;]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(parts));
}
