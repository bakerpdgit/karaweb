import React from 'react';

const SENSOR_KEYS = ['treeFront', 'treeLeft', 'treeRight', 'mushroomFront', 'onLeaf'];

export default function ExecutionLog({ log, output = [], stepCount = 0, error = null }) {
  const hasFsmLog = log && log.length > 0;
  const hasOutput = Array.isArray(output) && output.length > 0;
  const hasAnything = hasFsmLog || hasOutput || stepCount > 0 || !!error;

  if (!hasAnything) {
    return (
      <div className="exec-log empty">
        <em>Execution log will appear here when you run the simulation.</em>
      </div>
    );
  }

  return (
    <div className="exec-log">
      {/* Python / Blocks runs: show captured stdout + step summary
          at the top so the user always sees SOMETHING after Run. */}
      {(hasOutput || stepCount > 0 || error) && !hasFsmLog && (
        <div className="exec-log-stdout">
          {stepCount > 0 && (
            <div className="exec-log-summary">
              Ran for <strong>{stepCount}</strong> step{stepCount !== 1 ? 's' : ''}.
            </div>
          )}
          {hasOutput && (
            <pre className="exec-log-output">{output.join('')}</pre>
          )}
          {error && (
            <div className="exec-log-error">⚠ {error}</div>
          )}
        </div>
      )}

      {/* FSM runs: the structured per-step table (newest first). */}
      {hasFsmLog && (
        <>
          <div className="exec-log-header">
            <span>#</span>
            <span>From → To</span>
            <span>TF TL TR MF OL</span>
            <span>Action</span>
          </div>
          {log.map(entry => (
            <div key={entry.step} className="exec-row">
              <span className="exec-step">{entry.step}</span>
              <span className="exec-states">
                {entry.fromLabel} → {entry.toLabel}
              </span>
              <span className="exec-sensors">
                {SENSOR_KEYS.map(k => (
                  <span key={k} className={`sensor-bit ${entry.sensors?.[k] ? 'on' : 'off'}`}>
                    {entry.sensors?.[k] ? '1' : '0'}
                  </span>
                ))}
              </span>
              <span className="exec-action">{entry.action}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
