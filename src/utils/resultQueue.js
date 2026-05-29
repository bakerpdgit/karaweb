// Offline buffer for student result submissions.
//
// When the student's POST fails (network down, backend unreachable,
// etc.) we drop the *already-encrypted* payload into a per-class
// localStorage queue. The next successful submission — or the
// boot-time flush from App.jsx — drains the queue in FIFO order. On
// first failure we stop and re-queue the remainder.
//
// The dispatch to the right backend (codehooks vs google-drive) goes
// through `cloudClient.postCloudResult`, so this module doesn't need
// to know which backend is in use — it only needs the cloudSave block
// per class (apiBaseUrl, classCode, method, publicKeyJwk).

import {
  getQueuedResults, setQueuedResults, pushQueuedResult, clearQueuedResults,
  listQueuedFiles,
} from './localStore.js';
import { postCloudResult } from './cloudClient.js';

export function enqueueResult(classCode, item) {
  return pushQueuedResult(classCode, item);
}

/**
 * Try to send everything queued for `classCode`. Stops at the first
 * failure and re-saves the remaining items. Returns the count of items
 * that drained successfully.
 *
 * `loadedCloudSave` is a cloudSave block (apiBaseUrl, classCode,
 * method, publicKeyJwk) for the given class. If it's missing we skip.
 */
export async function flushQueue(key, loadedCloudSave) {
  if (!loadedCloudSave?.apiBaseUrl) return 0;
  let list = getQueuedResults(key);
  if (!list.length) return 0;
  let sent = 0;
  while (list.length) {
    const next = list[0];
    try {
      await postCloudResult(loadedCloudSave, {
        studentCode: next.studentCode,
        challengeGuid: next.challengeGuid,
        passed: next.passed,
        encryptedPayload: next.encryptedPayload,
        submittedAt: next.submittedAt,
        // Tokens are single-use & short-lived; queued items have no
        // fresh token. Pass empty — Google-Drive backends with
        // TURNSTILE_REQUIRED=true will reject these, but that's
        // unavoidable without re-engaging the widget interactively.
        turnstileToken: '',
      });
      list = list.slice(1);
      sent += 1;
    } catch {
      // Network or backend still failing; save remaining and abort.
      setQueuedResults(key, list);
      return sent;
    }
  }
  clearQueuedResults(key);
  return sent;
}

/**
 * Like `flushQueue`, but yields per-item progress and DOES NOT stop on
 * the first failure — it tries every item so the caller can show a
 * full report (used by the manual-retry modal). Items that succeed
 * are dropped from the queue regardless of later failures; items that
 * fail remain queued.
 *
 * `onProgress({ index, total, item, status, error })`:
 *   - status: 'sent' | 'failed'
 *   - error:  string message when status === 'failed'
 *
 * Returns `{ sent, failed, total }`.
 */
export async function flushQueueDetailed(key, loadedCloudSave, onProgress) {
  if (!loadedCloudSave?.apiBaseUrl) return { sent: 0, failed: 0, total: 0 };
  const original = getQueuedResults(key);
  if (!original.length) return { sent: 0, failed: 0, total: 0 };
  const total = original.length;
  const remaining = [];
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < original.length; i++) {
    const item = original[i];
    try {
      await postCloudResult(loadedCloudSave, {
        studentCode: item.studentCode,
        challengeGuid: item.challengeGuid,
        passed: item.passed,
        encryptedPayload: item.encryptedPayload,
        submittedAt: item.submittedAt,
        turnstileToken: '',
      });
      sent += 1;
      if (onProgress) onProgress({ index: i, total, item, status: 'sent' });
    } catch (err) {
      failed += 1;
      remaining.push(item);
      const msg = err?.message ?? String(err);
      if (onProgress) onProgress({ index: i, total, item, status: 'failed', error: msg });
    }
  }
  if (remaining.length === 0) {
    clearQueuedResults(key);
  } else {
    setQueuedResults(key, remaining);
  }
  return { sent, failed, total };
}

/**
 * On app boot, attempt to drain every class that has queued items.
 *
 * `resolveCloudSave(classCode)` should return the cloudSave block for
 * that class (or null if we don't know one — in which case we skip).
 */
export async function flushAllQueues(resolveCloudSave) {
  const keys = listQueuedFiles();
  let total = 0;
  for (const k of keys) {
    const cloud = resolveCloudSave(k);
    if (!cloud?.apiBaseUrl) continue;
    total += await flushQueue(k, cloud);
  }
  return total;
}
