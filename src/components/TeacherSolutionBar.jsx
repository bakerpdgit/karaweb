import React, { useState } from 'react';
import { encryptForPublicKey, decryptWithPrivateKey } from '../utils/crypto/envelope.js';
import { useConfirmModal } from './ConfirmModal.jsx';

function isEnvelope(v) {
  return typeof v === 'string' && v.startsWith('KaraWeb Cloud Save');
}

/**
 * Bar rendered above the right-hand code editor while the teacher is
 * authoring a challenge. Combines three things:
 *
 *  1. Starter / Solution toggle — which slot the right-hand editor is
 *     currently editing (state.editingTarget).
 *  2. A contextual blurb that explains what the teacher is editing
 *     ("...starter code students will see" vs "...optional solution
 *     code").
 *  3. A single "Solutions visible to students" checkbox.
 *     - Ticked → solutions stored in plaintext + students see Show.
 *     - Unticked → solutions stored encrypted with the teacher's
 *       public key + Show is locked for anyone without the keys.
 *     - Disabled-and-locked-on if no keydetails (can't encrypt).
 *     Toggling triggers an async encrypt-or-decrypt of all populated
 *     mode entries in challenge.solution.
 */
export default function TeacherSolutionBar({
  editing, editingTarget, appMode, keydetails, dispatch, requestPrivateKey,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { confirm, alert: showAlert, modal: alertModal } = useConfirmModal();

  if (!editing) return null;

  const hasKeys = !!keydetails?.publicKeyJwk;
  const showingSolution = editingTarget === 'solution';
  const visible = !!editing.solutionAvailableToStudents;

  const onVisibilityChange = async (e) => {
    setError(null);
    const wantVisible = e.target.checked;
    if (!wantVisible && !hasKeys) {
      await showAlert({ message: 'Generate keydetails first to hide solutions from students.' });
      return;
    }
    setBusy(true);
    try {
      const source = editing.solution || { fsm: null, blocks: null, python: '' };
      const next = { fsm: null, blocks: null, python: '' };
      // Decryption needs the private key, which may be password-locked.
      const privateKeyJwk = wantVisible
        ? (requestPrivateKey ? await requestPrivateKey() : keydetails?.privateKeyJwk)
        : null;
      for (const mode of ['fsm', 'blocks', 'python']) {
        const entry = source[mode];
        const isEmpty = entry === null || entry === undefined
          || (typeof entry === 'string' && entry.length === 0);
        if (isEmpty) {
          next[mode] = mode === 'python' ? '' : null;
          continue;
        }
        if (wantVisible) {
          // Decrypt envelopes back to raw; pass-through if already raw.
          if (typeof entry === 'string' && entry.startsWith('KaraWeb Cloud Save')) {
            if (!privateKeyJwk) throw new Error('Decryption needs your private key.');
            const decoded = await decryptWithPrivateKey(entry, privateKeyJwk);
            next[mode] = decoded?.data ?? (mode === 'python' ? '' : null);
          } else {
            next[mode] = entry;
          }
        } else {
          // Encrypt raw values; pass-through if already an envelope.
          if (typeof entry === 'string' && entry.startsWith('KaraWeb Cloud Save')) {
            next[mode] = entry;
          } else {
            next[mode] = await encryptForPublicKey({ mode, data: entry }, keydetails.publicKeyJwk);
          }
        }
      }
      dispatch({ type: 'CH_SET_SOL_VISIBILITY', id: editing.id, solution: next, visible: wantVisible });
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const blurb = showingSolution
    ? 'You are editing the optional solution code.'
    : 'You are editing the starter code students will see.';

  // Copy the OTHER target's code (for the current app mode) into
  // the active target's slot. Decrypts the source if it's an
  // encrypted solution envelope. The current mode is always the
  // unit of copy — the teacher can switch modes and click again
  // to copy each mode separately.
  const srcTarget = showingSolution ? 'starter' : 'solution';
  const onCopyFromOther = async () => {
    setError(null);
    const ok = await confirm({
      message: `Overwrite the ${showingSolution ? 'solution' : 'starter'} ${appMode} code with the ${srcTarget} ${appMode} code?`,
      confirmLabel: 'Overwrite',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const srcSlot = editing[srcTarget] || { fsm: null, blocks: null, python: '' };
      let sourceData = srcSlot[appMode];
      // Decrypt the source if it's an encrypted solution envelope.
      if (srcTarget === 'solution' && isEnvelope(sourceData)) {
        const privateKeyJwk = requestPrivateKey
          ? await requestPrivateKey()
          : keydetails?.privateKeyJwk;
        if (!privateKeyJwk) {
          throw new Error('Decryption needs your private key.');
        }
        const decoded = await decryptWithPrivateKey(sourceData, privateKeyJwk);
        sourceData = decoded?.data ?? (appMode === 'python' ? '' : null);
      }
      dispatch({ type: 'CH_COPY_BETWEEN_TARGETS', sourceData });
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`teacher-solution-bar ${showingSolution ? 'editing-solution' : ''}`}>
      <div className="ch-target-toggle" role="radiogroup" aria-label="Code editor view">
        <button
          role="radio"
          aria-checked={!showingSolution}
          className={`view-tab ${!showingSolution ? 'active' : ''}`}
          title="Edit the starter code shown to students"
          onClick={() => dispatch({ type: 'CH_SET_EDITING_TARGET', target: 'starter' })}
        >Starter</button>
        <button
          role="radio"
          aria-checked={showingSolution}
          className={`view-tab ${showingSolution ? 'active' : ''}`}
          title="Edit your own reference solution"
          onClick={() => dispatch({ type: 'CH_SET_EDITING_TARGET', target: 'solution' })}
        >Solution</button>
      </div>
      <span className="tsb-blurb">{blurb}</span>
      <button
        className="header-btn"
        onClick={onCopyFromOther}
        disabled={busy}
        title={`Replace this ${appMode} code with the ${srcTarget} ${appMode} code`}
      >Copy from {srcTarget === 'solution' ? 'Solution' : 'Starter'}</button>
      <label
        className={`tsb-check ${!hasKeys ? 'disabled' : ''}`}
        title={hasKeys
          ? 'Untick to encrypt the solution with your public key (hidden from students).'
          : 'Generate keydetails to hide solutions from students.'}
      >
        <input
          type="checkbox"
          checked={visible || !hasKeys}
          disabled={!hasKeys || busy}
          onChange={onVisibilityChange}
        />
        Solutions visible to students {!hasKeys && '🔒'} {busy && '⏳'}
      </label>
      {error && <span className="tsb-error">⚠ {error}</span>}
      {alertModal}
    </div>
  );
}
