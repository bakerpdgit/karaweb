// Deterministic verifier derived from the teacher's keydetails
// password, used by the cloud backends to confirm the caller knew
// the password. NOT the password itself — backends store and
// receive only this derived value.
//
// Algorithm:
//   verifier = base64( PBKDF2-SHA256(
//     password,
//     salt   = utf8(publicKeyJwk.n),    // unique per teacher, public
//     iters  = 100_000,
//     bytes  = 32,
//   ) )
//
// Properties:
//   - Deterministic per (password, publicKeyJwk.n) → identical
//     verifier every time, comparable with plain `===`.
//   - 32 bytes (256 bits) of entropy bound by PBKDF2 → ~years of
//     compute to brute-force a curated-alphabet 8-char password
//     even if the verifier itself leaks.
//   - Bound to the teacher's public key — a leak from teacher A's
//     verifier can't be reused against teacher B's script.

import { derivePbkdf2Bytes } from './crypto/passwordKey.js';
import { bytesToBase64 } from './crypto/base64.js';

const enc = new TextEncoder();
const VERIFIER_ITERATIONS = 100_000;
const VERIFIER_BYTES = 32;

/**
 * Derive the submission verifier from the teacher's password +
 * public-key JWK. Returns a base64 string. Throws if either input
 * is missing.
 */
export async function deriveSubmissionVerifier(password, publicKeyJwk) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('deriveSubmissionVerifier: password required.');
  }
  if (!publicKeyJwk?.n || typeof publicKeyJwk.n !== 'string') {
    throw new Error('deriveSubmissionVerifier: publicKeyJwk.n required.');
  }
  const salt = enc.encode(publicKeyJwk.n);
  const bytes = await derivePbkdf2Bytes(password, salt, VERIFIER_ITERATIONS, VERIFIER_BYTES);
  return bytesToBase64(bytes);
}

export { VERIFIER_ITERATIONS, VERIFIER_BYTES };
