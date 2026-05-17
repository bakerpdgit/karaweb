import React, { useRef, useState } from 'react';

/**
 * Sidebar for the Challenge Editor view: list of challenges with rename,
 * reorder, add, and delete controls.
 *
 * The world editor + program editor are rendered by App.jsx in their usual
 * panels — the reducer redirects edits to the active challenge so the same
 * components transparently edit challenge state when challengeEditor is on.
 */
export default function ChallengeEditor({
  challenges,
  editingChallengeId,
  editingWorldView,
  dispatch,
}) {
  const renameRef = useRef(null);
  const editing = challenges.find(c => c.id === editingChallengeId);
  const [renameDraft, setRenameDraft] = useState(editing?.name ?? '');

  // Keep the rename input in sync when switching challenges.
  React.useEffect(() => {
    setRenameDraft(editing?.name ?? '');
  }, [editingChallengeId, editing?.name]);

  const submitRename = () => {
    if (!editing) return;
    const n = renameDraft.trim();
    if (n && n !== editing.name) {
      dispatch({ type: 'CH_RENAME', id: editing.id, name: n });
    } else {
      setRenameDraft(editing.name);
    }
  };

  return (
    <div className="challenge-editor-bar">
      <div className="challenge-editor-bar-header">
        <span className="challenge-editor-title">Challenge Editor</span>
        <button
          className="header-btn"
          title="Add a new challenge"
          onClick={() => dispatch({ type: 'CH_NEW' })}
        >+ New</button>
        <button
          className="header-btn"
          title="Exit editor and return to default workspace"
          onClick={() => dispatch({ type: 'CH_EXIT_EDITOR' })}
        >✕ Exit editor</button>
      </div>

      <div className="challenge-editor-body">
        <div className="challenge-list">
          {challenges.length === 0 && (
            <div className="challenge-list-empty">Click <strong>+ New</strong> to create your first challenge.</div>
          )}
          {challenges.map((c, idx) => (
            <div
              key={c.id}
              className={`challenge-list-item ${c.id === editingChallengeId ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'CH_SET_EDITING_CHALLENGE', id: c.id })}
            >
              <span className="challenge-list-name">{c.name}</span>
              <span className="challenges-mode-tag">{c.mode}</span>
              <button
                title="Move up"
                className="challenge-list-btn"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CH_MOVE', id: c.id, delta: -1 }); }}
                disabled={idx === 0}
              >↑</button>
              <button
                title="Move down"
                className="challenge-list-btn"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CH_MOVE', id: c.id, delta: +1 }); }}
                disabled={idx === challenges.length - 1}
              >↓</button>
              <button
                title="Delete this challenge"
                className="challenge-list-btn danger"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${c.name}"?`)) dispatch({ type: 'CH_DELETE', id: c.id });
                }}
              >✕</button>
            </div>
          ))}
        </div>

        {editing && (
          <div className="challenge-edit-form">
            <div className="challenge-edit-row">
              <label>Name:</label>
              <input
                ref={renameRef}
                className="challenge-edit-name"
                value={renameDraft}
                onChange={e => setRenameDraft(e.target.value)}
                onBlur={submitRename}
                onKeyDown={e => { if (e.key === 'Enter') submitRename(); }}
              />
            </div>
            <div className="challenge-edit-row">
              <label>Mode:</label>
              <select
                value={editing.mode}
                onChange={e => dispatch({ type: 'CH_SET_MODE', id: editing.id, mode: e.target.value })}
                title="Programming mode the user must solve this challenge in"
              >
                <option value="fsm">FSM</option>
                <option value="blocks">Blocks</option>
                <option value="python">Python</option>
              </select>
            </div>
            <div className="challenge-edit-row">
              <label>Editing:</label>
              <div className="challenge-view-tabs">
                <button
                  className={`view-tab ${editingWorldView === 'initial' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'CH_SET_VIEW', view: 'initial' })}
                >Initial world</button>
                <button
                  className={`view-tab ${editingWorldView === 'target' ? 'active' : ''}`}
                  onClick={() => dispatch({ type: 'CH_SET_VIEW', view: 'target' })}
                >Target world</button>
              </div>
              <button
                className="header-btn"
                title={`Copy the ${editingWorldView === 'initial' ? 'target' : 'initial'} world onto this one`}
                onClick={() => {
                  const from = editingWorldView === 'initial' ? 'target' : 'initial';
                  if (window.confirm(`Overwrite this world with the ${from} world?`)) {
                    dispatch({ type: 'CH_COPY_WORLD', from });
                  }
                }}
              >Copy from {editingWorldView === 'initial' ? 'target' : 'initial'}</button>
            </div>
            <p className="challenge-edit-help">
              Paint the {editingWorldView} world on the left, and write the
              starter <strong>{editing.mode}</strong> program on the right. Switch tabs to edit
              the other world. Changes auto-save when you switch tabs,
              switch challenges, or exit the editor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
