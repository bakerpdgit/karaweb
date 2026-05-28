// Hybrid envelope encryption: RSA-OAEP-wrapped AES-256-GCM.
//
// Mirrors unitesterdemo's "unitester-result-hybrid-v1" format so the
// codehooks backend's existing encryption pattern can be reused.
//
// Envelope text layout:
//   "KaraWeb Cloud Save\n" + JSON.stringify({
//     format:       "karaweb-result-hybrid-v1",
//     algorithm:    "RSA-OAEP-256+A256GCM",
//     encryptedKey: <base64 RSA-OAEP-wrapped 256-bit AES key>,
//     iv:           <base64 12-byte AES-GCM nonce>,
//     ciphertext:   <base64 AES-GCM ciphertext (incl. auth tag)>,
//   })

import { bytesToBase64, base64ToBytes } from './base64.js';
import { importPublicKey, importPrivateKey } from './rsaOaep.js';

const ENVELOPE_FORMAT = 'karaweb-result-hybrid-v1';
const ENVELOPE_HEADER = 'KaraWeb Cloud Save';

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

export async function encryptForPublicKey(payload, publicKeyJwk) {
  const subtle = requireSubtle();
  const aesRaw = randomBytes(32);
  const iv = randomBytes(12);

  const aesKey = await subtle.importKey(
    'raw', aesRaw, { name: 'AES-GCM' }, false, ['encrypt'],
  );
  const ciphertext = new Uint8Array(await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(JSON.stringify(payload)),
  ));

  const pub = await importPublicKey(publicKeyJwk);
  const encryptedKey = new Uint8Array(await subtle.encrypt(
    { name: 'RSA-OAEP' }, pub, aesRaw,
  ));

  const envelope = {
    format: ENVELOPE_FORMAT,
    algorithm: 'RSA-OAEP-256+A256GCM',
    encryptedKey: bytesToBase64(encryptedKey),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
  return ENVELOPE_HEADER + '\n' + JSON.stringify(envelope);
}

export async function decryptWithPrivateKey(envelopeText, privateKeyJwk, expectedType) {
  const subtle = requireSubtle();
  const text = String(envelopeText || '');
  const nl = text.indexOf('\n');
  const jsonStart = nl >= 0 ? nl + 1 : 0;
  let envelope;
  try {
    envelope = JSON.parse(text.slice(jsonStart));
  } catch (err) {
    throw new Error('Envelope is not valid JSON: ' + (err?.message ?? err));
  }
  if (!envelope || envelope.format !== ENVELOPE_FORMAT) {
    throw new Error('Envelope format is not karaweb-result-hybrid-v1.');
  }
  const priv = await importPrivateKey(privateKeyJwk);
  const aesRaw = new Uint8Array(await subtle.decrypt(
    { name: 'RSA-OAEP' }, priv, base64ToBytes(envelope.encryptedKey),
  ));
  const aesKey = await subtle.importKey(
    'raw', aesRaw, { name: 'AES-GCM' }, false, ['decrypt'],
  );
  const plain = new Uint8Array(await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
    aesKey,
    base64ToBytes(envelope.ciphertext),
  ));
  const payload = JSON.parse(dec.decode(plain));
  if (expectedType && payload?.type !== expectedType) {
    throw new Error(`Envelope payload type mismatch (got ${payload?.type ?? 'null'}).`);
  }
  return payload;
}

export { ENVELOPE_FORMAT, ENVELOPE_HEADER };
