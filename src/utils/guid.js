// UUID v4 generator with a 3-decimal-digit FNV-1a checksum suffix
// for backend filtering of stray / forged IDs.
// Format: "<uuid-36>-c<digits>" (41 chars total). See
// src/utils/guidChecksum.js for the algorithm.

import { attachGuidChecksum, CHECKSUMMED_PATTERN } from './guidChecksum.js';

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
  return typeof value === 'string' && CHECKSUMMED_PATTERN.test(value);
}
