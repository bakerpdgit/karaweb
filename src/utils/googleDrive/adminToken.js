// Admin token helpers for the Google-Drive backend.
//
// The Apps Script doGet endpoint requires `?adminKey=<ADMIN_TOKEN>`.
// We derive the token deterministically from the teacher's RSA private
// exponent (`privateKeyJwk.d`), then store its sha256 inside the
// generated script. So the URL only ever carries one layer of hashing,
// and the raw private exponent never travels.
//
// Both halves use the same hex encoding of sha256(...) so that the
// Apps Script's `Utilities.computeDigest('SHA_256', value)` produces an
// identical string.

const enc = new TextEncoder();

function bytesToHex(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function sha256Hex(text) {
  if (!(typeof crypto !== 'undefined' && crypto.subtle)) {
    throw new Error('Web Crypto SHA-256 is not available in this browser.');
  }
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return bytesToHex(digest);
}

/**
 * The "outer" admin token — what the teacher's analyse tab sends in
 * `?adminKey=...`. Anyone with the private key can recompute it.
 */
export async function computeAdminToken(privateKeyJwk) {
  if (!privateKeyJwk?.d) {
    throw new Error('Private key JWK has no `d` field.');
  }
  return sha256Hex(privateKeyJwk.d);
}

/**
 * The "inner" hash — what the script source stores. The script computes
 * sha256(adminKey from request) and compares to this value. A script
 * source leak gives an attacker only this hash; they cannot reverse it
 * back to the outer token.
 */
export async function computeAdminTokenHash(privateKeyJwk) {
  const outer = await computeAdminToken(privateKeyJwk);
  return sha256Hex(outer);
}
