// Browser-side client for the KaraWeb cloud-save codehooks backend.
//
// All functions take an `apiBaseUrl` so the same module is reusable for
// teacher and student flows. Network errors and non-2xx responses throw
// with a human-readable message.

const DEFAULT_TIMEOUT_MS = 15000;

function normaliseBaseUrl(url) {
  return String(url || '').replace(/\/+$/g, '');
}

async function fetchJson(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
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
    const r = await fetch(url, {
      ...options,
      signal: controller?.signal,
      cache: 'no-store',
    });
    let body = null;
    const text = await r.text();
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!r.ok) {
      const reason = body?.error || text || `HTTP ${r.status}`;
      const err = new Error(`Backend error: ${reason}`);
      err.status = r.status;
      throw err;
    }
    return body;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Request timed out.');
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function healthCheck(apiBaseUrl) {
  const base = normaliseBaseUrl(apiBaseUrl);
  return fetchJson(base + '/api/public/health', { method: 'GET' });
}

// `/class/register` no longer exists — the backend now identifies a
// teacher purely by the public-key fingerprint they supply at
// /teacher/challenge time.

export async function teacherChallenge(apiBaseUrl, { publicKeyJwk, pwVerifier }) {
  const base = normaliseBaseUrl(apiBaseUrl);
  const body = { publicKeyJwk };
  if (pwVerifier) body.pwVerifier = pwVerifier;
  return fetchJson(base + '/api/public/teacher/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function teacherSession(apiBaseUrl, { challengeId, nonce }) {
  const base = normaliseBaseUrl(apiBaseUrl);
  return fetchJson(base + '/api/public/teacher/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, nonce }),
  });
}

export async function fetchTeacherResults(apiBaseUrl, bearerToken, opts = {}) {
  const base = normaliseBaseUrl(apiBaseUrl);
  const qs = opts.challengeFileGuid
    ? '?challengeFileGuid=' + encodeURIComponent(opts.challengeFileGuid)
    : '';
  return fetchJson(
    base + '/api/public/teacher/results' + qs,
    { method: 'GET', headers: { Authorization: 'Bearer ' + bearerToken } },
  );
}

export async function deleteTeacherResult(apiBaseUrl, recordId, bearerToken) {
  const base = normaliseBaseUrl(apiBaseUrl);
  return fetchJson(
    base + '/api/public/teacher/results/' + encodeURIComponent(recordId),
    { method: 'DELETE', headers: { Authorization: 'Bearer ' + bearerToken } },
  );
}

export async function postResult(apiBaseUrl, {
  pubFingerprint, challengeFileGuid,
  studentCodeHash, wrappedStudentCode,
  challengeGuid, passed,
  encryptedPayload, submittedAt, turnstileToken,
}) {
  const base = normaliseBaseUrl(apiBaseUrl);
  return fetchJson(base + '/api/public/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubFingerprint,
      challengeFileGuid,
      studentCodeHash,
      wrappedStudentCode,
      challengeGuid,
      passed,
      encryptedPayload,
      submittedAt,
      turnstileToken: turnstileToken ?? '',
    }),
  });
}
