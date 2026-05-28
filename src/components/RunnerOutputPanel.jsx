import React, { useEffect, useRef, useState } from 'react';

/**
 * Shared output / input panel for Blocks + Python modes.
 *
 * Shows captured Python stdout, traceback output, and — when the worker
 * has called input() — a focusable input line where the user types and
 * presses Enter to send the answer back to the worker.
 *
 * Also shows an inline "installing pkgname…" pill when pyodide is loading
 * a package.
 */
export default function RunnerOutputPanel({ runner, dispatch, pythonRunner }) {
  const { output = [], awaitingInput, inputPrompt, installing } = runner ?? {};
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (awaitingInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [awaitingInput]);

  // Auto-scroll to bottom when new output arrives.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [output.length]);

  const visible = output.length > 0 || awaitingInput || installing;
  if (!visible) return null;

  const submitInput = () => {
    if (!awaitingInput) return;
    pythonRunner?.respondInput(draft, inputPrompt || '');
    setDraft('');
  };

  return (
    <div className="python-output-panel" role="region" aria-label="Output">
      <div className="python-output-header">
        <span>Output</span>
        {installing && (
          <span className="python-installing">⟳ installing {installing}…</span>
        )}
        <button
          className="python-output-close"
          title="Clear output"
          onClick={() => dispatch({ type: 'RUN_CLEAR_OUTPUT' })}
        >✕</button>
      </div>
      <div ref={bodyRef} className="python-output-body">
        <pre className="python-output-text">{output.join('\n')}</pre>
        {awaitingInput && (
          <div className="python-input-row">
            <span className="python-input-prompt">{inputPrompt || '›'}</span>
            <input
              ref={inputRef}
              className="python-input-field"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitInput(); }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button className="python-input-send" onClick={submitInput}>↵</button>
          </div>
        )}
      </div>
    </div>
  );
}
