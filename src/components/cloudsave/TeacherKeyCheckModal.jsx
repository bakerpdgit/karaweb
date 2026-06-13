import React, { useRef, useState } from 'react';
import { parseKeyDetailsFile, unlockKeyDetailsFile } from '../../utils/keyDetailsFile.js';
import { setKeyDetails } from '../../utils/localStore.js';
import { deriveSubmissionVerifier } from '../../utils/passwordVerifier.js';
import RememberOnDeviceModal from '../RememberOnDeviceModal.jsx';
import KeydetailsPasswordModal from './KeydetailsPasswordModal.jsx';
import { useConfirmModal } from '../ConfirmModal.jsx';

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
  // Pops after a v3 (encrypted) file is selected — the teacher must
  // supply the password to prove they're the actual teacher, not just
  // someone holding the file. Shape: { publicKeyJwk, encryptedKeyPair,
  // busy, errorText } | null.
  const [unlockPrompt, setUnlockPrompt] = useState(null);
  const { confirm, modal: confirmModalEl } = useConfirmModal();

  const onDetach = async () => {
    const ok = await confirm({
      title: 'Open as a detached book?',
      message: 'Any encrypted (hidden) solutions will be permanently removed from this in-memory copy — you cannot recover them without the original keydetails. The cloud-save backend settings will also be cleared so submissions no longer go to the original teacher. You can then save the result as a fresh challenges file under a new keydetails. Continue?',
      confirmLabel: 'Detach and open',
      variant: 'danger',
    });
    if (!ok) return;
    dispatch({ type: 'CH_DETACH_AS_PLAIN' });
    onSuccess?.();
  };

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
      // v3 (encrypted) file → the public key matches but we still need
      // the password to prove the holder is the teacher (and to obtain
      // the private key needed for Analyse decryption later).
      if (parsed.encryptedKeyPair) {
        setStatus({ kind: 'ok', message: '✓ Public key matches — please enter your keydetails password.' });
        setUnlockPrompt({
          publicKeyJwk:     parsed.publicKeyJwk,
          encryptedKeyPair: parsed.encryptedKeyPair,
          busy:             false,
          errorText:        null,
        });
        return;
      }
      // v1 / v2 (plaintext) — adopt the keys into app state so the
      // other cloud tabs unlock. Then prompt to remember-on-device
      // before running the gated action.
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
      // For v3 (encrypted) files we persist the encrypted blob — never
      // the plaintext private key. The teacher will be prompted for
      // the password on next session boot.
      const base = {
        publicKeyJwk: rememberPrompt.publicKeyJwk,
        savedAt: new Date().toISOString(),
      };
      if (rememberPrompt.encryptedKeyPair) {
        setKeyDetails({ ...base, encryptedKeyPair: rememberPrompt.encryptedKeyPair });
      } else {
        setKeyDetails({ ...base, privateKeyJwk: rememberPrompt.privateKeyJwk });
      }
    }
    setRememberPrompt(null);
    onSuccess?.();
  };

  const onUnlockSubmit = async (password) => {
    if (!unlockPrompt) return;
    setUnlockPrompt(p => p ? { ...p, busy: true, errorText: null } : p);
    try {
      const { privateKeyJwk } = await unlockKeyDetailsFile(
        unlockPrompt.encryptedKeyPair, password,
      );
      const submissionVerifier = await deriveSubmissionVerifier(
        password, unlockPrompt.publicKeyJwk,
      );
      dispatch({
        type: 'KEY_SET',
        keydetails: {
          publicKeyJwk:     unlockPrompt.publicKeyJwk,
          privateKeyJwk,
          encryptedKeyPair: unlockPrompt.encryptedKeyPair,
          submissionVerifier,
        },
      });
      setStatus({ kind: 'ok', message: '✓ Keys matched and unlocked.' });
      setRememberPrompt({
        publicKeyJwk:     unlockPrompt.publicKeyJwk,
        privateKeyJwk,
        encryptedKeyPair: unlockPrompt.encryptedKeyPair,
      });
      setUnlockPrompt(null);
    } catch (err) {
      setUnlockPrompt(p => p ? { ...p, busy: false, errorText: err?.message ?? String(err) } : p);
    }
  };

  const onUnlockCancel = () => {
    setUnlockPrompt(null);
    setStatus({ kind: 'error', message: 'Unlock cancelled. Try again or load a different file.' });
  };

  const actionLabel =
    action === 'edit' ? 'editing challenges'
    : action === 'exitBook' ? 'closing this challenge book'
    : 'exiting challenge mode';

  return (
    <>
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

          {action === 'edit' && (
            <>
              <hr style={{ margin: '20px 0 12px', border: 0, borderTop: '1px solid #ddd' }} />
              <p className="modal-help">
                <strong>Lost your keydetails?</strong> You can still open this
                as a plain (detached) book — encrypted solutions and the
                cloud-save backend settings will be removed. Useful for
                re-saving the challenges under a new keydetails, or for
                sharing with another teacher who'll use their own keys.
              </p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={onDetach} disabled={busy}>
                  Open as detached book…
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {unlockPrompt && (
        <KeydetailsPasswordModal
          mode="unlock"
          busy={unlockPrompt.busy}
          errorText={unlockPrompt.errorText}
          onSubmit={onUnlockSubmit}
          onCancel={onUnlockCancel}
        />
      )}
      {rememberPrompt && (
        <RememberOnDeviceModal
          what="keydetails"
          onYes={() => confirmRemember(true)}
          onNo={() => confirmRemember(false)}
        />
      )}
      {confirmModalEl}
    </>
  );
}
