// Teacher session helpers: run the backend's challenge/response auth
// dance using the private key from keydetails, then cache the returned
// bearer token in memory for the lifetime of the page.
//
// Scoping is now per-teacher (per-publicKey-fingerprint), not per
// class. The same session covers any number of books the teacher has
// open against this backend.

import { decryptWithPrivateKey } from './crypto/envelope.js';
import { teacherChallenge, teacherSession } from './codehooksClient.js';
import { derivePubFingerprint } from './pubFingerprint.js';

// Per-pubFingerprint in-memory cache. The bearer token is short-lived
// (~2h); we re-issue it transparently when expired.
const sessions = new Map(); // pubFingerprint -> { sessionToken, expiresAt, pubFingerprint }

export function clearTeacherSession(pubFingerprint) {
  if (pubFingerprint) sessions.delete(pubFingerprint);
  else sessions.clear();
}

function isUsable(s) {
  if (!s?.sessionToken) return false;
  const expiry = new Date(s.expiresAt || 0).getTime();
  return expiry > Date.now() + 30_000;   // 30s safety margin
}

export async function ensureTeacherSession({ apiBaseUrl, publicKeyJwk, privateKeyJwk, pwVerifier }) {
  if (!apiBaseUrl || !publicKeyJwk || !privateKeyJwk) {
    throw new Error('Missing api/key for teacher session.');
  }
  const pubFingerprint = await derivePubFingerprint(publicKeyJwk);
  const cached = sessions.get(pubFingerprint);
  if (isUsable(cached)) return cached.sessionToken;

  // pwVerifier is forwarded to /teacher/challenge — the backend
  // rejects challenge requests when a pub_settings doc exists for
  // this pubFingerprint with a different stored submissionVerifier
  // (trust-on-first-use). Bearer-only checks cover subsequent
  // endpoints.
  const challenge = await teacherChallenge(apiBaseUrl, { publicKeyJwk, pwVerifier });
  if (!challenge?.encryptedChallenge || !challenge?.challengeId) {
    throw new Error('Backend did not return a teacher challenge.');
  }
  const decoded = await decryptWithPrivateKey(
    challenge.encryptedChallenge,
    privateKeyJwk,
    'karaweb-teacher-challenge',
  );
  if (!decoded?.nonce || decoded.pubFingerprint !== pubFingerprint) {
    throw new Error('Decrypted challenge did not match the public key.');
  }
  const sess = await teacherSession(apiBaseUrl, {
    challengeId: challenge.challengeId,
    nonce: decoded.nonce,
  });
  if (!sess?.sessionToken) {
    throw new Error('Backend did not return a session token.');
  }
  sessions.set(pubFingerprint, { ...sess, pubFingerprint });
  return sess.sessionToken;
}
