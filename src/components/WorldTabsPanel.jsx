import React, { useState } from 'react';
import MarkdownView from './MarkdownView.jsx';
import WorldThumbnail from './WorldThumbnail.jsx';

/**
 * Top-level tabbed panel that hosts the World editor (always visible)
 * plus per-challenge **Target World** and **Challenge Notes** tabs.
 *
 *   When no challenge is active:
 *     Just the World tab is shown (no other tabs).
 *   When a challenge is active:
 *     [World] [🎯 Target World] [📝 Challenge Notes]
 *
 * The actual World view (WorldEditor + any below-the-world chrome) is
 * passed in as `worldTabContent` so this component stays decoupled
 * from the editor's own prop wiring.
 */
export default function WorldTabsPanel({
  challenge,              // active or editing challenge (may be null)
  isEditing = false,      // true → Notes tab renders edit-and-preview UI
  dispatch,
  worldTabContent,        // JSX rendered inside the World tab
  cellSize = 38,           // matches the zoom level of the live World view
}) {
  const hasTarget = !!challenge?.targetWorld;
  const hasNotes  = !!challenge && (((challenge.notes ?? '').trim()) || isEditing);

  const [tab, setTab] = useState('world');

  // If the active tab becomes invalid (challenge cleared while on
  // target / notes), snap back to the world tab.
  React.useEffect(() => {
    if (tab === 'target' && !hasTarget) setTab('world');
    if (tab === 'notes'  && !hasNotes)  setTab('world');
  }, [tab, hasTarget, hasNotes]);

  return (
    <div className="panel world-tabs-panel">
      <div className="ctx-panel-header">
        <div className="ctx-panel-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'world'}
            className={`ctx-tab ${tab === 'world' ? 'active' : ''}`}
            onClick={() => setTab('world')}
            title="Kara's current world — paint cells, place Kara"
          >🌍 World</button>
          {hasTarget && (
            <button
              role="tab"
              aria-selected={tab === 'target'}
              className={`ctx-tab ${tab === 'target' ? 'active' : ''}`}
              onClick={() => setTab('target')}
              title="The world Kara's program must end up matching"
            >🎯 Target World</button>
          )}
          {hasNotes && (
            <button
              role="tab"
              aria-selected={tab === 'notes'}
              className={`ctx-tab ${tab === 'notes' ? 'active' : ''}`}
              onClick={() => setTab('notes')}
              title={isEditing ? 'Edit the notes shown to students' : 'Notes for this challenge'}
            >📝 Challenge Notes</button>
          )}
        </div>
      </div>

      <div className="world-tabs-body">
        {tab === 'world' && worldTabContent}

        {tab === 'target' && hasTarget && (
          <div className="ctx-target">
            <WorldThumbnail world={challenge.targetWorld} cellSize={cellSize} />
            {(challenge.intermediateCheckpoints?.length ?? 0) > 0 && (
              <p className="ctx-checkpoints-hint">
                This challenge has {challenge.intermediateCheckpoints.length} required intermediate checkpoint{challenge.intermediateCheckpoints.length === 1 ? '' : 's'} — your program must pass through each one (in order) before reaching the target.
              </p>
            )}
          </div>
        )}

        {tab === 'notes' && hasNotes && !isEditing && (
          <div className="ctx-notes">
            {(challenge.notes ?? '').trim()
              ? <MarkdownView markdown={challenge.notes} />
              : <p className="cl-hint"><em>(no notes for this challenge)</em></p>}
          </div>
        )}

        {tab === 'notes' && hasNotes && isEditing && (
          <ChallengeNotesEditor challenge={challenge} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}

// Inline edit / preview UI for the per-challenge notes Markdown.
function ChallengeNotesEditor({ challenge, dispatch }) {
  const [mode, setMode] = useState('edit');
  const notes = challenge.notes ?? '';

  return (
    <div className="challenge-notes-inline-editor">
      <div className="challenge-notes-header">
        <span className="challenge-edit-row-label">Notes for students (Markdown):</span>
        <div className="challenge-notes-tabs">
          <button type="button" className={`view-tab ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>Edit</button>
          <button type="button" className={`view-tab ${mode === 'preview' ? 'active' : ''}`} onClick={() => setMode('preview')}>Preview</button>
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
