import React, { useEffect, useState } from 'react';
import { getQueuedResults } from '../utils/localStore.js';

/**
 * Small clickable chip in the header showing how many submissions are
 * stuck in the offline queue for the currently-loaded cloud-save book.
 *
 * Polls `getQueuedResults(sessionKey)` every 4 seconds (cheap localStorage
 * read). Renders null when there's nothing waiting so it doesn't add
 * visual noise during normal use.
 *
 * Click → opens the parent's manage-queue modal via the supplied
 * `onClick` callback.
 */
export default function QueuedResultsChip({ sessionKey, onClick }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!sessionKey) { setCount(0); return; }
    const refresh = () => setCount(getQueuedResults(sessionKey).length);
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [sessionKey]);

  if (!sessionKey || count === 0) return null;
  return (
    <button
      type="button"
      className="header-btn queued-chip"
      onClick={onClick}
      title="Click to view and retry queued submissions"
    >
      📤 {count} queued
    </button>
  );
}
