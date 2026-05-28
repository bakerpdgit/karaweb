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
