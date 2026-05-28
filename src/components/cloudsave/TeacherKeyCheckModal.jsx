import React, { useRef, useState } from 'react';
import { parseKeyDetailsFile } from '../../utils/keyDetailsFile.js';
import { setKeyDetails } from '../../utils/localStore.js';
import RememberOnDeviceModal from '../RememberOnDeviceModal.jsx';

/**
 * Prompts the teacher to upload their keydetails file before letting
 * them exit a challenge or open the challenge editor in a cloud-save
 * challenges file.
 *
 * Verification: the uploaded keydetails file contains both the public
 * and the private key for the teacher's keypair. We compare its
 * publicKeyJwk.n to the publicKeyJwk.n embedded in the loaded cloud-
 * save block. A match means this is the right keydetails for this
 * challenges file — the teacher then has the private key needed to
 * decrypt any results that have been submitted.
 *
 * On success we both adopt the loaded keypair into app state (so the
 * other tabs unlock) and call the parent's onSuccess callback.
 */
export default function TeacherKeyCheckModal({
  requiredPublicKeyJwk, action, onSuccess, onCancel, dispatch,
}) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  // After a successful file load we ask the teacher whether to persist
  // the loaded keys on this device. The parsed keypair is parked here
  // until they answer; on Yes we write localStorage, on No we move on
  // session-only.
  const [rememberPrompt, setRememberPrompt] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      const parsed = parseKeyDetailsFile(text);
      const got = parsed?.publicKeyJwk?.n;
      const want = requiredPublicKeyJwk?.n;
      if (!got || !want) {
        setStatus({ kind: 'error', message: 'Could not read public key from the file.' });
        return;
      }
      if (got !== want) {
        setStatus({ kind: 'error', message: 'This is a valid keydetails file but it does not match the keys this challenges file was saved with. Try a different file.' });
        return;
      }
      // Adopt the keys into app state so the other cloud tabs unlock.
      // Then prompt to remember-on-device before running the gated action.
      dispatch({
        type: 'KEY_SET',
        keydetails: {
          publicKeyJwk:  parsed.publicKeyJwk,
          privateKeyJwk: parsed.privateKeyJwk,
        },
      });
      setStatus({ kind: 'ok', message: '✓ Keys match.' });
      setRememberPrompt({
        publicKeyJwk: parsed.publicKeyJwk,
        privateKeyJwk: parsed.privateKeyJwk,
      });
    } catch (err) {
      setStatus({ kind: 'error', message: 'Could not load the keydetails file: ' + (err?.message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  const confirmRemember = (yes) => {
    if (rememberPrompt && yes) {
      setKeyDetails({
        publicKeyJwk: rememberPrompt.publicKeyJwk,
        privateKeyJwk: rememberPrompt.privateKeyJwk,
        savedAt: new Date().toISOString(),
      });
    }
    setRememberPrompt(null);
    onSuccess?.();
  };

  const actionLabel = action === 'edit' ? 'editing challenges' : 'exiting challenge mode';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal student-login" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Teacher verification required</h3>
        <p className="modal-help">
          Before {actionLabel}, please load your <strong>keydetails</strong> file so we can confirm you're
          the teacher who created this challenges file. The file's public key
          will be checked against the one embedded in this challenges book — if
          they match, you're verified.
        </p>
        <p className="modal-help">
          The file stays only in this browser; nothing is uploaded anywhere.
        </p>

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >{busy ? 'Checking…' : 'Load keydetails file…'}</button>
          <input
            type="file"
            accept=".txt,.json,text/plain,application/json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={onFile}
          />
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>

        {status?.message && (
          <div className={`cl-status cl-status-${status.kind || ''}`}>{status.message}</div>
        )}
      </div>
      {rememberPrompt && (
        <RememberOnDeviceModal
          what="keydetails"
          onYes={() => confirmRemember(true)}
          onNo={() => confirmRemember(false)}
        />
      )}
    </div>
  );
}
