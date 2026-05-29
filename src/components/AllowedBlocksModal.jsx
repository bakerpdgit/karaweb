import React, { useState } from 'react';
import { DISABLEABLE_BLOCKS } from '../python/blocks/toolbox.js';

/**
 * Lets the teacher tick which Blockly blocks are available to the
 * student for one specific challenge. Unchecked blocks are removed
 * from the BlocksEditor toolbox via `filterToolbox()`. The Variables
 * and Functions categories are dynamic flyouts and aren't toggleable
 * here (omitted from `DISABLEABLE_BLOCKS`).
 */
export default function AllowedBlocksModal({
  disallowedBlocks = [],
  onSave,
  onCancel,
}) {
  // Local mirror keyed by block type for fast toggling. true = allowed.
  const [allowed, setAllowed] = useState(() => {
    const banned = new Set(disallowedBlocks);
    const map = {};
    for (const cat of DISABLEABLE_BLOCKS) {
      for (const b of cat.blocks) map[b.type] = !banned.has(b.type);
    }
    return map;
  });

  const toggle = (type) => setAllowed(prev => ({ ...prev, [type]: !prev[type] }));
  const setCategory = (category, value) => setAllowed(prev => {
    const next = { ...prev };
    for (const b of category.blocks) next[b.type] = value;
    return next;
  });

  const onSaveClick = () => {
    const next = [];
    for (const cat of DISABLEABLE_BLOCKS) {
      for (const b of cat.blocks) if (!allowed[b.type]) next.push(b.type);
    }
    onSave?.(next);
  };

  const disabledCount = Object.values(allowed).filter(v => !v).length;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal allowed-blocks-modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Allowed blocks for this challenge</h3>
        <p className="modal-help">
          Untick any block you don't want students to use. Unticked
          blocks won't appear in the toolbox while taking this
          challenge. <strong>Variables</strong> and <strong>Functions</strong> are
          dynamic and can't be restricted here.
        </p>

        <div className="allowed-blocks-grid">
          {DISABLEABLE_BLOCKS.map(cat => {
            const allOn  = cat.blocks.every(b => allowed[b.type]);
            const allOff = cat.blocks.every(b => !allowed[b.type]);
            return (
              <div key={cat.category} className="allowed-blocks-cat">
                <div className="allowed-blocks-cat-head">
                  <span className="allowed-blocks-swatch" style={{ background: cat.colour }} />
                  <strong>{cat.category}</strong>
                  <button
                    type="button"
                    className="allowed-blocks-quick"
                    onClick={() => setCategory(cat, true)}
                    disabled={allOn}
                  >All</button>
                  <button
                    type="button"
                    className="allowed-blocks-quick"
                    onClick={() => setCategory(cat, false)}
                    disabled={allOff}
                  >None</button>
                </div>
                <div className="allowed-blocks-list">
                  {cat.blocks.map(b => (
                    <label key={b.type} className="allowed-blocks-row">
                      <input
                        type="checkbox"
                        checked={!!allowed[b.type]}
                        onChange={() => toggle(b.type)}
                      />
                      <span>{b.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onSaveClick}>
            {disabledCount === 0
              ? 'Save (all blocks allowed)'
              : `Save (${disabledCount} disabled)`}
          </button>
        </div>
      </div>
    </div>
  );
}
