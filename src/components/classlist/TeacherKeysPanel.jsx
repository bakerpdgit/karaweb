import React, { useRef, useState } from 'react';
import { generateKeyPair } from '../../utils/crypto/rsaOaep.js';
import {
  buildKeyDetailsFile, parseKeyDetailsFile, downloadKeyDetails,
  unlockKeyDetailsFile,
} from '../../utils/keyDetailsFile.js';
import { encryptPlaintextWithPassword } from '../../utils/crypto/passwordKey.js';
import { deriveSubmissionVerifier } from '../../utils/passwordVerifier.js';
import { computeStudentCodes } from '../../utils/studentCodes.js';
import { setKeyDetails, removeKeyDetails, getKeyDetails } from '../../utils/localStore.js';
import RememberOnDeviceModal from '../RememberOnDeviceModal.jsx';
import KeydetailsPasswordModal from '../cloudsave/KeydetailsPasswordModal.jsx';
import AboutCloudSubmissionsModal from '../cloudsave/AboutCloudSubmissionsModal.jsx';
import { useConfirmModal } from '../ConfirmModal.jsx';

/**
 * Teacher Keys panel — first tab after Challenges.
 *
 * One keydetails file per teacher. The same keypair can be used across
 * every class and every challenge book. Multiple teachers in the same
 * school CAN choose to share one keydetails file if they want their
 * cloud-save submissions to land in the same data store (and any of
 * them to be able to read it).
 *
 * Class lists and cloud-save settings stay disabled until keys exist.
 */
export default function TeacherKeysPanel({ keydetails, dispatch, requestPrivateKey }) {
  const [busyKeys,  setBusyKeys]  = useState(false);
  const [status,    setStatus]    = useState(null);   // {kind,message}
  const [rememberModal, setRememberModal] = useState(null);   // {publicKeyJwk, privateKeyJwk, encryptedKeyPair?} | null
  // The user's intent for the next generate / load round-trip.
  // Persists across that one trip so generate→prompt→encrypt flow
  // doesn't lose the choice. Set inside the Generate-options modal.
  const [protectPwd, setProtectPwd] = useState(false);
  // Generate-options modal (replaces the inline checkbox). When non-null
  // the dialog is shown; OK calls generateKeys, Cancel just closes.
  const [genOptsModal, setGenOptsModal] = useState(null);
  // Set-password modal state. When non-null, the modal is shown.
  //   { pendingPublicJwk, pendingPrivateJwk, busy, onAfter: (encOrNull) => void }
  const [setPwModal, setSetPwModal] = useState(null);
  // Unlock-on-load modal state — pops when the user loaded a v3 file.
  //   { encryptedKeyPair, busy, errorText, source: 'load'|'reExport' }
  const [unlockModal, setUnlockModal] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  // Info banner shown after a successful add/change/remove password
  // transition. `kind` controls the message; null hides the banner.
  //   { kind: 'added' | 'changed' | 'removed' } | null
  const [lastTransition, setLastTransition] = useState(null);
  const { confirm, modal: confirmModalEl } = useConfirmModal();
  const fileInputRef = useRef(null);

  // Hand off to the Yes/No "remember on this device" prompt. Yes →
  // localStorage; No → only kept in app state for this session.
  // If `encryptedKeyPair` is supplied, the persisted form is the
  // encrypted blob + public key (no plaintext private key on disk).
  const offerToRemember = (publicKeyJwk, privateKeyJwk, statusMessage, encryptedKeyPair = null) => {
    setRememberModal({ publicKeyJwk, privateKeyJwk, encryptedKeyPair, statusMessage });
  };

  const confirmRemember = (yes) => {
    if (!rememberModal) return;
    if (yes) {
      const base = {
        publicKeyJwk: rememberModal.publicKeyJwk,
        savedAt:      new Date().toISOString(),
      };
      if (rememberModal.encryptedKeyPair) {
        setKeyDetails({ ...base, encryptedKeyPair: rememberModal.encryptedKeyPair });
      } else {
        setKeyDetails({ ...base, privateKeyJwk: rememberModal.privateKeyJwk });
      }
      setStatus({ message: (rememberModal.statusMessage || 'Keys saved.') + ' Stored on this device.', kind: 'ok' });
    } else {
      setStatus({ message: (rememberModal.statusMessage || 'Keys saved.') + ' Not stored on this device (session only).', kind: 'ok' });
    }
    setRememberModal(null);
  };

  // Open the Generate-options dialog. If keys already exist, the
  // replace-confirmation lives inside generateKeys (called from the OK
  // button) so the teacher only sees one extra step at a time.
  const openGenerateOptions = () => {
    setGenOptsModal({ protectPwd });
  };

  // `protect` is passed explicitly by the Generate-options modal so we
  // don't race React's deferred setState — the state mirror
  // `protectPwd` is just for remembering the last choice across opens.
  const generateKeysWithProtect = async (protect) => {
    if (keydetails) {
      const ok = await confirm({
        title: 'Replace existing keys?',
        message: 'Generating new keys orphans every previously-submitted result and requires re-deploying your Apps Script with the new public key.',
        confirmLabel: 'Generate new keys',
        variant: 'danger',
      });
      if (!ok) return;
    }
    setBusyKeys(true);
    setStatus({ message: 'Generating 4096-bit RSA key pair…' });
    try {
      const { publicKeyJwk, privateKeyJwk } = await generateKeyPair();
      // If the teacher ticked Password-protect we route through the
      // set-password modal *before* downloading / persisting so the
      // password lives only in their head (and the encrypted file).
      if (protect) {
        setBusyKeys(false);
        setSetPwModal({
          pendingPublicJwk: publicKeyJwk,
          pendingPrivateJwk: privateKeyJwk,
          busy: false,
          onAfter: async (password) => {
            // Encrypt once for the downloaded file AND for localStorage.
            const fileObj = await buildKeyDetailsFile({ publicKeyJwk, privateKeyJwk, password });
            downloadKeyDetails(fileObj);
            const encryptedKeyPair = await encryptPlaintextWithPassword(
              { publicKeyJwk, privateKeyJwk }, password,
            );
            // Derive the cloud-backend submission verifier from the
            // same password so subsequent Analyse fetches can prove
            // password knowledge without re-prompting.
            const submissionVerifier = await deriveSubmissionVerifier(password, publicKeyJwk);
            dispatch({ type: 'KEY_SET', keydetails: {
              publicKeyJwk, privateKeyJwk, encryptedKeyPair, submissionVerifier,
            }});
            offerToRemember(publicKeyJwk, privateKeyJwk,
              'Keys generated, encrypted, and downloaded — keep both the file AND the password safe.',
              encryptedKeyPair);
          },
        });
        return;
      }
      // Unencrypted path.
      dispatch({ type: 'KEY_SET', keydetails: { publicKeyJwk, privateKeyJwk } });
      const fileObj = await buildKeyDetailsFile({ publicKeyJwk, privateKeyJwk });
      downloadKeyDetails(fileObj);
      offerToRemember(publicKeyJwk, privateKeyJwk, 'Keys generated and downloaded — keep the file safe.');
    } catch (err) {
      setStatus({ message: 'Key generation failed: ' + (err?.message ?? err), kind: 'error' });
    } finally {
      setBusyKeys(false);
    }
  };

  const reExport = async () => {
    if (!keydetails) return;
    try {
      // If the teacher's keypair is currently locked (boot-locked or
      // idle-locked), prompt for the password before we can rebuild.
      const privateKeyJwk = await requestPrivateKey();
      if (keydetails.encryptedKeyPair) {
        // Re-encrypting needs the password again (we'd otherwise have
        // to remember the plaintext password, which we deliberately
        // don't). The set-password modal lets the teacher either keep
        // the same password (re-type) or generate a new one.
        setSetPwModal({
          pendingPublicJwk: keydetails.publicKeyJwk,
          pendingPrivateJwk: privateKeyJwk,
          busy: false,
          onAfter: async (password) => {
            const fileObj = await buildKeyDetailsFile({
              publicKeyJwk: keydetails.publicKeyJwk, privateKeyJwk, password,
            });
            downloadKeyDetails(fileObj);
            const encryptedKeyPair = await encryptPlaintextWithPassword(
              { publicKeyJwk: keydetails.publicKeyJwk, privateKeyJwk }, password,
            );
            const submissionVerifier = await deriveSubmissionVerifier(
              password, keydetails.publicKeyJwk,
            );
            dispatch({ type: 'KEY_SET', keydetails: {
              publicKeyJwk: keydetails.publicKeyJwk, privateKeyJwk, encryptedKeyPair, submissionVerifier,
            }});
            setStatus({ message: 'Keydetails re-exported (encrypted).', kind: 'ok' });
          },
        });
        return;
      }
      // Unencrypted re-export.
      const fileObj = await buildKeyDetailsFile({
        publicKeyJwk: keydetails.publicKeyJwk, privateKeyJwk,
      });
      downloadKeyDetails(fileObj);
      setStatus({ message: 'Keydetails re-exported.', kind: 'ok' });
    } catch (err) {
      setStatus({ message: 'Re-export failed: ' + (err?.message ?? err), kind: 'error' });
    }
  };

  const forgetOnDevice = async () => {
    const ok = await confirm({
      title: 'Forget stored keys?',
      message: 'Session keys stay until reload; next boot loads without them.',
      confirmLabel: 'Forget',
      variant: 'danger',
    });
    if (!ok) return;
    removeKeyDetails();
    setStatus({ message: 'Stored keys cleared from this browser.', kind: 'ok' });
  };

  // ── Add / change / remove password on the currently-loaded keydetails ──
  // Shared finisher: encrypt + dispatch + download + offer-remember +
  // banner. `kind` is 'added' | 'changed'.
  const finishProtect = async (privateKeyJwk, password, kind) => {
    const publicKeyJwk = keydetails.publicKeyJwk;
    const encryptedKeyPair = await encryptPlaintextWithPassword(
      { publicKeyJwk, privateKeyJwk }, password,
    );
    const submissionVerifier = await deriveSubmissionVerifier(password, publicKeyJwk);
    dispatch({ type: 'KEY_SET', keydetails: {
      publicKeyJwk, privateKeyJwk, encryptedKeyPair, submissionVerifier,
    }});
    const fileObj = await buildKeyDetailsFile({ publicKeyJwk, privateKeyJwk, password });
    downloadKeyDetails(fileObj);
    setLastTransition({ kind });
    offerToRemember(
      publicKeyJwk, privateKeyJwk,
      kind === 'added'
        ? 'Password added — new encrypted keydetails downloaded.'
        : 'Password changed — new encrypted keydetails downloaded.',
      encryptedKeyPair,
    );
  };

  const addPassword = () => {
    if (!keydetails?.privateKeyJwk) {
      setStatus({ message: 'No plaintext private key available to encrypt.', kind: 'error' });
      return;
    }
    setSetPwModal({
      pendingPublicJwk:  keydetails.publicKeyJwk,
      pendingPrivateJwk: keydetails.privateKeyJwk,
      busy: false,
      onAfter: (password) => finishProtect(keydetails.privateKeyJwk, password, 'added'),
    });
  };

  const changePassword = async () => {
    try {
      const privateKeyJwk = await requestPrivateKey();
      setSetPwModal({
        pendingPublicJwk:  keydetails.publicKeyJwk,
        pendingPrivateJwk: privateKeyJwk,
        busy: false,
        onAfter: (password) => finishProtect(privateKeyJwk, password, 'changed'),
      });
    } catch (err) {
      setStatus({ message: 'Change password cancelled: ' + (err?.message ?? err), kind: 'error' });
    }
  };

  const removePassword = async () => {
    const ok = await confirm({
      title: 'Remove password protection?',
      message: '⚠ Your keydetails file will be saved unencrypted — anyone with the file alone can decrypt cloud submissions. Teacher operations on cloud backends (Analyse fetches) will also stop working until you re-deploy the Apps Script (or clear the Codehooks pub_settings collection).',
      confirmLabel: 'Remove password',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const privateKeyJwk = await requestPrivateKey();
      const publicKeyJwk  = keydetails.publicKeyJwk;
      dispatch({ type: 'KEY_SET', keydetails: {
        publicKeyJwk, privateKeyJwk, encryptedKeyPair: null, submissionVerifier: null,
      }});
      const fileObj = await buildKeyDetailsFile({ publicKeyJwk, privateKeyJwk });
      downloadKeyDetails(fileObj);
      setLastTransition({ kind: 'removed' });
      offerToRemember(
        publicKeyJwk, privateKeyJwk,
        'Password removed — new unencrypted keydetails downloaded.',
      );
    } catch (err) {
      setStatus({ message: 'Remove password cancelled: ' + (err?.message ?? err), kind: 'error' });
    }
  };

  const handleLoadKeyFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const parsed = parseKeyDetailsFile(text);
      // v3 (encrypted) → drop into a locked state in app memory and
      // pop the unlock modal. The public key is fine to use immediately
      // (cloud-save flows just need that).
      if (parsed.encryptedKeyPair) {
        dispatch({ type: 'KEY_SET', keydetails: {
          publicKeyJwk:     parsed.publicKeyJwk,
          privateKeyJwk:    null,
          encryptedKeyPair: parsed.encryptedKeyPair,
        }});
        setUnlockModal({
          encryptedKeyPair: parsed.encryptedKeyPair,
          publicKeyJwk:     parsed.publicKeyJwk,
          busy: false,
          errorText: null,
        });
        return;
      }
      // v1 / v2 (plaintext keypair) — install directly.
      dispatch({
        type: 'KEY_SET',
        keydetails: {
          publicKeyJwk:  parsed.publicKeyJwk,
          privateKeyJwk: parsed.privateKeyJwk,
        },
      });
      // Legacy v1 keydetails carried a classCode + students. Auto-import
      // the class into the new class-list manager so the teacher's
      // existing class isn't lost.
      let extraMsg = '';
      if (parsed.legacyClassCode && Array.isArray(parsed.legacyStudents) && parsed.legacyStudents.length > 0) {
        const usernames = parsed.legacyStudents.map(s => s.username).filter(Boolean);
        const { students } = await computeStudentCodes(usernames);
        dispatch({
          type: 'CLASSES_UPSERT',
          entry: {
            classCode:    parsed.legacyClassCode,
            students,
            updatedAt:    new Date().toISOString(),
          },
        });
        extraMsg = ` Legacy class ${parsed.legacyClassCode} imported into Class Lists.`;
      }
      offerToRemember(parsed.publicKeyJwk, parsed.privateKeyJwk, 'Keys loaded.' + extraMsg);
    } catch (err) {
      setStatus({ message: 'Could not load keydetails file: ' + (err?.message ?? err), kind: 'error' });
    }
  };

  // Set-password modal handlers (used after generate + after re-export
  // when the file is to be encrypted).
  const onSetPwAccept = async (password) => {
    if (!setPwModal) return;
    setSetPwModal(m => m ? { ...m, busy: true } : m);
    try {
      await setPwModal.onAfter(password);
      setSetPwModal(null);
    } catch (err) {
      setSetPwModal(m => m ? { ...m, busy: false } : m);
      setStatus({ message: 'Password / encrypt failed: ' + (err?.message ?? err), kind: 'error' });
    }
  };

  // Unlock-on-load modal handlers (used when the loaded file is v3).
  const onUnlockAccept = async (password) => {
    if (!unlockModal) return;
    setUnlockModal(m => m ? { ...m, busy: true, errorText: null } : m);
    try {
      const { privateKeyJwk } = await unlockKeyDetailsFile(unlockModal.encryptedKeyPair, password);
      dispatch({ type: 'KEY_UNLOCK', privateKeyJwk });
      // Now offer to remember on this device — the form we store is
      // the encrypted blob (never the plaintext private key).
      offerToRemember(unlockModal.publicKeyJwk, privateKeyJwk, 'Keys loaded and unlocked.', unlockModal.encryptedKeyPair);
      setUnlockModal(null);
    } catch (err) {
      setUnlockModal(m => m ? { ...m, busy: false, errorText: err?.message ?? String(err) } : m);
    }
  };
  const onUnlockCancelLocal = () => {
    // Keep the locked-state keydetails in app memory so the user can
    // try again later via re-export; just close the modal.
    setUnlockModal(null);
    setStatus({ message: 'Keys loaded in locked state. Public-key features work; private-key actions will prompt for the password.', kind: 'ok' });
  };

  return (
    <div className="editor-tab-panel">
      <section className="cl-section">
        <h3 className="cl-section-title">Your teacher keys</h3>
        <p className="cs-help">
          You will need a keydetails file if setting up cloud submissions
          where they are used to connect to your data store and to encrypt.
        </p>

        <div className="security-callout">
          <div className="security-callout-title">🛡 Security</div>
          <ul>
            <li>Keep this file safe — it cannot be recovered if lost.</li>
            <li>Anyone with this keydetails file can read the cloud submissions although they contain no personal data, only user numbers and code submissions.</li>
            <li>If using a new keydetails file, you will not be able to read submissions saved with a previous keydetails file.</li>
            <li><a className="cs-link" href="#" onClick={e => { e.preventDefault(); setShowAbout(true); }}>More details on how cloud submissions work…</a></li>
          </ul>
        </div>

        <div className="cl-keydetails-row">
          {keydetails
            ? <span className="cl-ok">✓ Keys loaded. The Class List, Cloud Save and Analyse tabs are now enabled.</span>
            : <span className="cl-warn">No keys loaded yet. Generate a new keydetails file, or load an existing one.</span>}
        </div>
        {keydetails && (
          <div className="cl-row" style={{ alignItems: 'center' }}>
            {keydetails.encryptedKeyPair ? (
              <>
                <span className="cl-ok">🔐 Password-protected</span>
                <button
                  className="btn-secondary"
                  onClick={changePassword}
                  title="Pick a new password and download a re-encrypted keydetails file"
                >Change password…</button>
                <button
                  className="btn-secondary"
                  onClick={removePassword}
                  title="Save the keydetails unencrypted (no password)"
                >Remove password…</button>
              </>
            ) : (
              <>
                <span className="cl-warn">🔓 Unprotected</span>
                <button
                  className="btn-secondary"
                  onClick={addPassword}
                  title="Encrypt your keydetails file with an 8-char password"
                >Add password…</button>
              </>
            )}
          </div>
        )}
        {lastTransition && (
          <div className="cl-status cl-status-ok" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ flex: 1 }}>
              {lastTransition.kind === 'added' && (
                <>
                  ✓ <strong>Password added.</strong> Student submissions
                  are unaffected. To enforce the password on teacher
                  operations (Analyse fetches), re-generate and re-deploy
                  your Apps Script. On Codehooks, the next teacher
                  operation will auto-install the verifier.
                </>
              )}
              {lastTransition.kind === 'changed' && (
                <>
                  ✓ <strong>Password changed.</strong> Until your Apps
                  Script and Codehooks backend are updated, the Analyse
                  tab will fail with a password mismatch. Re-deploy your
                  Apps Script with the new verifier; on Codehooks, clear
                  the <code>pub_settings</code> collection in Codehooks
                  Studio.
                </>
              )}
              {lastTransition.kind === 'removed' && (
                <>
                  ✓ <strong>Password removed.</strong> Student
                  submissions are unaffected. To restore Analyse fetches,
                  re-deploy your Apps Script (which will bake in an empty
                  verifier). On Codehooks, clear the
                  <code> pub_settings</code> collection in Codehooks
                  Studio.
                </>
              )}
            </span>
            <button
              className="btn-secondary"
              onClick={() => dispatch({ type: 'EDITOR_SET_TAB', tab: 'cloudSave' })}
            >Open Cloud Save tab →</button>
            <button
              className="cl-row-btn"
              onClick={() => setLastTransition(null)}
              title="Dismiss"
              style={{ padding: '2px 8px' }}
            >✕</button>
          </div>
        )}
        <div className="cl-row">
          <button
            className="btn-primary"
            disabled={busyKeys}
            onClick={openGenerateOptions}
          >{busyKeys ? 'Generating…' : 'Generate new keydetails'}</button>
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >Load keydetails file…</button>
          <input
            type="file"
            accept=".txt,.json,text/plain,application/json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleLoadKeyFile}
          />
          <button
            className="btn-secondary"
            disabled={!keydetails}
            onClick={reExport}
            title="Download a fresh copy of the keydetails file (backup)"
          >Re-export keydetails</button>
          <button
            className="cl-row-btn danger"
            disabled={!getKeyDetails()}
            onClick={forgetOnDevice}
            title="Clear stored keys from this browser."
          >Forget on this device</button>
        </div>
        {status?.message && (
          <div className={`cl-status cl-status-${status.kind || ''}`}>
            {status.message}
          </div>
        )}
      </section>
      {rememberModal && (
        <RememberOnDeviceModal
          what="keydetails"
          onYes={() => confirmRemember(true)}
          onNo={() => confirmRemember(false)}
        />
      )}
      {setPwModal && (
        <KeydetailsPasswordModal
          mode="set"
          busy={setPwModal.busy}
          onAccept={onSetPwAccept}
          onCancel={() => { if (!setPwModal.busy) setSetPwModal(null); }}
        />
      )}
      {unlockModal && (
        <KeydetailsPasswordModal
          mode="unlock"
          busy={unlockModal.busy}
          errorText={unlockModal.errorText}
          onSubmit={onUnlockAccept}
          onCancel={onUnlockCancelLocal}
        />
      )}
      {showAbout && (
        <AboutCloudSubmissionsModal onClose={() => setShowAbout(false)} />
      )}
      {genOptsModal && (
        <GenerateKeysOptionsModal
          initialProtect={genOptsModal.protectPwd}
          onCancel={() => setGenOptsModal(null)}
          onAccept={(protect) => {
            setProtectPwd(protect);
            setGenOptsModal(null);
            generateKeysWithProtect(protect);
          }}
        />
      )}
      {confirmModalEl}
    </div>
  );
}

// Small inline modal: one tickbox + OK / Cancel. Pops when the teacher
// clicks "Generate new keydetails" so they can opt into password
// protection without seeing the option until they're ready to act.
function GenerateKeysOptionsModal({ initialProtect, onAccept, onCancel }) {
  const [protect, setProtect] = useState(!!initialProtect);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal generate-keys-modal" onClick={e => e.stopPropagation()}>
        <h3>Generate new keydetails</h3>
        <label
          className="settings-checkbox"
          title="When ticked, the keydetails file is encrypted with a password you choose. The password must be entered each time the keydetails are used — and is not recoverable."
        >
          <input
            type="checkbox"
            checked={protect}
            onChange={e => setProtect(e.target.checked)}
          />
           <span>
            🔐 <strong>Password-protect new keydetails file?</strong>
            <span className="settings-radio-blurb">
              {' '} Anyone with the keydetails file can read your cloud submissions from your data store (although it contains only anonymous user numbers and code submissions). Select here if you wish to additionally password protect your keydetails file. If you do so then the password must be entered each time the keydetails are used; the password is non-recoverable and not recorded anywhere so you will need to keep it safe.
            </span>
          </span>
        </label>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onAccept(protect)} autoFocus>OK</button>
        </div>
      </div>
    </div>
  );
}
