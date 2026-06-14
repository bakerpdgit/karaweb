import React, { useState } from 'react';
import MarkdownView from './MarkdownView.jsx';
import WorldEditor from './WorldEditor.jsx';

/**
 * Top-level tabbed panel that hosts the World editor (always visible)
 * plus per-challenge **Target World**, intermediate checkpoint, and
 * **Challenge Notes** tabs.
 *
 *   No challenge active:
 *     [🌍 World]
 *
 *   Student solving a challenge:
 *     [🌍 World] [🎯 Target World] [📝 Challenge Notes]
 *     When the student toggles "Show intermediates" on the Target tab,
 *     the intermediate checkpoint tabs (🚩 1, 🚩 2 …) appear between
 *     World and Target World as read-only previews.
 *
 *   Teacher editing a challenge:
 *     [Initial] [🚩 1] [🚩 2] [🎯 Target] [📝 Challenge Notes]
 *     Clicking a checkpoint tab dispatches CH_SELECT_CHECKPOINT, so the
 *     live World editor underneath shows the selected checkpoint to
 *     paint. The notes tab swaps to the inline notes editor.
 *
 * The actual world view (WorldEditor + any below-the-world chrome) is
 * passed in as `worldTabContent` so this component stays decoupled
 * from the editor's own prop wiring.
 */
export default function WorldTabsPanel({
  challenge,              // active or editing challenge (may be null)
  isEditing = false,      // true → editor mode: tabs drive checkpoint selection
  editingCheckpointIdx = 0, // teacher's current checkpoint (editor mode)
  dispatch,
  worldTabContent,        // JSX rendered for any world (= checkpoint) tab
  cellSize = 38,           // matches the zoom level of the live World view
  onCellSizeChange,        // shared setter — keeps both tabs at the same zoom
}) {
  const inters = Array.isArray(challenge?.intermediateCheckpoints)
    ? challenge.intermediateCheckpoints
    : [];
  const interCount = inters.length;
  const hasTarget = !!challenge?.targetWorld;
  const hasNotes  = !!challenge && (((challenge.notes ?? '').trim()) || isEditing);

  // Student-only: whether to show the intermediate checkpoint tabs.
  // Toggled from the hint paragraph on the Target World tab.
  const [showIntermediates, setShowIntermediates] = useState(false);

  // Student-side active tab. Editor side derives the active world tab
  // from `editingCheckpointIdx`, and tracks the notes tab separately.
  const [studentTab, setStudentTab] = useState('world');
  const [editorOnNotes, setEditorOnNotes] = useState(false);

  // Snap back if active tab becomes invalid (challenge cleared, target
  // gone, intermediates hidden, notes vanished etc.).
  React.useEffect(() => {
    if (isEditing) return;
    if (studentTab === 'target' && !hasTarget) { setStudentTab('world'); return; }
    if (studentTab === 'notes'  && !hasNotes)  { setStudentTab('world'); return; }
    if (studentTab.startsWith('int-')) {
      const i = parseInt(studentTab.slice(4), 10);
      if (!Number.isFinite(i) || i >= interCount || !showIntermediates) {
        setStudentTab('world');
      }
    }
  }, [studentTab, hasTarget, hasNotes, interCount, showIntermediates, isEditing]);

  React.useEffect(() => {
    if (isEditing && editorOnNotes && !hasNotes) setEditorOnNotes(false);
  }, [isEditing, editorOnNotes, hasNotes]);

  // Tab button helper.
  const tabBtn = (id, label, opts) => (
    <button
      key={id}
      role="tab"
      aria-selected={!!opts.active}
      className={`ctx-tab ${opts.active ? 'active' : ''}`}
      onClick={opts.onClick}
      title={opts.title}
    >{label}</button>
  );

  // Build the tab list + body for each mode.
  let tabs;
  let body;

  if (isEditing) {
    const totalCheckpoints = interCount + 2;
    const activeIdx = editorOnNotes
      ? null
      : Math.max(0, Math.min(editingCheckpointIdx ?? 0, totalCheckpoints - 1));
    const selectCheckpoint = (idx) => {
      setEditorOnNotes(false);
      dispatch({ type: 'CH_SELECT_CHECKPOINT', idx });
    };

    tabs = [];
    tabs.push(tabBtn('cp-initial', 'Initial', {
      active: activeIdx === 0,
      onClick: () => selectCheckpoint(0),
      title: 'Initial world (where Kara starts)',
    }));
    for (let i = 0; i < interCount; i++) {
      const idx = i + 1;
      tabs.push(tabBtn(`cp-${idx}`, `🚩 ${idx}`, {
        active: activeIdx === idx,
        onClick: () => selectCheckpoint(idx),
        title: `Intermediate checkpoint ${idx}`,
      }));
    }
    tabs.push(tabBtn('cp-target', '🎯 Target', {
      active: activeIdx === totalCheckpoints - 1,
      onClick: () => selectCheckpoint(totalCheckpoints - 1),
      title: "Target world (where Kara must finish)",
    }));
    if (hasNotes) {
      tabs.push(tabBtn('cp-notes', '📝 Challenge Notes', {
        active: editorOnNotes,
        onClick: () => setEditorOnNotes(true),
        title: 'Edit the notes shown to students',
      }));
    }

    body = editorOnNotes
      ? <ChallengeNotesEditor challenge={challenge} dispatch={dispatch} />
      : worldTabContent;
  } else {
    const showStudentInter = showIntermediates && interCount > 0;
    tabs = [];
    tabs.push(tabBtn('world', '🌍 World', {
      active: studentTab === 'world',
      onClick: () => setStudentTab('world'),
      title: "Kara's current world — paint cells, place Kara",
    }));
    if (showStudentInter) {
      for (let i = 0; i < interCount; i++) {
        tabs.push(tabBtn(`int-${i}`, `🚩 ${i + 1}`, {
          active: studentTab === `int-${i}`,
          onClick: () => setStudentTab(`int-${i}`),
          title: `Intermediate checkpoint ${i + 1} — your program must pass through this world`,
        }));
      }
    }
    if (hasTarget) {
      tabs.push(tabBtn('target', '🎯 Target World', {
        active: studentTab === 'target',
        onClick: () => setStudentTab('target'),
        title: "The world Kara's program must end up matching",
      }));
    }
    if (hasNotes) {
      tabs.push(tabBtn('notes', '📝 Challenge Notes', {
        active: studentTab === 'notes',
        onClick: () => setStudentTab('notes'),
        title: 'Notes for this challenge',
      }));
    }

    if (studentTab === 'world') {
      body = worldTabContent;
    } else if (studentTab.startsWith('int-')) {
      const i = parseInt(studentTab.slice(4), 10);
      const interWorld = inters[i];
      body = interWorld ? (
        <div className="ctx-target">
          <WorldEditor
            world={interWorld}
            simMode="edit"
            worldTool={null}
            dispatch={() => {}}
            cellSize={cellSize}
            onCellSizeChange={onCellSizeChange}
            readOnly
            variant="world"
          />
          <p className="ctx-checkpoints-hint">
            Intermediate checkpoint {i + 1} of {interCount} — Kara must
            pass through this world (in order) before reaching the target.
          </p>
        </div>
      ) : null;
    } else if (studentTab === 'target' && hasTarget) {
      body = (
        <div className="ctx-target">
          <WorldEditor
            world={challenge.targetWorld}
            simMode="edit"
            worldTool={null}
            dispatch={() => {}}
            cellSize={cellSize}
            onCellSizeChange={onCellSizeChange}
            readOnly
            variant="target"
          />
          {interCount > 0 && (
            <p className="ctx-checkpoints-hint">
              This challenge has {interCount} required intermediate checkpoint{interCount === 1 ? '' : 's'} — your program must pass through each one (in order) before reaching the target.{' '}
              <button
                type="button"
                className="ctx-checkpoints-toggle"
                onClick={() => setShowIntermediates(v => !v)}
              >
                {showIntermediates ? 'Hide intermediates' : 'Show intermediates'}
              </button>
            </p>
          )}
        </div>
      );
    } else if (studentTab === 'notes' && hasNotes) {
      body = (
        <div className="ctx-notes">
          {(challenge.notes ?? '').trim()
            ? <MarkdownView markdown={challenge.notes} />
            : <p className="cl-hint"><em>(no notes for this challenge)</em></p>}
        </div>
      );
    }
  }

  return (
    <div className="panel world-tabs-panel">
      <div className="ctx-panel-header">
        <div className="ctx-panel-tabs" role="tablist">
          {tabs}
        </div>
      </div>

      <div className="world-tabs-body">
        {body}
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
