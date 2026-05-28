// Browser-side client for the per-class Apps Script Web App.
//
// Two operations:
//   - postToAppsScript(url, body)     — student submission. POSTs JSON.
//   - fetchFromAppsScript(url, opts)  — teacher analyse fetch. GETs JSON.
//   - pingAppsScript(url)             — cheap reachability check.
//
// Apps Script Web Apps run on script.google.com/macros and redirect to
// script.googleusercontent.com. fetch follows the redirect natively.
// We deliberately use Content-Type: text/plain on POST so we avoid a
// CORS preflight (the script reads the body as JSON regardless via
// `e.postData.contents`).

const DEFAULT_TIMEOUT_MS = 15000;

function normaliseUrl(url) {
  return String(url || '').trim();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (typeof fetch !== 'function') {
    throw new Error('This browser does not support fetch.');
  }
  let controller = null;
  let timer = null;
  if (timeoutMs && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  try {
    return await fetch(url, { ...options, signal: controller?.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Apps Script request timed out.');
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch {
    throw new Error('Apps Script returned non-JSON: ' + text.slice(0, 200));
  }
}

/**
 * Student → Apps Script POST.
 *
 * The Apps Script's doPost expects:
 *   {
 *     studentCodeHash, wrappedStudentCode, secret,
 *     challengeGuid, challengeFileGuid, passed,
 *     encryptedSolution, submittedAt,
 *     tkn (Turnstile token, may be empty in dev)
 *   }
 *
 * `secret` is `publicKeyFp + studentCodeHash` — proves the submitter
 * has read the challenges JSON for this teacher. The plaintext
 * 6-digit code never crosses the wire; the backend only ever sees
 * the hash + the RSA-OAEP-wrapped form.
 */
export async function postToAppsScript(url, {
  publicKeyFp, studentCodeHash, wrappedStudentCode,
  challengeGuid, challengeFileGuid,
  passed,
  encryptedSolution, submittedAt, turnstileToken,
}) {
  if (!publicKeyFp)         throw new Error('publicKeyFp required for Google Drive submission.');
  if (!studentCodeHash)     throw new Error('studentCodeHash required for Google Drive submission.');
  if (!wrappedStudentCode)  throw new Error('wrappedStudentCode required for Google Drive submission.');
  if (!challengeFileGuid)   throw new Error('challengeFileGuid required for Google Drive submission.');
  if (!challengeGuid)       throw new Error('challengeGuid required for Google Drive submission.');
  const body = {
    studentCodeHash,
    wrappedStudentCode,
    challengeGuid,
    challengeFileGuid,
    secret: String(publicKeyFp) + String(studentCodeHash),
    passed: !!passed,
    encryptedSolution,
    submittedAt,
    tkn: turnstileToken ?? '',
  };
  const response = await fetchWithTimeout(normaliseUrl(url), {
    method: 'POST',
    // text/plain avoids the CORS preflight that script.google.com rejects.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error('Apps Script POST failed (' + response.status + ').');
  }
  const result = await readJson(response);
  if (result?.status && result.status !== 'success') {
    // `cap_reached` is informative, not a server error — caller can choose to log it but not retry.
    const err = new Error('Apps Script rejected the submission: ' + result.status);
    err.appsScriptStatus = result.status;
    throw err;
  }
  return result ?? {};
}

/**
 * Teacher → Apps Script GET. Returns `{ rows: [...] }` where each row
 * is `{ submittedAt, studentCodeHash, wrappedStudentCode,
 * challengeGuid, submissionCount, firstAttemptPassed, latestPassed,
 * encryptedSolution }`. The caller (AnalysePanel) RSA-decrypts
 * `wrappedStudentCode` locally to recover the original 6-digit code.
 *
 * `challengeFileGuid` scopes the fetch to one challenge book — the
 * script keeps one spreadsheet per book.
 */
export async function fetchFromAppsScript(url, { adminToken, challengeFileGuid, pwVerifier }) {
  if (!adminToken) throw new Error('Missing admin token for Apps Script fetch.');
  if (!challengeFileGuid) throw new Error('Missing challengeFileGuid for Apps Script fetch.');
  const params = { adminKey: adminToken, challengeFileGuid };
  // Only attach pwVerifier when the local keydetails was
  // password-protected. The Apps Script's empty SUBMISSION_VERIFIER
  // constant disables enforcement when not set.
  if (pwVerifier) params.pwVerifier = pwVerifier;
  const qs = new URLSearchParams(params).toString();
  const response = await fetchWithTimeout(normaliseUrl(url) + '?' + qs, {
    method: 'GET',
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error('Apps Script GET failed (' + response.status + ').');
  }
  const result = await readJson(response);
  if (result?.status && result.status !== 'success' && !Array.isArray(result.rows)) {
    throw new Error('Apps Script rejected the fetch: ' + result.status);
  }
  return result ?? { rows: [] };
}

/**
 * Liveness ping. The script's doGet recognises `?ping=1` and returns
 * `{status: 'ok'}` without requiring an admin token, so we can verify
 * URL + deployment before the teacher has finished plumbing keys.
 */
export async function pingAppsScript(url) {
  const response = await fetchWithTimeout(
    normaliseUrl(url) + '?ping=1',
    { method: 'GET', redirect: 'follow' },
  );
  if (!response.ok) {
    throw new Error('Apps Script ping failed (' + response.status + ').');
  }
  return readJson(response);
}
