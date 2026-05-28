import React, { useMemo, useState } from 'react';
import { clearTeacherSession } from '../../utils/teacherSession.js';
import { fetchCloudResults } from '../../utils/cloudClient.js';
import { decryptWithPrivateKey } from '../../utils/crypto/envelope.js';
import { aggregateSubmissions } from '../../utils/analyse/aggregateSubmissions.js';
import SubmissionGrid from './SubmissionGrid.jsx';
import AnalyseUnlockBanner from './AnalyseUnlockBanner.jsx';
import UsernameFilter from './UsernameFilter.jsx';
import ClassListPanel from '../classlist/ClassListPanel.jsx';
import { exportSubmissionsAsXls } from '../../utils/analyse/exportSubmissions.js';

// Module-level cache of the last successful fetch — survives unmount /
// remount of AnalysePanel (e.g. when the teacher opens a student cell
// in the scratchpad and then clicks "Return to grid"). Keyed by the
// effective file guid so a different book doesn't reuse stale data.
const lastGridCache = {
  key: null,                    // effectiveChallengeFileGuid
  cells: {},
  recordIndex: {},
  lastFetched: null,
  classMaskCode: '',
  hideUnknown: false,
  filterText: '',
};

export default function AnalysePanel({
  classList, classes, keydetails, cloudSave, analyse, challenges,
  loadedCloudSave, challengeFileGuid, dispatch, requestPrivateKey,
}) {
  // Lazy initial state pulls from the module cache if it matches the
  // current book — so returning from the scratchpad shows the same
  // grid the teacher just left, without a backend round-trip.
  const initKey = (loadedCloudSave?.challengeFileGuid || challengeFileGuid || '');
  const cacheHit = lastGridCache.key === initKey && initKey;
  const [cells, setCells]                 = useState(() => cacheHit ? lastGridCache.cells       : {});
  const [recordIndex, setRecordIndex]     = useState(() => cacheHit ? lastGridCache.recordIndex : {});
  const [error, setError]                 = useState(null);
  const [busy, setBusy]                   = useState(false);
  const [lastFetched, setLastFetched]     = useState(() => cacheHit ? lastGridCache.lastFetched : null);
  const [filterText, setFilterText]       = useState(() => cacheHit ? lastGridCache.filterText  : '');
  const [classMaskCode, setClassMaskCode] = useState(() => cacheHit ? lastGridCache.classMaskCode : '');
  const [hideUnknown, setHideUnknown]     = useState(() => cacheHit ? lastGridCache.hideUnknown  : false);

  const apiBaseUrl = loadedCloudSave?.apiBaseUrl || cloudSave?.apiBaseUrl;
  const method     = loadedCloudSave?.method      || cloudSave?.method || 'google-drive';
  // The challengeFileGuid optionally filters Apps Script results to
  // one book. Codehooks now identifies the teacher by public-key
  // fingerprint, so classCode is no longer involved on either side.
  const effectiveChallengeFileGuid =
    loadedCloudSave?.challengeFileGuid || challengeFileGuid || '';
  // The private key may currently be locked (encryptedKeyPair set,
  // privateKeyJwk null). We still consider that "ready" — the refresh
  // call will go through requestPrivateKey() and pop the unlock modal.
  const canAccessPrivateKey = !!(keydetails?.privateKeyJwk || keydetails?.encryptedKeyPair);
  const ready = !!(canAccessPrivateKey && apiBaseUrl && effectiveChallengeFileGuid);

  const effectiveCloudSave = loadedCloudSave || {
    method,
    apiBaseUrl,
    publicKeyJwk: keydetails?.publicKeyJwk,
    challengeFileGuid: effectiveChallengeFileGuid,
  };

  // Pick the row source. Always synthesise rows from the result
  // data so the teacher sees every code that actually submitted —
  // including ones not in any class list. When a mask is applied
  // we still show the full set, marking in-class rows by username
  // and unknown codes as "unknown" (rendered red downstream); the
  // teacher can then tick "Hide unknown codes" to focus.
  const maskClass = classMaskCode
    ? (classes || []).find(c => c.classCode === classMaskCode)
    : null;
  const studentRowsSource = useMemo(() => {
    // 1. Start with every code that has submitted at least one result.
    const submittedCodes = new Set(Object.keys(recordIndex));
    // 2. Build a lookup from code → username for the masked class.
    const maskByCode = new Map();
    if (maskClass) {
      for (const s of (maskClass.students || [])) {
        if (s?.code) maskByCode.set(s.code, s);
      }
    }
    // 3. Union: all submitted codes + every masked-class student
    //    (so empty rows in the class still show through).
    const allCodes = new Set([...submittedCodes]);
    if (maskClass) for (const code of maskByCode.keys()) allCodes.add(code);
    // 4. Build rows; flag `unknown` when the code isn't in the mask.
    const rows = [];
    for (const code of allCodes) {
      const matched = maskByCode.get(code);
      if (matched) {
        rows.push({ username: matched.username, code, unknown: false });
      } else {
        rows.push({ username: code, code, unknown: !!maskClass });
      }
    }
    rows.sort((a, b) => a.username.localeCompare(b.username));
    return rows;
  }, [maskClass, recordIndex]);

  const filteredStudents = useMemo(() => {
    let all = studentRowsSource;
    if (hideUnknown) all = all.filter(s => !s.unknown);
    const q = filterText.trim().toLowerCase();
    if (!q) return all;
    return all.filter(s => String(s.username || '').toLowerCase().includes(q));
  }, [studentRowsSource, filterText, hideUnknown]);

  // Mirror the UI filters into the module cache so a scratchpad round
  // trip returns the teacher to the exact mask + filter they had.
  React.useEffect(() => {
    lastGridCache.filterText    = filterText;
    lastGridCache.classMaskCode = classMaskCode;
    lastGridCache.hideUnknown   = hideUnknown;
  }, [filterText, classMaskCode, hideUnknown]);

  const [prunedNote, setPrunedNote] = useState(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    setPrunedNote(null);
    try {
      // Resolve the private key on demand — pops the unlock modal if
      // the keypair is currently password-locked.
      const privateKeyJwk = requestPrivateKey
        ? await requestPrivateKey()
        : keydetails.privateKeyJwk;
      // requestPrivateKey resolves to the unlocked private key; the
      // matching submissionVerifier sits in keydetails.submissionVerifier
      // (populated alongside on unlock). Null when keys aren't
      // password-protected — backends skip enforcement in that case.
      const fetched = await fetchCloudResults(effectiveCloudSave, {
        privateKeyJwk,
        submissionVerifier: keydetails?.submissionVerifier ?? null,
      });
      const records = fetched?.rows ?? [];
      if (fetched?.prunedRows > 0) {
        setPrunedNote(`Pruned ${fetched.prunedRows} old row${fetched.prunedRows === 1 ? '' : 's'} (over the script's retention limit).`);
      }
      // Unwrap each unique studentCode (cached by hash so two rows
      // for the same student share one RSA decrypt). The backend
      // stores only studentCodeHash + wrappedStudentCode; here we
      // recover the 6-digit code locally so the rest of the panel
      // (mask + grid keys + cell-click) keeps working unchanged.
      const codeByHash = new Map();
      const unique = new Map();
      for (const r of records) {
        if (r?.studentCodeHash && r?.wrappedStudentCode && !unique.has(r.studentCodeHash)) {
          unique.set(r.studentCodeHash, r.wrappedStudentCode);
        }
      }
      await Promise.all(Array.from(unique.entries()).map(async ([hash, wrapped]) => {
        try {
          const out = await decryptWithPrivateKey(wrapped, privateKeyJwk, 'karaweb-studentcode-v1');
          const code = String(out?.studentCode || '');
          if (/^\d{6}$/.test(code)) codeByHash.set(hash, code);
        } catch (e) {
          console.warn('wrappedStudentCode decrypt failed for', hash, e?.message ?? e);
        }
      }));
      // Index + cells by the recovered 6-digit code. Rows whose hash
      // didn't decrypt are skipped (with a console warning above).
      const idx = {};
      const cellsByStudent = {};
      for (const r of records) {
        const studentCode = codeByHash.get(r.studentCodeHash);
        if (!studentCode || !r.challengeGuid) continue;
        if (!idx[studentCode]) idx[studentCode] = {};
        idx[studentCode][r.challengeGuid] = r;
        if (!cellsByStudent[studentCode]) cellsByStudent[studentCode] = {};
        let status = 'fail';
        if (r.latestPassed && r.firstAttemptPassed)      status = 'first';
        else if (r.latestPassed && !r.firstAttemptPassed) status = 'eventual';
        cellsByStudent[studentCode][r.challengeGuid] = {
          status,
          attempts: r.submissionCount,
          latest:   { passed: r.latestPassed, submittedAt: r.submittedAt },
        };
      }
      const fetchedAt = new Date();
      setRecordIndex(idx);
      setCells(cellsByStudent);
      setLastFetched(fetchedAt);
      lastGridCache.key         = effectiveChallengeFileGuid || '';
      lastGridCache.cells       = cellsByStudent;
      lastGridCache.recordIndex = idx;
      lastGridCache.lastFetched = fetchedAt;
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        // Drop every cached teacher session; there's only ever one
        // per browser anyway (per public-key fingerprint).
        clearTeacherSession();
      }
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const onCellClick = async (student, challenge, cell) => {
    const row = recordIndex[student.code]?.[challenge.guid || challenge.id];
    if (!row) return;
    const studentLabel = (!student.unknown && student.username && student.username !== student.code)
      ? student.username
      : `code ${student.code}`;
    try {
      const privateKeyJwk = requestPrivateKey
        ? await requestPrivateKey()
        : keydetails.privateKeyJwk;
      const payload = await decryptWithPrivateKey(
        row.encryptedSolution, privateKeyJwk,
        'karaweb-result-v1',
      );
      // Hand off to the scratchpad: builds a temp challenge cloned from
      // the source plus the student's code, exits the editor, and
      // activates it as the current challenge so the teacher can run
      // / tweak it directly.
      dispatch({
        type: 'CH_OPEN_SCRATCHPAD',
        sourceChallengeId: challenge.id,
        studentLabel,
        solution: payload.solution,
      });
    } catch (err) {
      setError('Could not decrypt submission: ' + (err?.message ?? err));
    }
  };

  const onExport = () => {
    exportSubmissionsAsXls({
      students: filteredStudents,
      challenges,
      cells,
      classMaskCode,
    });
  };

  return (
    <div className="editor-tab-panel">
      <section className="submissions-box">
        <h3 className="submissions-box-title">Class Setup</h3>
        <ClassListPanel
          classList={classList}
          classes={classes}
          keydetails={keydetails}
          dispatch={dispatch}
        />
      </section>

      <section className="submissions-box">
        <h3 className="submissions-box-title">Submissions</h3>
        {!ready ? (
          <AnalyseUnlockBanner
            classList={classList}
            keydetails={keydetails}
            cloudSave={cloudSave}
            loadedCloudSave={loadedCloudSave}
          />
        ) : (
          <>
            <div className="analyse-toolbar">
              <span className="analyse-class">
                File <code>{loadedCloudSave?.challengeFileGuid?.slice(0, 8) || '—'}…</code>
              </span>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={refresh}
              >{busy ? 'Loading…' : 'Refresh from backend'}</button>
              <button
                className="btn-secondary"
                disabled={!filteredStudents.length || !challenges.length}
                onClick={onExport}
                title="Download the visible grid as an Excel-readable .xlsx file"
              >Export grid (.xlsx)</button>
              {lastFetched && (
                <span className="analyse-meta">last fetched {lastFetched.toLocaleTimeString()}</span>
              )}
              {prunedNote && (
                <span className="analyse-meta" title="Configurable via ROW_RETENTION_DAYS in the script">
                  🧹 {prunedNote}
                </span>
              )}
            </div>

            <div className="analyse-toolbar">
              <label>Class mask:</label>
              <select value={classMaskCode} onChange={e => setClassMaskCode(e.target.value)}>
                <option value="">— show 6-digit codes —</option>
                {(classes || []).map(c => (
                  <option key={c.classCode} value={c.classCode}>
                    {c.classCode} ({c.students?.length ?? 0} students)
                  </option>
                ))}
              </select>
              {classMaskCode && (
                <>
                  <label className="analyse-meta" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={hideUnknown}
                      onChange={e => setHideUnknown(e.target.checked)}
                    />
                    Hide codes not in this class
                  </label>
                  <span className="analyse-meta">
                    Codes <strong style={{ color: '#b91c1c' }}>shown in red</strong> aren't in {classMaskCode}.
                  </span>
                </>
              )}
            </div>

            {error && (
              <div className="cl-status cl-status-error">{error}</div>
            )}

            <UsernameFilter
              value={filterText}
              onChange={setFilterText}
              totalCount={studentRowsSource.length}
              shownCount={filteredStudents.length}
            />

            <SubmissionGrid
              students={filteredStudents}
              challenges={challenges}
              cells={cells}
              onCellClick={onCellClick}
            />
          </>
        )}
      </section>

    </div>
  );
}
