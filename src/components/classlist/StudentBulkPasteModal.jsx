import React, { useState } from 'react';
import { parseBulkUsernames } from '../../utils/studentCodes.js';

/**
 * Paste-in modal: teacher pastes a chunk of usernames separated by
 * new lines, commas or semicolons. We trim, lower-case, dedupe and
 * preview the result before they confirm.
 */
export default function StudentBulkPasteModal({ existingUsernames, onConfirm, onClose }) {
  const [text, setText] = useState('');
  const parsed = parseBulkUsernames(text);
  const existingSet = new Set((existingUsernames ?? []).map(u => String(u).toLowerCase()));
  const newOnes = parsed.filter(u => !existingSet.has(u));
  const dupes   = parsed.filter(u =>  existingSet.has(u));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Paste student usernames</h2>
        <p className="modal-help">
          Separate by new lines, commas <code>,</code> or semicolons <code>;</code>.
          Names are trimmed, lower-cased and de-duplicated.
        </p>
        <textarea
          className="modal-textarea"
          rows={10}
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"frbloggs\njdoe\nasmith"}
        />
        <div className="modal-stats">
          <span>{parsed.length} parsed</span>
          <span className="modal-stats-sep">·</span>
          <span>{newOnes.length} new</span>
          <span className="modal-stats-sep">·</span>
          <span>{dupes.length} already in list</span>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={newOnes.length === 0}
            onClick={() => { onConfirm(newOnes); onClose(); }}
          >Add {newOnes.length} student{newOnes.length === 1 ? '' : 's'}</button>
        </div>
      </div>
    </div>
  );
}
