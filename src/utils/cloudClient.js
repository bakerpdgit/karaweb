// Backend-agnostic facade for cloud save.
//
// Looks at `loadedCloudSave.method` ('codehooks' | 'google-drive') and
// routes to the right per-method client. Keeps the result-submission
// effect in App.jsx and the analyse fetch in AnalysePanel free of
// branching.
//
// Both backends produce envelope-format payloads with the same
// `karaweb-result-v1` shape, so the decrypt + aggregate pipeline does
// not need to change between methods.

import { postResult as postResultToCodehooks } from './codehooksClient.js';
import { fetchTeacherResults } from './codehooksClient.js';
import { ensureTeacherSession } from './teacherSession.js';
import { postToAppsScript, fetchFromAppsScript } from './googleDrive/googleDriveClient.js';
import { computeAdminToken } from './googleDrive/adminToken.js';
import { derivePubFingerprint } from './pubFingerprint.js';
import { studentCodeDedupHash } from './studentCodes.js';
import { encryptForPublicKey } from './crypto/envelope.js';

function methodOf(loadedCloudSave) {
  // Default to codehooks for back-compat with v1 cloud-save blocks.
  return loadedCloudSave?.method === 'google-drive' ? 'google-drive' : 'codehooks';
}

/**
 * Submit a result on behalf of a student.
 *
 * @param loadedCloudSave  the cloudSave block from the loaded challenges file
 * @param body             {
 *   studentCode,
 *   challengeGuid,                    // (google-drive) — required
 *   passed,                            // (google-drive) — required
 *   encryptedPayload | encryptedSolution,
 *   submittedAt,
 *   turnstileToken,
 * }
 */
export async function postCloudResult(loadedCloudSave, body) {
  if (!loadedCloudSave?.apiBaseUrl) {
    throw new Error('Cloud save is not configured for this file.');
  }
  if (!loadedCloudSave.publicKeyJwk?.n) {
    throw new Error('Cloud-save block missing publicKeyJwk.');
  }
  if (!loadedCloudSave.challengeFileGuid) {
    throw new Error('Cloud-save block missing challengeFileGuid.');
  }
  if (!body.studentCode) {
    throw new Error('postCloudResult requires the plaintext studentCode.');
  }
  // Privacy: the plaintext 6-digit code never leaves this function.
  // We send a 16-hex pseudonym for dedup + an RSA-OAEP envelope so
  // the teacher can recover the original locally.
  const studentCodeHash    = await studentCodeDedupHash(loadedCloudSave.publicKeyJwk.n, body.studentCode);
  const wrappedStudentCode = await encryptForPublicKey(
    { type: 'karaweb-studentcode-v1', studentCode: String(body.studentCode) },
    loadedCloudSave.publicKeyJwk,
  );
  const method = methodOf(loadedCloudSave);
  if (method === 'codehooks') {
    const pubFingerprint = await derivePubFingerprint(loadedCloudSave.publicKeyJwk);
    return postResultToCodehooks(loadedCloudSave.apiBaseUrl, {
      pubFingerprint,
      challengeFileGuid: loadedCloudSave.challengeFileGuid,
      studentCodeHash,
      wrappedStudentCode,
      challengeGuid: body.challengeGuid,
      passed: body.passed,
      encryptedPayload: body.encryptedPayload ?? body.encryptedSolution,
      submittedAt: body.submittedAt,
      turnstileToken: body.turnstileToken ?? '',
    });
  }
  // google-drive
  const publicKeyFp = await derivePubFingerprint(loadedCloudSave.publicKeyJwk);
  return postToAppsScript(loadedCloudSave.apiBaseUrl, {
    publicKeyFp,
    studentCodeHash,
    wrappedStudentCode,
    challengeGuid: body.challengeGuid,
    challengeFileGuid: loadedCloudSave.challengeFileGuid,
    passed: body.passed,
    encryptedSolution: body.encryptedPayload ?? body.encryptedSolution,
    submittedAt: body.submittedAt,
    turnstileToken: body.turnstileToken ?? '',
  });
}

/**
 * Fetch every result for the loaded class so the teacher can decrypt /
 * aggregate locally.
 *
 * @param loadedCloudSave    { apiBaseUrl, classCode, method, ... }
 * @param ctx                { privateKeyJwk } — required for both methods
 *                           (codehooks: needed to decrypt the auth challenge;
 *                           google-drive: needed to derive the admin token).
 *
 * Returns `[{ encryptedPayload }]` — caller decrypts each one.
 */
export async function fetchCloudResults(loadedCloudSave, ctx) {
  if (!loadedCloudSave?.apiBaseUrl) {
    throw new Error('Cloud save is not configured for this file.');
  }
  if (!ctx?.privateKeyJwk) {
    throw new Error('Private key required to fetch cloud results.');
  }
  const method = methodOf(loadedCloudSave);
  if (method === 'codehooks') {
    if (!loadedCloudSave.publicKeyJwk?.n) {
      throw new Error('Codehooks cloud-save block missing publicKeyJwk.');
    }
    const token = await ensureTeacherSession({
      apiBaseUrl: loadedCloudSave.apiBaseUrl,
      publicKeyJwk: loadedCloudSave.publicKeyJwk,
      privateKeyJwk: ctx.privateKeyJwk,
      pwVerifier: ctx.submissionVerifier,
    });
    const fetched = await fetchTeacherResults(
      loadedCloudSave.apiBaseUrl,
      token,
      { challengeFileGuid: loadedCloudSave.challengeFileGuid },
    );
    // Mirror the google-drive shape: one row per
    // (studentCodeHash, challengeGuid) with cleartext metadata so the
    // Analyse grid can render. The 6-digit code is recovered by
    // decrypting wrappedStudentCode in AnalysePanel.
    const rows = (fetched?.results ?? []).map(r => ({
      studentCodeHash:    r.studentCodeHash,
      wrappedStudentCode: r.wrappedStudentCode,
      challengeGuid:      r.challengeGuid,
      submissionCount:    Number(r.submissionCount) || 0,
      firstAttemptPassed: !!r.firstAttemptPassed,
      latestPassed:       !!r.latestPassed,
      submittedAt:        r.submittedAt,
      encryptedPayload:   r.encryptedPayload,
      encryptedSolution:  r.encryptedPayload,
    }));
    return { rows, prunedRows: 0 };
  }
  // google-drive — derive admin token from the private key.
  if (!loadedCloudSave.challengeFileGuid) {
    throw new Error('Google Drive cloud-save block missing challengeFileGuid.');
  }
  const adminToken = await computeAdminToken(ctx.privateKeyJwk);
  const fetched = await fetchFromAppsScript(loadedCloudSave.apiBaseUrl, {
    adminToken,
    challengeFileGuid: loadedCloudSave.challengeFileGuid,
    pwVerifier: ctx.submissionVerifier,
  });
  // Returns one row per (studentCodeHash, challengeGuid). The
  // 6-digit code is recovered by RSA-OAEP-decrypting
  // wrappedStudentCode in AnalysePanel (cached per hash).
  const rows = (fetched?.rows ?? []).map(r => ({
    studentCodeHash:    r.studentCodeHash,
    wrappedStudentCode: r.wrappedStudentCode,
    challengeGuid:      r.challengeGuid,
    submissionCount:    r.submissionCount ?? 0,
    firstAttemptPassed: !!r.firstAttemptPassed,
    latestPassed:       !!r.latestPassed,
    submittedAt:        r.submittedAt,
    encryptedPayload:   r.encryptedSolution,    // keep legacy field name for the analyse decrypt path
    encryptedSolution:  r.encryptedSolution,
  }));
  return { rows, prunedRows: Number(fetched?.prunedRows ?? 0) };
}

/**
 * Cheap reachability test that does not require any auth.
 *  - codehooks: GET /api/public/health
 *  - google-drive: GET ?ping=1 (script returns a small JSON)
 */
export async function pingCloudBackend(loadedCloudSave) {
  // Importing healthCheck lazily so this file does not pull in everything
  // when only the post path is needed.
  if (methodOf(loadedCloudSave) === 'codehooks') {
    const { healthCheck } = await import('./codehooksClient.js');
    return healthCheck(loadedCloudSave.apiBaseUrl);
  }
  const { pingAppsScript } = await import('./googleDrive/googleDriveClient.js');
  return pingAppsScript(loadedCloudSave.apiBaseUrl);
}
