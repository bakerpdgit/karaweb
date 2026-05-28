import React, { useState } from 'react';
import { suggestSuffix } from '../../utils/studentCodes.js';
import { useConfirmModal } from '../ConfirmModal.jsx';

/**
 * Surfaced inline in the ClassListPanel when two or more usernames
 * hash to the same 6-digit code. Lets the teacher rename one of the
 * conflicting usernames (with an auto-suggestion of `name1`).
 *
 * Calls onRename(oldUsername, newUsername) which the parent uses to
 * mutate its student list (recomputing codes & collisions).
 */
export default function CollisionResolver({ collisions, takenCodes, publicKeyN, onRename }) {
  if (!collisions || collisions.length === 0) return null;
  return (
    <div className="collision-resolver">
      <div className="collision-title">⚠ Username collisions ({collisions.length})</div>
      <p className="collision-help">
        Two or more students hash to the same 6-digit code. Rename one of each
        conflicting pair (we suggest appending a digit). The student whose
        username changes should be told to type the new effective name.
      </p>
      {collisions.map(group => (
        <CollisionGroup
          key={group.code}
          group={group}
          takenCodes={takenCodes}
          publicKeyN={publicKeyN}
          onRename={onRename}
        />
      ))}
    </div>
  );
}

function CollisionGroup({ group, takenCodes, publicKeyN, onRename }) {
  const [busy, setBusy] = useState(false);
  const { alert: showAlert, modal } = useConfirmModal();
  const fix = async (username) => {
    setBusy(true);
    try {
      const suggestion = await suggestSuffix(username, takenCodes, publicKeyN);
      if (!suggestion) {
        await showAlert({ message: 'No free suffix after 100 attempts. Pick a different username.' });
        return;
      }
      onRename(username, suggestion.username);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="collision-group">
      <div className="collision-code">Code <code>{group.code}</code></div>
      {group.usernames.map(u => (
        <div key={u} className="collision-row">
          <code className="collision-username">{u}</code>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => fix(u)}
          >Add digit suffix to this one</button>
        </div>
      ))}
      {modal}
    </div>
  );
}
