// Deterministic short identifier for a teacher's RSA public key.
// Used by the Codehooks backend as the routing/scope key for results,
// teacher sessions, and the optional per-teacher pw_settings doc.
//
// Replaces the previous `classCode` routing key — see plan
// `Decouple Codehooks backend from class lists` — so a teacher can
// hand the same challenges book to multiple classes without any
// per-class setup.
//
// Algorithm: first 32 hex chars of sha256(publicKey.n)  (128 bits).
// 128 bits has more than enough collision resistance for any
// realistic teacher population, while staying short enough to fit
// in a URL query string without bloat.

const enc = new TextEncoder();

async function sha256Hex(text) {
  if (!(typeof crypto !== 'undefined' && crypto.subtle)) {
    throw new Error('Web Crypto SHA-256 is not available in this browser.');
  }
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  const view = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    const v = view[i] & 0xff;
    hex += (v < 16 ? '0' : '') + v.toString(16);
  }
  return hex;
}

/**
 * Returns the 32-hex-char fingerprint of a teacher's public-key
 * modulus. Throws when the JWK is missing or has no `n` field.
 */
export async function derivePubFingerprint(publicKeyJwk) {
  const n = String(publicKeyJwk?.n || '').trim();
  if (!n) throw new Error('derivePubFingerprint: publicKeyJwk.n required.');
  const hex = await sha256Hex(n);
  return hex.slice(0, 32);
}

// Exposed for the backend regex matching this shape.
export const PUB_FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/i;
