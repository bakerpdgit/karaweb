import React, { useEffect, useState } from 'react';
import { generateMemorablePassword } from '../../utils/passwordGenerator.js';

/**
 * Two-mode dialog driving the optional keydetails-file password
 * protection.
 *
 *  mode='set'    — generate / regenerate a password and accept it.
 *                  Used immediately after key generation (when the
 *                  teacher ticks Password-protect during keygen) and
 *                  when toggling password-protection on an existing
 *                  keypair.
 *  mode='unlock' — collect a password to decrypt an encrypted
 *                  keydetails file (either just loaded from disk, or
 *                  re-prompted after the 60-min idle timeout).
 *
 * Callers:
 *  - onAccept(password)  in 'set' mode
 *  - onSubmit(password)  in 'unlock' mode; the caller does the actual
 *                        decrypt and surfaces errors via `errorText`.
 *  - onCancel()          dismisses without committing.
 */
export default function KeydetailsPasswordModal({
  mode,
  errorText,
  busy,
  onAccept,
  onSubmit,
  onCancel,
}) {
  const isSet = mode === 'set';
  const [password, setPassword] = useState(() => (isSet ? generateMemorablePassword() : ''));
  const [copied, setCopied] = useState(false);

  // When the parent surfaces an error (wrong password etc.) we clear
  // the local field so the user retypes — typing on top of a stale
  // failure value is confusing.
  useEffect(() => {
    if (errorText && !isSet) setPassword('');
  }, [errorText, isSet]);

  const regen = () => {
    setPassword(generateMemorablePassword());
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Ignore — some browsers block clipboard access. The password
      // is visible on screen so the user can still copy manually.
    }
  };

  const submit = () => {
    if (busy) return;
    if (isSet) onAccept(password);
    else onSubmit(password);
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="modal keydetails-password-modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">
          {isSet ? '🔐 Choose a password for your keydetails file' : '🔓 Unlock your keydetails'}
        </h3>

        {isSet ? (
          <>
            <p className="modal-help">
              Click 🔄 to cycle, Accept when you like one.
            </p>
            <p className="modal-help" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 4, padding: 10, color: '#7f1d1d' }}>
              ⚠ <strong>Write it down before Accept.</strong> No reset if lost —
              you'd need a fresh keypair and Apps Script.
            </p>
            <div className="kpwm-password-row">
              <code className="kpwm-password">{password}</code>
              <button className="kpwm-icon-btn" onClick={regen} title="Regenerate" disabled={busy}>🔄</button>
              <button className="kpwm-icon-btn" onClick={copy} title="Copy to clipboard" disabled={busy}>
                {copied ? '✓' : '📋'}
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
              <button className="btn-primary"   onClick={submit}   disabled={busy}>
                {busy ? 'Encrypting…' : 'Accept and encrypt'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-help">
              Your keydetails file is password-protected. Enter the
              password you set when you generated or last re-exported it.
            </p>
            <label className="save-label">
              Password
              <input
                autoFocus
                type="password"
                className="rename-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                disabled={busy}
                spellCheck={false}
              />
            </label>
            {errorText && (
              <div className="cl-status cl-status-error">{errorText}</div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
              <button className="btn-primary"   onClick={submit}   disabled={busy || !password}>
                {busy ? 'Decrypting…' : 'Unlock'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
