// Deterministic 3-decimal-digit checksum appended to UUIDs to make
// stray / forged challenge identifiers easy to filter out at the
// backend. Format: "<uuid-36>-c<digits>" (total length 41 chars).
//
// Algorithm: FNV-1a 32-bit hash of the UUID string → mod 1000 →
// zero-padded 3-digit decimal string. Self-checksum only — not
// public-key bound. Synchronous (Web Crypto's SHA-256 is async, but
// reducers that mint GUIDs are sync, so we use FNV-1a instead).
//
// Filtering is the goal, not security: random typos / scanner bots
// have a ~1/1000 chance of accidentally passing this check. A
// motivated attacker with access to the JS bundle can compute valid
// checksums, but they could already submit junk with the public key.
// The 200-cap per (studentCode, challengeGuid) is the real ceiling.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Full checksummed GUID: a normal v4 UUID followed by `-c` and 3 digits.
const CHECKSUMMED_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-c\d{3}$/i;

// FNV-1a 32-bit. Operates on UTF-16 code units, which is fine for our
// inputs (hex digits + hyphens are all ASCII). Force unsigned via
// `>>> 0` after each round so JS's signed-int coercion doesn't bite.
function fnv1a32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

// 3-decimal-digit checksum string ("000".."999") for the given UUID.
export function computeGuidChecksum(uuid) {
  return String(fnv1a32(String(uuid)) % 1000).padStart(3, '0');
}

// Returns the full checksummed GUID for a fresh UUID. Throws if the
// input is not a v4 UUID — pass `crypto.randomUUID()` or equivalent.
export function attachGuidChecksum(uuid) {
  if (!UUID_PATTERN.test(String(uuid || ''))) {
    throw new Error('attachGuidChecksum: input is not a v4 UUID.');
  }
  return `${uuid}-c${computeGuidChecksum(uuid)}`;
}

// Split a checksummed GUID into `{ uuid, checksum }`, or return null
// if `full` is not in the expected shape.
export function splitGuidChecksum(full) {
  if (!CHECKSUMMED_PATTERN.test(String(full || ''))) return null;
  const s = String(full);
  return { uuid: s.slice(0, 36), checksum: s.slice(38) };
}

// Verify that a fully-formed checksummed GUID's suffix matches the
// hash of its UUID prefix. Returns false on shape mismatch too.
export function verifyGuidChecksum(full) {
  const parts = splitGuidChecksum(full);
  if (!parts) return false;
  return computeGuidChecksum(parts.uuid) === parts.checksum;
}

export { UUID_PATTERN, CHECKSUMMED_PATTERN };
