import React from 'react';
import { useConfirmModal } from './ConfirmModal.jsx';

/**
 * Action bar rendered above the World panel while the teacher is in
 * challenge editor mode. Holds the per-checkpoint actions: add a new
 * intermediate, copy from previous, and remove the current intermediate.
 *
 * Checkpoint selection itself lives in the tab strip of WorldTabsPanel
 * (Initial / 🚩 1 / 🚩 2 / 🎯 Target / 📝 Notes), so this bar focuses on
 * the mutations the teacher needs to manage the checkpoint sequence.
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

  return (
    <div className="ch-checkpoint-bar">
      <div className="ch-checkpoint-row">
        <span className="ch-checkpoint-label">Checkpoints:</span>
        <button
          className="header-btn"
          title="Insert a new intermediate checkpoint before Target"
          onClick={() => dispatch({ type: 'CH_ADD_CHECKPOINT' })}
        >+ Add checkpoint</button>
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
          >✕ Remove checkpoint {idx}</button>
        )}
      </div>
      {modal}
    </div>
  );
}
