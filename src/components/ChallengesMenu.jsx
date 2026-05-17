import React, { useEffect, useRef, useState } from 'react';

export default function ChallengesMenu({
  challenges,
  currentChallengeId,
  challengeEditor,
  disabled,
  dispatch,
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
    dispatch({ type: 'CH_ENTER_EDITOR' });
  };

  const exit = () => {
    setOpen(false);
    if (challengeEditor) dispatch({ type: 'CH_EXIT_EDITOR' });
    else                 dispatch({ type: 'CH_EXIT_PLAY' });
  };

  const label =
    challengeEditor ? '🎯 Editing challenges' :
    currentChallengeId
      ? `🎯 ${challenges.find(c => c.id === currentChallengeId)?.name ?? '?'}`
      : '🎯 Challenges…';

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
          {challenges.map(c => (
            <button
              key={c.id}
              className={`panels-menu-item ${currentChallengeId === c.id ? 'checked' : ''}`}
              onClick={() => select(c.id)}
            >
              {currentChallengeId === c.id ? '●' : '○'} {c.name}
              <span className="challenges-mode-tag">{c.mode}</span>
            </button>
          ))}
          {(currentChallengeId || challengeEditor) && (
            <button className="panels-menu-item" onClick={exit}>
              {challengeEditor ? '⛔ Exit editor' : '⛔ Exit challenge'}
            </button>
          )}
          <hr className="challenges-menu-sep" />
          <button className="panels-menu-item" onClick={enterEditor}>
            ✏️ Edit / manage challenges…
          </button>
        </div>
      )}
    </div>
  );
}
