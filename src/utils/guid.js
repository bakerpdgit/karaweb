// UUID v4 generator with a 3-decimal-digit FNV-1a checksum suffix
// for backend filtering of stray / forged IDs.
// Format: "<uuid-36>-c<digits>" (41 chars total). See
// src/utils/guidChecksum.js for the algorithm.

import { attachGuidChecksum, verifyGuidChecksum } from './guidChecksum.js';

function randomUuidV4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export function newGuid() {
  return attachGuidChecksum(randomUuidV4());
}

export function isGuid(value) {
  return verifyGuidChecksum(value);
}

function fnv1a32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

function deterministicUuidV4(input) {
  const bytes = [];
  for (let salt = 0; salt < 4; salt++) {
    const h = fnv1a32(`${salt}:${input}`);
    bytes.push(
      (h >>> 24) & 0xff,
      (h >>> 16) & 0xff,
      (h >>> 8) & 0xff,
      h & 0xff,
    );
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export function normaliseGuid(value, namespace = 'legacy') {
  const s = String(value || '').trim();
  if (!s) return '';
  if (isGuid(s)) return s;
  return attachGuidChecksum(deterministicUuidV4(`${namespace}:${s}`));
}
