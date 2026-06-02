import React, { useEffect, useState } from 'react';
import MarkdownView from './MarkdownView.jsx';
import WorldThumbnail from './WorldThumbnail.jsx';

/**
 * Tabbed panel that lives under the World editor.
 *
 *   When a challenge is active (tab order):
 *     Tab 1 — Target World  (the world Kara must end on)
 *     Tab 2 — Challenge Notes (markdown notes for this challenge)
 *     Tab 3 — Intro          (file-level intro; only when introMarkdown set)
 *
 *   When no challenge is active:
 *     Only the Intro tab is shown.
 *
 * The user can close the whole panel via the ✕ in the header. When a
 * challenge becomes active the focus snaps to Target World so the
 * student immediately sees what they're working toward.
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
    ? (targetTabVisible ? 'target' : (notesTabVisible ? 'notes' : (hasIntro ? 'intro' : 'target')))
    : (hasIntro ? 'intro' : 'target');
  const [tab, setTab] = useState(defaultTab);

  // When the active challenge changes (or its editing-target / mode
  // changes), snap to Target World by default so the student
  // immediately sees the goal. When the challenge clears, snap back
  // to Intro.
  useEffect(() => {
    if (challenge && targetTabVisible)      setTab('target');
    else if (challenge && notesTabVisible)  setTab('notes');
    else if (!challenge && hasIntro)        setTab('intro');
  }, [challenge?.id, isEditing]);

  // Hide entirely if nothing has anything to show.
  if (!hasIntro && !notesTabVisible && !targetTabVisible) return null;

  return (
    <div className="ctx-panel">
      <div className="ctx-panel-header">
        <div className="ctx-panel-tabs" role="tablist">
          {targetTabVisible && (
            <button
              role="tab"
              aria-selected={tab === 'target'}
              className={`ctx-tab ${tab === 'target' ? 'active' : ''}`}
              onClick={() => setTab('target')}
              title="Target world Kara must reach"
            >🎯 Target World</button>
          )}
          {notesTabVisible && (
            <button
              role="tab"
              aria-selected={tab === 'notes'}
              className={`ctx-tab ${tab === 'notes' ? 'active' : ''}`}
              onClick={() => setTab('notes')}
              title={isEditing ? 'Edit the notes shown to students for this challenge' : 'Notes for this challenge'}
            >📝 Challenge Notes</button>
          )}
          {hasIntro && (
            <button
              role="tab"
              aria-selected={tab === 'intro'}
              className={`ctx-tab ${tab === 'intro' ? 'active' : ''}`}
              onClick={() => setTab('intro')}
              title="The introduction text for this app / challenge book"
            >ℹ Intro</button>
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
