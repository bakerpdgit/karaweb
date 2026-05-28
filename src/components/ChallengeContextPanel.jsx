import React, { useEffect, useState } from 'react';
import MarkdownView from './MarkdownView.jsx';
import WorldThumbnail from './WorldThumbnail.jsx';

/**
 * Tabbed panel that lives under the World editor.
 *
 *   Tab 1 — Intro    (the file-level introduction — always shown if
 *                     `introMarkdown` is non-empty; default tab when
 *                     no challenge is active)
 *   Tab 2 — Notes    (per-challenge notes; in teacher-edit mode
 *                     shows a Markdown textarea + preview toggle)
 *   Tab 3 — Target   (per-challenge target world thumbnail)
 *
 * The challenge-specific tabs are hidden when no challenge is in
 * scope. The user can close the whole panel via the ✕ in the header.
 *
 * When a challenge becomes active the focus shifts from Intro → Notes
 * automatically; when no challenge is active the focus resets to Intro.
 */
export default function ChallengeContextPanel({
  introMarkdown,
  challenge,              // the active or editing challenge (may be null)
  isEditing = false,      // true → render Notes tab in teacher-edit mode
  onClose,
  dispatch,
}) {
  const hasIntro  = !!(introMarkdown ?? '').trim();
  const hasNotes  = !!(challenge?.notes ?? '').trim();
  const hasTarget = !!challenge?.targetWorld;
  // In teacher-edit mode the Notes tab is always available because the
  // teacher might be authoring notes from blank.
  const notesTabVisible  = !!challenge && (hasNotes || isEditing);
  const targetTabVisible = !!challenge && hasTarget;

  const defaultTab = challenge
    ? (notesTabVisible ? 'notes' : (targetTabVisible ? 'target' : (hasIntro ? 'intro' : 'notes')))
    : (hasIntro ? 'intro' : 'notes');
  const [tab, setTab] = useState(defaultTab);

  // When the active challenge changes (e.g. student moves to next
  // challenge, or teacher selects another), snap to its Notes tab.
  // When the challenge clears (back to no-challenge view), snap to Intro.
  useEffect(() => {
    if (challenge && notesTabVisible) setTab('notes');
    else if (!challenge && hasIntro)  setTab('intro');
  }, [challenge?.id, isEditing]);

  // Hide entirely if nothing has anything to show.
  if (!hasIntro && !notesTabVisible && !targetTabVisible) return null;

  return (
    <div className="ctx-panel">
      <div className="ctx-panel-header">
        <div className="ctx-panel-tabs" role="tablist">
          {hasIntro && (
            <button
              role="tab"
              aria-selected={tab === 'intro'}
              className={`ctx-tab ${tab === 'intro' ? 'active' : ''}`}
              onClick={() => setTab('intro')}
              title="The introduction text for this app / challenge book"
            >📖 Intro</button>
          )}
          {notesTabVisible && (
            <button
              role="tab"
              aria-selected={tab === 'notes'}
              className={`ctx-tab ${tab === 'notes' ? 'active' : ''}`}
              onClick={() => setTab('notes')}
              title={isEditing ? 'Edit the notes shown to students for this challenge' : 'Notes for this challenge'}
            >📝 Notes</button>
          )}
          {targetTabVisible && (
            <button
              role="tab"
              aria-selected={tab === 'target'}
              className={`ctx-tab ${tab === 'target' ? 'active' : ''}`}
              onClick={() => setTab('target')}
              title="Target world Kara must reach"
            >🎯 Target</button>
          )}
        </div>
        <button className="ctx-panel-close" onClick={onClose} title="Hide this panel">✕</button>
      </div>
      <div className="ctx-panel-body">
        {tab === 'intro' && hasIntro && (
          <div className="ctx-notes">
            <MarkdownView markdown={introMarkdown} />
          </div>
        )}

        {tab === 'notes' && notesTabVisible && !isEditing && (
          <div className="ctx-notes">
            {hasNotes
              ? <MarkdownView markdown={challenge.notes} />
              : <p className="cl-hint"><em>(no notes for this challenge)</em></p>}
            {targetTabVisible && (
              <div className="ctx-notes-footer">
                <button
                  className="ctx-view-target-btn"
                  onClick={() => setTab('target')}
                  title="Jump to the Target tab to see what Kara's world should look like at the end"
                >&raquo; View Target World</button>
              </div>
            )}
          </div>
        )}

        {tab === 'notes' && notesTabVisible && isEditing && (
          <ChallengeNotesEditor challenge={challenge} dispatch={dispatch} />
        )}

        {tab === 'target' && targetTabVisible && (
          <div className="ctx-target">
            <WorldThumbnail world={challenge.targetWorld} cellSize={22} />
            {(challenge.intermediateCheckpoints?.length ?? 0) > 0 && (
              <p className="ctx-checkpoints-hint">
                This challenge has {challenge.intermediateCheckpoints.length} required intermediate checkpoint{challenge.intermediateCheckpoints.length === 1 ? '' : 's'} — your program must pass through each one (in order) before reaching the target.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline edit/preview toggle for the per-challenge notes Markdown.
// Moved out of ChallengeEditor's main form so it lives next to where
// students actually see the notes.
function ChallengeNotesEditor({ challenge, dispatch }) {
  const [mode, setMode] = useState('edit');
  const notes = challenge.notes ?? '';

  return (
    <div className="challenge-notes-inline-editor">
      <div className="challenge-notes-header">
        <span className="challenge-edit-row-label">Notes for students (Markdown):</span>
        <div className="challenge-notes-tabs">
          <button
            type="button"
            className={`view-tab ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => setMode('edit')}
          >Edit</button>
          <button
            type="button"
            className={`view-tab ${mode === 'preview' ? 'active' : ''}`}
            onClick={() => setMode('preview')}
          >Preview</button>
        </div>
      </div>
      {mode === 'edit' && (
        <textarea
          className="challenge-notes-textarea"
          rows={8}
          placeholder="# Goal&#10;&#10;Make Kara walk forward, place a leaf, then return to the start.&#10;&#10;**Tips:** use `move()` and `put_leaf()`."
          value={notes}
          onChange={e => dispatch({ type: 'CH_SET_NOTES', id: challenge.id, notes: e.target.value })}
        />
      )}
      {mode === 'preview' && (
        <div className="challenge-notes-preview ctx-notes">
          {notes
            ? <MarkdownView markdown={notes} />
            : <p className="cl-hint"><em>(no notes yet)</em></p>}
        </div>
      )}
    </div>
  );
}
