import React, { useState } from 'react';
import { decryptWithPrivateKey } from '../utils/crypto/envelope.js';

/**
 * Bar rendered above the right-hand code editor while a student (or
 * anyone playing the challenge) is taking a challenge whose teacher
 * marked the reference solution as `solutionAvailableToStudents`.
 *
 * Closed state: "A solution is available …  [👁 Show solution]".
 * Open state:   "Showing reference solution (read-only).  [✕ Close]".
 *
 * If the solution is encrypted and the viewer doesn't hold the
 * matching keydetails, the Show button is disabled with a 🔒 tooltip.
 */
export default function StudentSolutionBar({
  challenge, appMode, showing, keydetails, dispatch, requestPrivateKey,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!challenge || !challenge.solutionAvailableToStudents) return null;

  const entry = challenge.solution?.[appMode];
  const hasSolutionForMode = entry !== null && entry !== undefined
    && !(typeof entry === 'string' && entry.length === 0);
  if (!hasSolutionForMode) {
    // Nothing to show in this mode — render a quiet hint.
    return (
      <div className="student-solution-bar quiet">
        <span className="ssb-blurb">No reference solution available for {appMode} mode.</span>
      </div>
    );
  }

  // Encryption is derived: solutions are stored encrypted iff the
  // visibility flag is false. (See TeacherSolutionBar / store model.)
  const isEncrypted = !challenge.solutionAvailableToStudents;
  // Anyone can decrypt a plaintext solution; only a viewer with the
  // teacher's keydetails (loaded or password-protected) can decrypt
  // an encrypted one.
  const canDecrypt = !isEncrypted
    || !!keydetails?.privateKeyJwk
    || !!keydetails?.encryptedKeyPair;

  const onShow = async () => {
    setError(null);
    setBusy(true);
    try {
      let solutionData = challenge.solution || { fsm: null, blocks: null, python: '' };
      if (isEncrypted) {
        const privateKeyJwk = requestPrivateKey
          ? await requestPrivateKey()
          : keydetails?.privateKeyJwk;
        if (!privateKeyJwk) {
          throw new Error('Encrypted solution — your keydetails file is needed to decrypt.');
        }
        const decrypted = { fsm: null, blocks: null, python: '' };
        for (const m of ['fsm', 'blocks', 'python']) {
          const e = solutionData[m];
          const empty = e === null || e === undefined
            || (typeof e === 'string' && e.length === 0);
          if (empty) {
            decrypted[m] = m === 'python' ? '' : null;
            continue;
          }
          if (typeof e === 'string' && e.startsWith('KaraWeb Cloud Save')) {
            const dec = await decryptWithPrivateKey(e, privateKeyJwk);
            decrypted[m] = dec?.data ?? (m === 'python' ? '' : null);
          } else {
            decrypted[m] = e;
          }
        }
        solutionData = decrypted;
      }
      dispatch({ type: 'SIM_SHOW_SOLUTION', showing: true, solutionData });
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const onClose = () => {
    dispatch({ type: 'SIM_SHOW_SOLUTION', showing: false });
  };

  return (
    <div className={`student-solution-bar ${showing ? 'showing' : ''}`}>
      {showing ? (
        <>
          <span className="ssb-blurb">👁 Showing reference solution (read-only). Run it to see how it works.</span>
          <button className="ssb-btn close" onClick={onClose}>✕ Close solution</button>
        </>
      ) : (
        <>
          <span className="ssb-blurb">
            {isEncrypted
              ? '🔒 An encrypted reference solution is available.'
              : 'A reference solution is available for this challenge.'}
          </span>
          <button
            className="ssb-btn show"
            onClick={onShow}
            disabled={busy || !canDecrypt}
            title={!canDecrypt
              ? '🔒 Encrypted — only the teacher (with the matching keydetails) can view this solution.'
              : 'Show the teacher\'s reference solution in a read-only editor'}
          >{busy ? 'Decrypting…' : '👁 Show solution'}</button>
        </>
      )}
      {error && <span className="ssb-error">⚠ {error}</span>}
    </div>
  );
}
