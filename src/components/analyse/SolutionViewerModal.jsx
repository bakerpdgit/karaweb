import React from 'react';
import Editor from '@monaco-editor/react';

/**
 * Modal that shows a decrypted student solution + the row metadata.
 *
 * Mode rendering:
 *  - Python → Monaco read-only editor with syntax highlighting
 *  - FSM / Blocks → JSON view (visual read-only editors would need
 *    refactoring those components; deferred to a follow-up).
 */
export default function SolutionViewerModal({
  studentLabel, challengeLabel, attemptInfo, solution, onClose,
}) {
  const mode = solution?.mode || 'unknown';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal solution-viewer-modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">
          {studentLabel} — {challengeLabel}
        </h3>
        <div className="sv-meta">
          <span className={`sv-meta-badge sv-${attemptInfo?.status || ''}`}>
            {labelForStatus(attemptInfo?.status)}
          </span>
          <span>Submissions: <strong>{attemptInfo?.submissionCount ?? 0}</strong></span>
          <span>First try: <strong>{attemptInfo?.firstAttemptPassed ? '✓' : '✗'}</strong></span>
          <span>Latest: <strong>{attemptInfo?.latestPassed ? '✓' : '✗'}</strong></span>
          <span className="sv-meta-time">last {attemptInfo?.submittedAt ?? '—'}</span>
        </div>

        <div className="sv-body">
          {!solution && (
            <p className="cl-hint">No decrypted solution available for this submission.</p>
          )}

          {solution?.truncated && (
            <p className="cl-hint">⚠ The student's solution was truncated at upload time ({solution.reason}).</p>
          )}

          {mode === 'python' && (
            <Editor
              height="400px"
              defaultLanguage="python"
              value={solution?.python?.code ?? ''}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: solution?.python?.fontSize ?? 14,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          )}

          {(mode === 'fsm' || mode === 'blocks') && (
            <pre className="sv-json-pre">
              {JSON.stringify(mode === 'fsm' ? solution.fsm : solution.blocks, null, 2)}
            </pre>
          )}

          {mode === 'unknown' && (
            <p className="cl-hint">Unknown solution format.</p>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function labelForStatus(s) {
  if (s === 'first')    return '✓ Passed first try';
  if (s === 'eventual') return '✓ Passed eventually';
  if (s === 'fail')     return '✗ Latest attempt failed';
  return '—';
}
