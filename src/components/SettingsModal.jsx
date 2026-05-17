import React, { useState } from 'react';

const MODE_OPTIONS = [
  { value: 'fsm',    title: 'Finite State Machine',
    blurb: 'States and transitions — classic Kara.' },
  { value: 'blocks', title: 'Blocks',
    blurb: 'Drag-and-drop blocks that run on a real Python engine in the background.' },
  { value: 'python', title: 'Python',
    blurb: 'Full Python editor (Monaco). Use any pyodide-available library; loops, classes, input(), the lot.' },
];

export default function SettingsModal({
  appMode, dirtyFsm, dirtyBlocks, dirtyPython, dispatch, pythonRunner, onClose,
}) {
  const [pendingMode, setPendingMode] = useState(appMode);

  const dirtyMap = { fsm: dirtyFsm, blocks: dirtyBlocks, python: dirtyPython };
  const switching = pendingMode !== appMode;
  const losing = switching && dirtyMap[appMode];

  const apply = () => {
    if (switching) dispatch({ type: 'SET_APP_MODE', mode: pendingMode });
    onClose();
  };

  const resetPyodide = () => {
    if (pythonRunner) {
      pythonRunner.destroyWorker();
      // Re-warm in the background so the next Run isn't slow.
      pythonRunner.prewarm();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <h3>Settings</h3>

        <section className="settings-section">
          <div className="section-title">Programming mode</div>
          <p className="settings-blurb">
            Switching modes preserves all programs in memory; only the active
            mode is written to disk on save.
          </p>

          {MODE_OPTIONS.map(opt => (
            <label key={opt.value} className="settings-radio">
              <input
                type="radio" name="appMode" value={opt.value}
                checked={pendingMode === opt.value}
                onChange={() => setPendingMode(opt.value)}
              />
              <span>
                <strong>{opt.title}</strong>
                <span className="settings-radio-blurb"> — {opt.blurb}</span>
              </span>
            </label>
          ))}

          {losing && (
            <div className="settings-warn">
              ⚠ Your current {MODE_OPTIONS.find(o => o.value === appMode)?.title} program
              has unsaved edits. Switching won't lose it from memory, but a save
              would only persist whichever mode is active at save-time.
            </div>
          )}
        </section>

        <hr className="about-divider" />

        <section className="settings-section">
          <div className="section-title">Python runtime</div>
          <p className="settings-blurb">
            Hard-reset the pyodide environment if a program left it in a weird
            state, or to free up installed packages. The runtime will then
            re-initialise in the background.
          </p>
          <div>
            <button className="btn-secondary" onClick={resetPyodide}>
              Reset Pyodide environment
            </button>
          </div>
        </section>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={apply}>
            {switching ? 'Switch mode' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
