import React, { useEffect, useRef, useState } from 'react';

export default function ChallengesMenu({
  challenges,
  currentChallengeId,
  challengeEditor,
  scratchpadChallenge = null,
  disabled,
  dispatch,
  onRequestExit,
  onRequestEnterEditor,
  gated = false,
  bookProgress = null,        // { challenges: { [guid]: { passed, attempts } } } | null
  hasAnyProgress = false,      // true when any user-slot has progress for this book
  onResetBookProgress = null,  // () => void — opens the confirm in App.jsx
  onSaveBookProgress = null,   // () => void — exports book + embedded progress to a file
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (id) => {
    setOpen(false);
    dispatch({ type: 'CH_SELECT', id });
  };

  const enterEditor = () => {
    setOpen(false);
    if (onRequestEnterEditor) onRequestEnterEditor();
    else                       dispatch({ type: 'CH_ENTER_EDITOR' });
  };

  const exit = () => {
    setOpen(false);
    if (challengeEditor) {
      dispatch({ type: 'CH_EXIT_EDITOR' });
    } else if (onRequestExit) {
      onRequestExit();
    } else {
      dispatch({ type: 'CH_EXIT_PLAY' });
    }
  };

  const activeName = currentChallengeId
    ? (scratchpadChallenge?.id === currentChallengeId
        ? scratchpadChallenge.name
        : (challenges.find(c => c.id === currentChallengeId)?.name ?? '?'))
    : null;
  const label =
    challengeEditor ? '🎯 Editing challenges' :
    activeName     ? `🎯 ${activeName}` :
                     '🎯 Challenges…';

  return (
    <div className="panels-menu-wrap" ref={wrapRef}>
      <button
        className={`header-btn ${currentChallengeId || challengeEditor ? 'highlight' : ''}`}
        disabled={disabled}
        title="Browse, play, or edit challenges"
        onClick={() => setOpen(v => !v)}
      >
        {label} ▾
      </button>
      {open && (
        <div className="panels-menu challenges-menu">
          {challenges.length === 0 && (
            <div className="panels-menu-item disabled">No challenges yet.</div>
          )}
          {challenges.map(c => {
            const stored = bookProgress?.challenges?.[c.guid];
            const passed   = stored?.passed === true;
            const attempted = !passed && (stored?.attempts || 0) > 0;
            return (
              <button
                key={c.id}
                className={`panels-menu-item ${currentChallengeId === c.id ? 'checked' : ''}`}
                onClick={() => select(c.id)}
                title={passed ? 'Passed' : (attempted ? 'Attempted, not passed' : 'Not attempted yet')}
              >
                {currentChallengeId === c.id ? '●' : '○'} {c.name}
                {passed && <span className="challenges-progress-tag passed" title="Passed">✓</span>}
                {attempted && <span className="challenges-progress-tag attempted" title="Attempted">·</span>}
                <span className="challenges-mode-tag">{c.mode}</span>
              </button>
            );
          })}
          {(currentChallengeId || challengeEditor) && (
            <button className="panels-menu-item" onClick={exit}>
              {challengeEditor ? '⛔ Exit editor' : `⛔ Exit challenge${gated ? ' 🔒' : ''}`}
            </button>
          )}
          <hr className="challenges-menu-sep" />
          <button className="panels-menu-item" onClick={enterEditor}>
            ✏️ Edit / manage challenges…{gated ? ' 🔒' : ''}
          </button>
          {hasAnyProgress && onSaveBookProgress && (
            <button
              className="panels-menu-item"
              onClick={() => { setOpen(false); onSaveBookProgress(); }}
              title="Download a copy of this book with your saved progress and code embedded — re-open it on any device to restore"
            >
              💾 Save progress…
            </button>
          )}
          {hasAnyProgress && onResetBookProgress && (
            <button
              className="panels-menu-item"
              onClick={() => { setOpen(false); onResetBookProgress(); }}
            >
              🗑 Reset book progress…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
