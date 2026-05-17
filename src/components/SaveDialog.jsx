import React, { useState, useRef, useEffect } from 'react';

export default function SaveDialog({ onSave, onClose }) {
  const [filename, setFilename] = useState('KaraWebWorld');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleOk = () => {
    const name = filename.trim() || 'KaraWebWorld';
    onSave(name);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal save-dialog" onClick={e => e.stopPropagation()}>
        <h3>Save World</h3>
        <p className="save-hint">
          Saves the current world layout and FSM as a <code>.json</code> file.
        </p>
        <label className="save-label">
          File name:
          <input
            ref={inputRef}
            className="rename-input"
            value={filename}
            onChange={e => setFilename(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleOk();
              if (e.key === 'Escape') onClose();
            }}
            spellCheck={false}
          />
        </label>
        <p className="save-preview">Will download as: <strong>{(filename.trim() || 'KaraWebWorld')}.json</strong></p>
        <div className="modal-actions">
          <button className="btn-primary" onClick={handleOk}>OK</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
