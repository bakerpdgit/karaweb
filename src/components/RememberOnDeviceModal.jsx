import React from 'react';

/**
 * Generic Yes / No modal asking the teacher whether to persist a
 * just-saved or just-loaded piece of data (keydetails, class list)
 * into this browser's localStorage so they don't have to reload it
 * next time.
 *
 * Two buttons + a shared-computer warning. No "don't ask again"
 * option — every save / load triggers the prompt explicitly.
 */
export default function RememberOnDeviceModal({
  what,             // 'keydetails' | 'class list'
  detail,           // optional sub-text (e.g. the class code)
  onYes,
  onNo,
}) {
  return (
    <div className="modal-overlay" onClick={onNo}>
      <div className="modal remember-modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Remember this {what} in this browser?</h3>
        <p className="modal-help">
          Store this {what}{detail ? ` (${detail})` : ''} on this device for next time?
        </p>
        <p className="modal-help" style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 4, padding: 8 }}>
          ⚠ Only Yes on a personal computer — anyone using this browser can read stored data.
        </p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onNo}>No, just this session</button>
          <button className="btn-primary"   onClick={onYes}>Yes, remember on this device</button>
        </div>
      </div>
    </div>
  );
}
