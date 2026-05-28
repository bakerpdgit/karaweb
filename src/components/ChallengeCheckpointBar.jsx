import React from 'react';
import { useConfirmModal } from './ConfirmModal.jsx';

/**
 * Bar rendered above the World panel while the teacher is in challenge
 * editor mode. Holds the checkpoint selector (Initial / intermediates
 * / Target / +Add) plus Copy-from-previous and Remove buttons.
 *
 * The Starter / Solution toggle that used to live here was moved to
 * TeacherSolutionBar so the toggle sits with its explanatory blurb.
 */
export default function ChallengeCheckpointBar({
  editing, editingCheckpointIdx, dispatch,
}) {
  const { confirm, modal } = useConfirmModal();
  if (!editing) return null;
  const inter = Array.isArray(editing.intermediateCheckpoints) ? editing.intermediateCheckpoints : [];
  const total = inter.length + 2;
  const idx = Math.max(0, Math.min(editingCheckpointIdx ?? 0, total - 1));
  const isInitial = idx === 0;
  const isTarget  = idx === total - 1;

  const labelFor = (i) => {
    if (i === 0) return 'Initial';
    if (i === total - 1) return 'Target';
    return `Checkpoint ${i}`;
  };

  return (
    <div className="ch-checkpoint-bar">
      <div className="ch-checkpoint-row">
        <span className="ch-checkpoint-label">Editing:</span>
        <div className="challenge-view-tabs">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              className={`view-tab ${i === idx ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'CH_SELECT_CHECKPOINT', idx: i })}
              title={
                i === 0      ? 'Initial world (where Kara starts)' :
                i === total - 1 ? 'Target world (where Kara must finish)' :
                                  `Intermediate checkpoint ${i}`
              }
            >{labelFor(i)}</button>
          ))}
          <button
            className="view-tab"
            title="Insert a new intermediate checkpoint before Target"
            onClick={() => dispatch({ type: 'CH_ADD_CHECKPOINT' })}
          >+ Add</button>
        </div>
        <button
          className="header-btn"
          disabled={isInitial}
          title={isInitial
            ? 'Initial has no previous checkpoint to copy from'
            : "Copy the previous checkpoint's world onto this one"}
          onClick={async () => {
            const ok = await confirm({
              message: "Overwrite this world with the previous checkpoint's?",
              confirmLabel: 'Overwrite',
              variant: 'danger',
            });
            if (ok) dispatch({ type: 'CH_COPY_FROM_PREVIOUS' });
          }}
        >Copy from previous</button>
        {!isInitial && !isTarget && (
          <button
            className="cl-row-btn danger"
            title="Remove this intermediate checkpoint"
            onClick={async () => {
              const ok = await confirm({
                message: 'Remove this intermediate checkpoint?',
                confirmLabel: 'Remove',
                variant: 'danger',
              });
              if (ok) dispatch({ type: 'CH_REMOVE_CHECKPOINT', idx });
            }}
          >✕ Remove</button>
        )}
      </div>
      {modal}
    </div>
  );
}
