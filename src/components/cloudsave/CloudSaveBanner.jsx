import React, { useEffect, useState } from 'react';
import { getQueuedResults, removeStudentSession } from '../../utils/localStore.js';

/**
 * Small banner shown between the app header and the main layout whenever
 * a loaded challenges file embeds a cloudSave block. Tells the user
 * what's going on with their cloud session:
 *
 *  - Teacher (has keydetails for the class) → "Teacher mode — open
 *    Analyse tab to view results."
 *  - Student logged in       → "🎓 Logged in as <name> for <class>.
 *    Results submit automatically."
 *  - Student in practice mode → "Practice mode — results not recorded.
 *    [Log in]"
 *
 * Also surfaces the offline-queue length when there are pending results.
 */
export default function CloudSaveBanner({
  loadedCloudSave, studentSession, keydetails, onLoginAgain, onOpenQueue,
}) {
  // The "session key" used for queue / session / display label is
  // always the per-book challengeFileGuid now — both backends use
  // it (Codehooks dropped per-class scoping).
  const sessionKey = loadedCloudSave?.challengeFileGuid;
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    if (!sessionKey) return;
    const refresh = () => setQueueCount(getQueuedResults(sessionKey).length);
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [sessionKey]);

  if (!sessionKey) return null;

  // Teacher mode: their per-teacher public key matches the one in the
  // loaded file.
  const teacherForClass = !!(
    keydetails?.publicKeyJwk?.n
    && loadedCloudSave?.publicKeyJwk?.n
    && keydetails.publicKeyJwk.n === loadedCloudSave.publicKeyJwk.n
  );
  const loggedIn = studentSession?.sessionKey === sessionKey;
  const displayLabel = sessionKey?.slice(0, 8) + '…';

  let body;
  let kind = 'student';
  if (teacherForClass) {
    body = <span>📝 <strong>Teacher mode</strong> — <code>{displayLabel}</code>. Open <strong>Analyse Submissions</strong> in the Challenge Editor to view results.</span>;
    kind = 'teacher';
  } else if (loggedIn) {
    body = <>
      <span>🎓 Logged in as <strong>{studentSession.username}</strong> for <code>{displayLabel}</code>. Results submit automatically.</span>
      <button className="cloudsave-banner-action" onClick={() => {
        removeStudentSession(sessionKey);
        onLoginAgain();
      }}>Log out</button>
    </>;
  } else {
    body = <>
      <span>⚠ <strong>Practice mode</strong> — results for <code>{displayLabel}</code> are not being recorded.</span>
      <button className="cloudsave-banner-action" onClick={onLoginAgain}>Log in</button>
    </>;
  }

  return (
    <div className={`cloudsave-banner cloudsave-banner-${kind}`}>
      {body}
      {queueCount > 0 && (
        onOpenQueue ? (
          <button
            type="button"
            className="cloudsave-banner-queue cloudsave-banner-queue-clickable"
            onClick={onOpenQueue}
            title="Click to view and retry queued submissions"
          >
            📤 {queueCount} result{queueCount === 1 ? '' : 's'} waiting to send
          </button>
        ) : (
          <span className="cloudsave-banner-queue">
            📤 {queueCount} result{queueCount === 1 ? '' : 's'} waiting to send
          </span>
        )
      )}
    </div>
  );
}
