// Password-derived AES-GCM helpers, used to encrypt the teacher's
// keydetails JSON when they opt in to password-protection.
//
// Flow:
//   plaintext (JSON string of {publicKeyJwk, privateKeyJwk})
//     ──PBKDF2(SHA-256, 250 000 iters, 16-byte salt)──▶ 256-bit AES key
//     ──AES-GCM(12-byte IV)──▶ ciphertext
//   stored: { salt, iv, ciphertext } (each base64, no Uint8Array leakage)
//
// We reuse the same Web Crypto primitives the existing envelope.js code
// uses for RSA-OAEP-wrapped AES-GCM; the only new primitive here is
// PBKDF2 key derivation.

import { bytesToBase64, base64ToBytes } from './base64.js';

const PBKDF2_ITERATIONS = 250000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

function requireSubtle() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('This browser does not support Web Crypto (subtle).');
  }
  return crypto.subtle;
}

function randomBytes(n) {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

async function deriveAesKey(password, saltBytes, iterations = PBKDF2_ITERATIONS) {
  const subtle = requireSubtle();
  const baseKey = await subtle.importKey(
    'raw', enc.encode(String(password ?? '')),
    { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts `plaintext` (a JSON-serialisable value) with a key derived
 * from `password`. Returns `{ salt, iv, ciphertext }`, each base64.
 */
export async function encryptPlaintextWithPassword(plaintext, password) {
  const subtle = requireSubtle();
  const salt = randomBytes(SALT_BYTES);
  const iv   = randomBytes(IV_BYTES);
  const key  = await deriveAesKey(password, salt);
  const data = enc.encode(typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext));
  const ciphertext = new Uint8Array(await subtle.encrypt(
    { name: 'AES-GCM', iv }, key, data,
  ));
  return {
    salt:       bytesToBase64(salt),
    iv:         bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Decrypts the envelope produced by `encryptPlaintextWithPassword`.
 * Returns the parsed JSON (or raw string if not JSON).
 *
 * Throws on any decryption / parse failure — typically because the
 * password was wrong (AES-GCM auth tag mismatch).
 */
export async function decryptCiphertextWithPassword(envelope, password) {
  const subtle = requireSubtle();
  if (!envelope?.salt || !envelope?.iv || !envelope?.ciphertext) {
    throw new Error('Encrypted blob is missing salt/iv/ciphertext.');
  }
  const salt = base64ToBytes(envelope.salt);
  const iv   = base64ToBytes(envelope.iv);
  const ct   = base64ToBytes(envelope.ciphertext);
  const iters = Number(envelope.iterations) || PBKDF2_ITERATIONS;
  const key = await deriveAesKey(password, salt, iters);
  let plain;
  try {
    plain = new Uint8Array(await subtle.decrypt(
      { name: 'AES-GCM', iv }, key, ct,
    ));
  } catch (err) {
    throw new Error('Decryption failed — most likely the password was wrong.');
  }
  const text = dec.decode(plain);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Raw-bytes variant of the PBKDF2 derivation. Used by the
 * submission-verifier helper to produce a deterministic 32-byte
 * value that can be base64-encoded and shipped as a verifier
 * string. `salt` is a `Uint8Array`; `outBytes` is the desired
 * length in bytes (default 32 = 256 bits).
 */
export async function derivePbkdf2Bytes(password, saltBytes, iterations = PBKDF2_ITERATIONS, outBytes = 32) {
  const subtle = requireSubtle();
  const baseKey = await subtle.importKey(
    'raw', enc.encode(String(password ?? '')),
    { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    outBytes * 8,
  );
  return new Uint8Array(bits);
}

export { PBKDF2_ITERATIONS };
