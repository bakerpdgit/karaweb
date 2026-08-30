import React, { useState } from 'react';
import { allowedModesFor } from '../store.js';
import {
  setWelcomeShown, getWelcomeShown,
  setMainWelcomeShown, getMainWelcomeShown,
  setTeacherKeysWelcomeShown, getTeacherKeysWelcomeShown,
} from '../utils/localStore.js';

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
  activeChallenge = null,
  onShowMainWelcome, onShowEditorWelcome, onShowTeacherKeysWelcome,
}) {
  const [pendingMode, setPendingMode] = useState(appMode);
  // Local mirrors of the "show getting-started" preferences so the
  // checkboxes flip immediately. Ticking any also re-pops the
  // corresponding slideshow on the spot, in case the user wants to
  // see it now.
  const [mainOn,        setMainOn]        = useState(() => !getMainWelcomeShown());
  const [editorOn,      setEditorOn]      = useState(() => !getWelcomeShown());
  const [teacherKeysOn, setTeacherKeysOn] = useState(() => !getTeacherKeysWelcomeShown());

  const onToggleMain = (e) => {
    const want = e.target.checked;
    setMainOn(want);
    if (want) {
      setMainWelcomeShown(false);
      onShowMainWelcome?.();
      onClose();
    } else {
      setMainWelcomeShown(true);
    }
  };
  const onToggleEditor = (e) => {
    const want = e.target.checked;
    setEditorOn(want);
    if (want) {
      setWelcomeShown(false);
      onShowEditorWelcome?.();
      onClose();
    } else {
      setWelcomeShown(true);
    }
  };
  const onToggleTeacherKeys = (e) => {
    const want = e.target.checked;
    setTeacherKeysOn(want);
    if (want) {
      setTeacherKeysWelcomeShown(false);
      onShowTeacherKeysWelcome?.();
      onClose();
    } else {
      setTeacherKeysWelcomeShown(true);
    }
  };

  const dirtyMap = { fsm: dirtyFsm, blocks: dirtyBlocks, python: dirtyPython };
  const switching = pendingMode !== appMode;
  const losing = switching && dirtyMap[appMode];

  // When the student is taking a challenge, the mode is normally locked
  // to whatever the teacher set (challenge.mode). Teachers can opt-in
  // to letting the student switch via the challenge's allowModeChange
  // flag.
  const modeLocked = !!(activeChallenge && !activeChallenge.allowModeChange);
  // The challenge may also narrow *which* modes are on offer when
  // switching is allowed (see challenge.allowedModes).
  const modeOptions = activeChallenge
    ? MODE_OPTIONS.filter(o => allowedModesFor(activeChallenge).includes(o.value))
    : MODE_OPTIONS;

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

          {modeLocked && (
            <div className="settings-warn">
              🔒 This challenge is locked to <strong>{MODE_OPTIONS.find(o => o.value === activeChallenge.mode)?.title}</strong>.
              The teacher hasn't allowed mode switching for this challenge.
            </div>
          )}

          {modeOptions.map(opt => (
            <label key={opt.value} className={`settings-radio ${modeLocked ? 'disabled' : ''}`}>
              <input
                type="radio" name="appMode" value={opt.value}
                checked={pendingMode === opt.value}
                disabled={modeLocked}
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
            Reset if the Python runtime becomes unstable.
          </p>
          <div>
            <button className="btn-secondary" onClick={resetPyodide}>
              Reset Pyodide environment
            </button>
          </div>
        </section>

        <hr className="about-divider" />

        <section className="settings-section">
          <div className="section-title">Help</div>
          <p className="settings-blurb">
            Ticking either box re-enables that slideshow and shows it now.
          </p>
          <label className="settings-checkbox">
            <input type="checkbox" checked={mainOn} onChange={onToggleMain} />
            <span>Show getting-started slideshow</span>
          </label>
          <label className="settings-checkbox">
            <input type="checkbox" checked={editorOn} onChange={onToggleEditor} />
            <span>Show challenge editor getting-started instructions</span>
          </label>
          <label className="settings-checkbox">
            <input type="checkbox" checked={teacherKeysOn} onChange={onToggleTeacherKeys} />
            <span>Show teacher keys overview when opening the Teacher Keys tab</span>
          </label>
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
