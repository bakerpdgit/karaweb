import React, { useEffect, useState } from 'react';
import { hashStudentCode } from '../../utils/studentCodes.js';

/**
 * Pops automatically when the loaded challenges file contains a
 * cloudSave block and we have no studentSession for that file.
 *
 * The student enters their school username + 6-digit code. We re-hash
 * the username with the teacher's public-key modulus and require it
 * to match the code — no network call. On success we set the
 * studentSession and persist it to localStorage so the same browser
 * auto-fills next time.
 *
 * Code derivation is unified across both backends (Google Drive +
 * Codehooks): `sha256(publicKey.n + "|" + username)` → first 3 bytes
 * → mod 1_000_000. The publicKey comes from the loaded cloud-save
 * block so the student doesn't need to know which backend it is.
 *
 * `sessionKey` is the identifier used to namespace this student session
 * in localStorage — challengeFileGuid for google-drive, classCode for
 * codehooks.
 */
export default function StudentLoginModal({
  sessionKey, loadedCloudSave, knownLogin, onLogin, onCancel,
}) {
  const [mode, setMode] = useState(knownLogin ? 'known' : 'entry');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState({ kind: '', message: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(knownLogin ? 'known' : 'entry');
  }, [knownLogin?.username]);

  const publicKeyN = loadedCloudSave?.publicKeyJwk?.n || '';
  const displayLabel = sessionKey ? sessionKey.slice(0, 8) + '…' : 'this class';

  const verify = async () => {
    const u = username.trim().toLowerCase();
    const c = code.trim();
    if (!u) { setStatus({ kind: 'error', message: 'Enter your school username.' }); return; }
    if (!/^\d{6}$/.test(c)) { setStatus({ kind: 'error', message: 'Enter the 6-digit code your teacher gave you.' }); return; }
    if (!publicKeyN) { setStatus({ kind: 'error', message: 'This challenges file is missing the teacher public key.' }); return; }
    setBusy(true);
    try {
      const expected = await hashStudentCode(u, publicKeyN);
      if (expected !== c) {
        setStatus({ kind: 'error', message: 'That username and code don\'t match. Check both, then try again.' });
        return;
      }
      onLogin({ sessionKey, username: u, studentCode: c });
    } catch (err) {
      setStatus({ kind: 'error', message: 'Login failed: ' + (err?.message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal student-login" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Log in to {displayLabel}</h3>
        <p className="modal-help">
          This challenges file records results to your teacher's cloud.
          Enter your school username and the 6-digit code your teacher gave
          you. Your username is checked here in the browser only — it never
          leaves your device.
        </p>
        <p className="modal-help" style={{ fontSize: 11, color: '#78350f' }}>
          🔒 Solutions are encrypted before they're sent. <strong>Don't put
          personal details in code comments.</strong>
        </p>

        {mode === 'known' && knownLogin ? (
          <>
            <p className="student-login-known">
              Last time you logged in as <strong>{knownLogin.username}</strong>
              (code <code>{knownLogin.studentCode}</code>).
            </p>
            <div className="modal-actions">
              <button className="btn-primary"
                onClick={() => onLogin({ ...knownLogin, sessionKey })}>
                Continue as {knownLogin.username}
              </button>
              <button className="btn-secondary"
                onClick={() => { setMode('entry'); setUsername(''); setCode(''); }}>
                Use a different name
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="save-label">
              School username
              <input
                autoFocus
                className="rename-input"
                value={username}
                placeholder="frbloggs"
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verify()}
                spellCheck={false}
              />
            </label>
            <label className="save-label" style={{ marginTop: 8 }}>
              6-digit code
              <input
                className="rename-input"
                value={code}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && verify()}
                spellCheck={false}
              />
            </label>
            {status.message && (
              <div className={`cl-status cl-status-${status.kind || ''}`}>{status.message}</div>
            )}
            <div className="modal-actions">
              <button className="btn-primary" disabled={busy} onClick={verify}>
                {busy ? 'Checking…' : 'Log in'}
              </button>
              <button className="btn-secondary" onClick={onCancel}>Skip (practise only)</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
