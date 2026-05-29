import React, { useEffect, useState } from 'react';
import { getQueuedResults, clearQueuedResults } from '../utils/localStore.js';
import { flushQueueDetailed } from '../utils/resultQueue.js';
import { useConfirmModal } from './ConfirmModal.jsx';

/**
 * Manage-queued-submissions modal. Lists the items in the offline
 * queue for the current cloud-save book and lets the user manually
 * retry sending them, surfacing per-item success / error in a small
 * embedded console.
 *
 * The auto-drain paths (boot + visibility-change) continue to use
 * the simpler `flushQueue` — this modal calls the detailed variant
 * so it can populate the log.
 */
export default function QueuedSubmissionsModal({ sessionKey, loadedCloudSave, onClose }) {
  const [items, setItems] = useState(() => sessionKey ? getQueuedResults(sessionKey) : []);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);    // [{ kind, message }]
  const [summary, setSummary] = useState(null);
  const { confirm, modal: confirmModalEl } = useConfirmModal();

  // Re-read on mount and after each retry so the count reflects reality.
  const refresh = () => {
    if (!sessionKey) { setItems([]); return; }
    setItems(getQueuedResults(sessionKey));
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sessionKey]);

  const append = (kind, message) => {
    setLog(prev => [...prev, { kind, message, at: new Date() }]);
  };

  const onClearAll = async () => {
    if (busy || !sessionKey) return;
    const count = items.length;
    if (count === 0) return;
    const ok = await confirm({
      title: 'Delete all queued submissions?',
      message: `Permanently remove ${count} queued submission${count === 1 ? '' : 's'} from this device. They will NOT be sent to the cloud.`,
      confirmLabel: `Delete ${count}`,
      variant: 'danger',
    });
    if (!ok) return;
    clearQueuedResults(sessionKey);
    refresh();
    setSummary(null);
    setLog([{ kind: 'info', message: `Deleted ${count} queued submission${count === 1 ? '' : 's'}.`, at: new Date() }]);
  };

  const onRetry = async () => {
    if (busy) return;
    if (!loadedCloudSave?.apiBaseUrl) {
      append('error', 'No cloud-save URL loaded for this book.');
      return;
    }
    setBusy(true);
    setLog([]);
    setSummary(null);
    append('info', `Retrying ${items.length} queued submission(s)…`);
    try {
      const result = await flushQueueDetailed(sessionKey, loadedCloudSave, (p) => {
        const label = `[${p.index + 1}/${p.total}]`;
        if (p.status === 'sent') {
          append('ok', `${label} ✓ sent (challenge ${p.item.challengeGuid?.slice(0, 8) || '?'}…)`);
        } else {
          append('error', `${label} ✗ ${p.error || 'failed'}`);
        }
      });
      setSummary(result);
      append('info', `Done — ${result.sent} sent, ${result.failed} still queued.`);
    } catch (err) {
      append('error', 'Retry crashed: ' + (err?.message ?? String(err)));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal queued-modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Queued submissions</h3>
        <p className="modal-help">
          These results couldn't be sent to the cloud earlier (offline,
          server rejection, or rate-limit). They stay on this device
          until they go through.
        </p>

        {items.length === 0 ? (
          <p className="cl-hint" style={{ padding: '12px 0' }}>
            ✓ No queued submissions right now.
          </p>
        ) : (
          <table className="queued-table">
            <thead>
              <tr>
                <th>#</th>
                <th>When submitted</th>
                <th>Challenge</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{it.submittedAt ? new Date(it.submittedAt).toLocaleString() : '—'}</td>
                  <td><code>{(it.challengeGuid || '').slice(0, 8)}…</code></td>
                  <td className={it.passed ? 'queued-pass' : 'queued-fail'}>
                    {it.passed ? '✓ passed' : '✗ failed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(log.length > 0 || busy) && (
          <div className="queued-console">
            {log.map((entry, i) => (
              <div key={i} className={`queued-console-line queued-console-${entry.kind}`}>
                {entry.message}
              </div>
            ))}
            {busy && log.length === 0 && (
              <div className="queued-console-line queued-console-info">working…</div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            className="btn-primary danger"
            onClick={onClearAll}
            disabled={busy || items.length === 0}
          >
            🗑 Delete all
          </button>
          <button
            className="btn-primary"
            onClick={onRetry}
            disabled={busy || items.length === 0}
          >
            {busy ? 'Retrying…' : '🔁 Retry all'}
          </button>
        </div>
      </div>
    </div>
    {confirmModalEl}
    </>
  );
}
