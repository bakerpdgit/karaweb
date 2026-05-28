// RSA-OAEP key pair helpers. Adapted from unitesterdemo/shared.js.

function requireCrypto() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('This browser does not support Web Crypto (subtle).');
  }
  return crypto.subtle;
}

const ALG = { name: 'RSA-OAEP', hash: 'SHA-256' };

// Generate a 4096-bit RSA-OAEP key pair. Returns the keys in JWK form
// (plain JSON objects) — convenient to embed in JSON files and to send
// over the wire as part of the encrypted-challenge dance.
export async function generateKeyPair() {
  const subtle = requireCrypto();
  const pair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    true,                  // exportable
    ['encrypt', 'decrypt'],
  );
  const publicKeyJwk  = await subtle.exportKey('jwk', pair.publicKey);
  const privateKeyJwk = await subtle.exportKey('jwk', pair.privateKey);
  return { publicKeyJwk, privateKeyJwk };
}

export async function importPublicKey(publicKeyJwk) {
  const subtle = requireCrypto();
  return subtle.importKey('jwk', publicKeyJwk, ALG, false, ['encrypt']);
}

export async function importPrivateKey(privateKeyJwk) {
  const subtle = requireCrypto();
  return subtle.importKey('jwk', privateKeyJwk, ALG, false, ['decrypt']);
}

// True if the value looks like a public RSA JWK with the expected shape.
export function isPublicKeyJwk(value) {
  return !!(value
    && typeof value === 'object'
    && value.kty === 'RSA'
    && typeof value.n === 'string'
    && typeof value.e === 'string');
}

// True if the value looks like a private RSA JWK (has the `d` field).
export function isPrivateKeyJwk(value) {
  return isPublicKeyJwk(value) && typeof value.d === 'string';
}
