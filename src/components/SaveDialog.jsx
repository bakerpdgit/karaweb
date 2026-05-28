import React, { useState, useRef, useEffect } from 'react';

/**
 * Save dialog — minimal. The save mode is decided automatically:
 *  - If the teacher has keydetails + a configured cloud-save backend
 *    (apiBaseUrl + connection tested), the cloud-save block is
 *    embedded. No per-class setup is required — Codehooks and
 *    Google Drive both identify the teacher by the public-key
 *    fingerprint at submission time.
 *  - Otherwise the file is a plain local save.
 *
 * The user sees an info banner explaining which mode applies.
 */
export default function SaveDialog({ onSave, onClose, keydetails, cloudSave }) {
  const [filename, setFilename] = useState('KaraWebWorld');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.select(); }, []);

  const cloudCapable = !!(
    keydetails?.publicKeyJwk
    && cloudSave?.apiBaseUrl
    && cloudSave?.registered);

  const handleOk = () => {
    const name = filename.trim() || 'KaraWebWorld';
    if (cloudCapable) {
      const embed = {
        method:       cloudSave.method ?? 'google-drive',
        apiBaseUrl:   cloudSave.apiBaseUrl,
        publicKeyJwk: keydetails.publicKeyJwk,
        turnstileSiteKey: cloudSave.turnstileSiteKey || undefined,
      };
      // challengeFileGuid is added by App.jsx (handleSave) since it lives on top-level state.
      onSave(name, embed);
    } else {
      onSave(name, null);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal save-dialog" onClick={e => e.stopPropagation()}>
        <h3>Save</h3>
        <p className="save-hint">
          Saves the current world, program and challenges as a <code>.json</code> file.
        </p>

        <div className={`save-mode-banner ${cloudCapable ? 'cloud' : 'local'}`}>
          {cloudCapable
            ? <>
                <strong>☁ Cloud-save file</strong> — students opening this file will be prompted to log in. Results auto-submit to your {cloudSave.method === 'codehooks' ? <>Codehooks backend</> : <>Google Drive Apps Script</>}.
              </>
            : <>
                <strong>💾 Local file</strong> — plain JSON, no cloud connection.
                {!keydetails && <span className="save-mode-detail"> Generate keydetails + configure Cloud Save to enable cloud-save mode.</span>}
                {keydetails && !cloudSave?.registered && <span className="save-mode-detail"> Configure Cloud Save and run <em>Test connection</em> to enable cloud-save mode.</span>}
              </>}
        </div>

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
