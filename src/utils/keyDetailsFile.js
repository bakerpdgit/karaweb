// Per-teacher keydetails file. Three formats are recognised:
//
// v1 (legacy) — bundled keypair + classCode + students. Imported into
//   per-teacher state plus a separate class-list entry.
//
// v2 — keypair only, plaintext.
//   { format: "karaweb-keydetails-v2", createdAt, publicKeyJwk,
//     privateKeyJwk, instructions: [...] }
//
// v3 — keypair, optionally with the *private* key encrypted under a
//      password-derived AES-GCM key. The public key always stays in
//      plaintext alongside the encrypted blob so cloud-save flows that
//      only need the public key keep working without a password
//      prompt.
//   { format: "karaweb-keydetails-v3-encrypted",
//     createdAt, publicKeyJwk,
//     encryptedKeyPair: { salt, iv, ciphertext, iterations },
//     instructions: [...] }
//
// Backward compatibility: v1 and v2 files load with no prompt;
// `parseKeyDetailsFile` surfaces an `encryptedKeyPair` field only for
// v3 so the loader knows to prompt for a password before unlocking.

import { isPublicKeyJwk, isPrivateKeyJwk } from './crypto/rsaOaep.js';
import { isClassCode } from './classCode.js';
import {
  encryptPlaintextWithPassword,
  decryptCiphertextWithPassword,
} from './crypto/passwordKey.js';

export const KEYDETAILS_FORMAT_V3 = 'karaweb-keydetails-v3-encrypted';
export const KEYDETAILS_FORMAT_V2 = 'karaweb-keydetails-v2';
export const KEYDETAILS_FORMAT_V1 = 'karaweb-keydetails-v1';

const INSTRUCTIONS = [
  'KEEP THIS FILE SAFE. It contains your private RSA key.',
  'Anyone with this file (plus your password, if you set one) can decrypt all the student submissions you receive.',
  'You only need ONE keydetails file. Use it across every class and every challenge book.',
  'Do NOT paste this file into your Apps Script. Use the public-key script that KaraWeb generates.',
  'Re-upload this file into KaraWeb on any device where you want to view results.',
];

const ENCRYPTED_INSTRUCTIONS = [
  ...INSTRUCTIONS,
  'This file is PASSWORD-PROTECTED. You will need the password you set in KaraWeb to decrypt it. Lose the password and the file becomes useless — there is no reset.',
];

/**
 * Build a plain-text v2 keydetails file (no password) or a v3
 * encrypted file when `password` is non-empty. `publicKeyJwk` is
 * always written in the clear so cloud-save flows can use it without
 * prompting.
 */
export async function buildKeyDetailsFile({ publicKeyJwk, privateKeyJwk, password }) {
  if (!isPublicKeyJwk(publicKeyJwk))  throw new Error('Invalid public key JWK.');
  if (!isPrivateKeyJwk(privateKeyJwk)) throw new Error('Invalid private key JWK.');
  if (password) {
    const encryptedKeyPair = await encryptPlaintextWithPassword(
      { publicKeyJwk, privateKeyJwk },
      password,
    );
    return {
      format: KEYDETAILS_FORMAT_V3,
      createdAt: new Date().toISOString(),
      publicKeyJwk,
      encryptedKeyPair,
      instructions: ENCRYPTED_INSTRUCTIONS,
    };
  }
  return {
    format: KEYDETAILS_FORMAT_V2,
    createdAt: new Date().toISOString(),
    publicKeyJwk,
    privateKeyJwk,
    instructions: INSTRUCTIONS,
  };
}

/**
 * Parse a keydetails file. v1 + v2 return `{publicKeyJwk, privateKeyJwk}`
 * directly; v3 returns `{publicKeyJwk, encryptedKeyPair}` and the
 * caller must call `unlockKeyDetailsFile(encryptedKeyPair, password)`
 * to actually get the private key.
 */
export function parseKeyDetailsFile(raw) {
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!obj || ![KEYDETAILS_FORMAT_V1, KEYDETAILS_FORMAT_V2, KEYDETAILS_FORMAT_V3].includes(obj.format)) {
    throw new Error('This is not a KaraWeb keydetails file (wrong format).');
  }
  // v3: only the public key is in the clear; the private key is sealed.
  if (obj.format === KEYDETAILS_FORMAT_V3) {
    if (!isPublicKeyJwk(obj.publicKeyJwk)) {
      throw new Error('Encrypted keydetails file is missing a valid public key.');
    }
    if (!obj.encryptedKeyPair?.salt || !obj.encryptedKeyPair?.iv || !obj.encryptedKeyPair?.ciphertext) {
      throw new Error('Encrypted keydetails file is missing salt/iv/ciphertext.');
    }
    return {
      format: obj.format,
      createdAt: obj.createdAt ?? null,
      publicKeyJwk: obj.publicKeyJwk,
      encryptedKeyPair: obj.encryptedKeyPair,
    };
  }
  // v1 / v2: keypair in the clear.
  if (!isPublicKeyJwk(obj.publicKeyJwk) || !isPrivateKeyJwk(obj.privateKeyJwk)) {
    throw new Error('Keydetails file is missing a valid RSA key pair.');
  }
  const result = {
    format: obj.format,
    createdAt: obj.createdAt ?? null,
    publicKeyJwk:  obj.publicKeyJwk,
    privateKeyJwk: obj.privateKeyJwk,
  };
  // Legacy v1 carries class data.
  if (obj.format === KEYDETAILS_FORMAT_V1) {
    if (isClassCode(obj.classCode)) result.legacyClassCode = obj.classCode;
    if (Array.isArray(obj.students)) {
      result.legacyStudents = obj.students.map(s => ({
        username: String(s.username ?? ''),
        code: String(s.code ?? ''),
        suffixApplied: !!s.suffixApplied,
      }));
    }
  }
  return result;
}

/**
 * Decrypt the encryptedKeyPair from a v3 keydetails file using
 * `password`. Returns `{ publicKeyJwk, privateKeyJwk }`. Throws on
 * bad password.
 */
export async function unlockKeyDetailsFile(encryptedKeyPair, password) {
  const payload = await decryptCiphertextWithPassword(encryptedKeyPair, password);
  if (!isPublicKeyJwk(payload?.publicKeyJwk) || !isPrivateKeyJwk(payload?.privateKeyJwk)) {
    throw new Error('Decrypted blob did not contain a valid RSA key pair — corrupted file?');
  }
  return {
    publicKeyJwk:  payload.publicKeyJwk,
    privateKeyJwk: payload.privateKeyJwk,
  };
}

// Download a keydetails object as `karaweb_keydetails.txt` (no class
// suffix — it's per-teacher now).
export function downloadKeyDetails(keyDetailsObj, filename = 'karaweb_keydetails.txt') {
  const json = JSON.stringify(keyDetailsObj, null, 2);
  const blob = new Blob([json], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
