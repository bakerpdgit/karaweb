import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildClassCode, classCodeHint,
} from '../../utils/classCode.js';
import {
  computeStudentCodes,
} from '../../utils/studentCodes.js';
import StudentBulkPasteModal from './StudentBulkPasteModal.jsx';
import CollisionResolver from './CollisionResolver.jsx';
import RememberOnDeviceModal from '../RememberOnDeviceModal.jsx';
import { useConfirmModal } from '../ConfirmModal.jsx';
import { setClassList, removeClassList } from '../../utils/localStore.js';
import { isClassCode } from '../../utils/classCode.js';

const SENTINEL_NEW = '__new__';

// Returns the academic-year string for `now` (UK convention: rolls
// over in August). e.g. May 2026 → "25-26"; September 2026 → "26-27".
function currentAcademicYear(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();     // 0..11
  const start = m >= 7 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}

// Dropdown options for the academic year picker: current AY centred,
// ±2 years either side. e.g. for current="26-27":
//   ["24-25","25-26","26-27","27-28","28-29"]
function academicYearOptions(now = new Date()) {
  const cur = currentAcademicYear(now);
  const startYY = parseInt(cur.slice(0, 2), 10);
  // cur could be "98-99" → "99-00" wrap. We're far from that here, but
  // handle it cleanly: derive a 4-digit start, then format back.
  const base = 2000 + startYY;
  return Array.from({ length: 5 }, (_, i) => {
    const s = base - 2 + i;
    return `${String(s).slice(-2)}-${String(s + 1).slice(-2)}`;
  });
}

// Reverse a class code like "FRB26-27-Y10A" into its four fields, OR
// return null if it doesn't match the canonical shape.
function splitClassCode(code) {
  const m = String(code || '').match(/^([A-Z]{1,4})(\d{2}-\d{2})-Y(\d{1,2})([A-Z])$/);
  if (!m) return null;
  return { initials: m[1], academicYear: m[2], yearGroup: m[3], classLetter: m[4] };
}

// Parse the .txt produced by exportTxt below back into a load payload.
// Tolerant of extra header lines / blank lines; requires a `Class: <code>`
// header (or a class code on its own line) followed by CSV rows
// `username,code`. Throws on anything we can't recognise.
function parseLoginCodesTxt(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim());
  let classCode = '';
  for (const l of lines) {
    const m = l.match(/^Class:\s*([A-Z]{1,4}\d{2}-\d{2}-Y\d{1,2}[A-Z])\s*$/i);
    if (m) { classCode = m[1].toUpperCase(); break; }
    if (isClassCode(l)) { classCode = l; break; }
  }
  if (!classCode) {
    throw new Error('Could not find a "Class: <code>" line in the file.');
  }
  const split = splitClassCode(classCode);
  if (!split) throw new Error(`Class code "${classCode}" doesn't look like FRB26-27-Y10A.`);
  // Pick up only well-formed `username,6-digit-code` CSV rows; skip
  // every other line (file headers, the "Class:" / "Generated:" lines,
  // the `username,code` table header, blank lines, comments). The
  // stored code itself is ignored — we recompute from username +
  // current publicKey — but its presence is the signal that this
  // line is a real student row.
  const usernames = [];
  const seen = new Set();
  for (const l of lines) {
    if (!l || l.startsWith('#')) continue;
    if (!l.includes(',')) continue;                  // skip header lines, free text
    const [rawName, rawCode] = l.split(',');
    const name = (rawName || '').trim().toLowerCase();
    const code = (rawCode || '').trim();
    if (!name) continue;
    if (!/^\d{6}$/.test(code)) continue;              // not a real student row
    if (seen.has(name)) continue;
    seen.add(name);
    usernames.push(name);
  }
  if (usernames.length === 0) {
    throw new Error('No "username,code" rows found in the file.');
  }
  return { classCode, ...split, usernames };
}

/**
 * Class List panel: multi-class manager.
 *
 * Top strip: a single dropdown of saved classes with a final
 * "+ New class…" option. The 1. Class code / 2. Students sections
 * only appear once the teacher has picked an entry (existing class
 * or new draft).
 *
 * The teacher's RSA key pair lives in its own Teacher Keys tab.
 */
export default function ClassListPanel({ classList, classes, keydetails, dispatch }) {
  // Per-teacher code derivation needs the teacher's public modulus.
  // The Class List tab is gated upstream on keydetails being loaded,
  // so this should never be empty in practice.
  const publicKeyN = keydetails?.publicKeyJwk?.n || '';
  const [showPaste, setShowPaste] = useState(false);
  const [newName,   setNewName]   = useState('');
  const [picked,    setPicked]    = useState(false);   // has the teacher selected an entry?
  const [rememberClass, setRememberClass] = useState(null);  // saved class entry awaiting Yes/No
  const { confirm, modal: confirmModalEl } = useConfirmModal();
  const classFileInputRef = useRef(null);

  const savedClasses = Array.isArray(classes) ? classes : [];
  const inSavedList = savedClasses.some(c => c.classCode === classList.classCode);

  // Auto-set picked=true if the active draft already names a class.
  useEffect(() => {
    if (classList.classCode) setPicked(true);
  }, [classList.classCode]);

  const draftDirty = !!classList.classCode && (
    classList.students.length > 0 ||
    (savedClasses.find(c => c.classCode === classList.classCode)?.students?.length ?? -1) !== classList.students.length
  );

  const saveClassToList = () => {
    if (!classList.classCode) return;
    const entry = {
      classCode:    classList.classCode,
      initials:     classList.initials,
      yearGroup:    classList.yearGroup,
      academicYear: classList.academicYear,
      classLetter:  classList.classLetter,
      students:     classList.students.map(s => ({
        username: s.username, code: s.code, suffixApplied: !!s.suffixApplied,
      })),
      updatedAt:    new Date().toISOString(),
    };
    dispatch({ type: 'CLASSES_UPSERT', entry });
    // Offer to persist on this device (yes/no). The class is already
    // in app state regardless.
    setRememberClass(entry);
  };

  const confirmRememberClass = (yes) => {
    if (!rememberClass) return;
    if (yes) {
      setClassList(rememberClass.classCode, rememberClass);
      dispatch({ type: 'CL_SET_STATUS', message: `Saved class ${rememberClass.classCode}. Stored on this device.`, kind: 'ok' });
    } else {
      dispatch({ type: 'CL_SET_STATUS', message: `Saved class ${rememberClass.classCode}. Not stored on this device (session only).`, kind: 'ok' });
    }
    setRememberClass(null);
  };

  const onPickDropdown = async (value) => {
    if (!value) {
      if (draftDirty) {
        const ok = await confirm({
          message: 'Discard unsaved changes to the current draft?',
          confirmLabel: 'Discard',
          variant: 'danger',
        });
        if (!ok) return;
      }
      dispatch({ type: 'CL_NEW_DRAFT', academicYear: currentAcademicYear() });
      setPicked(false);
      return;
    }
    if (value === SENTINEL_NEW) {
      if (draftDirty) {
        const ok = await confirm({
          message: 'Discard unsaved changes and start a new class?',
          confirmLabel: 'Discard',
          variant: 'danger',
        });
        if (!ok) return;
      }
      dispatch({ type: 'CL_NEW_DRAFT', academicYear: currentAcademicYear() });
      setPicked(true);
      return;
    }
    if (draftDirty && classList.classCode !== value) {
      const ok = await confirm({
        message: `Discard unsaved changes to ${classList.classCode} and switch to ${value}?`,
        confirmLabel: 'Switch',
        variant: 'danger',
      });
      if (!ok) return;
    }
    dispatch({ type: 'CL_LOAD_DRAFT', classCode: value });
    setPicked(true);
  };

  const deleteCurrentClass = async () => {
    const cc = classList.classCode;
    if (!cc) return;
    const ok = await confirm({
      message: `Delete saved class ${cc}? Backup files are untouched.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    dispatch({ type: 'CLASSES_DELETE', classCode: cc });
    removeClassList(cc);
    dispatch({ type: 'CL_NEW_DRAFT', academicYear: currentAcademicYear() });
    setPicked(false);
  };

  const handleLoadClassFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const parsed = parseLoginCodesTxt(text);
      const { students, collisions } = await computeStudentCodes(parsed.usernames, publicKeyN);
      dispatch({ type: 'CL_SET_FIELD', field: 'initials',     value: parsed.initials });
      dispatch({ type: 'CL_SET_FIELD', field: 'yearGroup',    value: parsed.yearGroup });
      dispatch({ type: 'CL_SET_FIELD', field: 'academicYear', value: parsed.academicYear });
      dispatch({ type: 'CL_SET_FIELD', field: 'classLetter',  value: parsed.classLetter });
      dispatch({ type: 'CL_SET_CLASS_CODE', classCode: parsed.classCode });
      dispatch({ type: 'CL_SET_STUDENTS', students, collisions });
      setPicked(true);
      // Auto-upsert the loaded class into the in-memory `classes` list
      // immediately so it's available for masking on the Analyse tab
      // even if the teacher declines the Remember-on-device prompt.
      const entry = {
        classCode:    parsed.classCode,
        initials:     parsed.initials,
        yearGroup:    parsed.yearGroup,
        academicYear: parsed.academicYear,
        classLetter:  parsed.classLetter,
        students:     students.map(s => ({
          username: s.username, code: s.code, suffixApplied: !!s.suffixApplied,
        })),
        updatedAt:    new Date().toISOString(),
      };
      dispatch({ type: 'CLASSES_UPSERT', entry });
      setRememberClass(entry);
    } catch (err) {
      dispatch({ type: 'CL_SET_STATUS', message: 'Could not load class file: ' + (err?.message ?? err), kind: 'error' });
    }
  };

  const codeHint = classCodeHint(classList);
  const codeReady = !codeHint;

  // Seed the academic-year field to the current AY when the form is
  // first shown and nothing is set yet. Covers the initial-state edge
  // case where `picked` was flipped without going through CL_NEW_DRAFT.
  useEffect(() => {
    if (picked && !classList.academicYear) {
      dispatch({ type: 'CL_SET_FIELD', field: 'academicYear', value: currentAcademicYear() });
    }
  }, [picked, classList.academicYear]);

  // Recompute the live class code whenever any of the four inputs change.
  useEffect(() => {
    const next = buildClassCode(classList);
    if (next !== classList.classCode) {
      dispatch({ type: 'CL_SET_CLASS_CODE', classCode: next });
    }
  }, [classList.initials, classList.yearGroup, classList.academicYear, classList.classLetter]);

  // (Re)compute codes when:
  //  - a freshly-typed student row has no code yet, OR
  //  - the teacher's public key changed (e.g. they loaded different
  //    keydetails) — in which case stored codes from a previous
  //    keypair would no longer match.
  useEffect(() => {
    if (!publicKeyN) return;
    if (classList.students.length === 0) return;
    let cancelled = false;
    (async () => {
      const { students, collisions } = await computeStudentCodes(
        classList.students.map(s => s.username), publicKeyN,
      );
      if (cancelled) return;
      // Only dispatch when at least one code differs from what's in
      // state — prevents an infinite re-render loop.
      const changed = students.some(s => {
        const prior = classList.students.find(p => p.username === s.username);
        return !prior || prior.code !== s.code;
      });
      if (changed) dispatch({ type: 'CL_SET_STUDENTS', students, collisions });
    })();
    return () => { cancelled = true; };
  }, [classList.students, publicKeyN]);

  const takenCodes = useMemo(() => new Set(classList.students.map(s => s.code)), [classList.students]);

  const addStudents = async (usernames) => {
    const existing = new Set(classList.students.map(s => s.username));
    const all = [...classList.students.map(s => s.username), ...usernames.filter(u => !existing.has(u))];
    const { students, collisions } = await computeStudentCodes(all, publicKeyN);
    dispatch({ type: 'CL_SET_STUDENTS', students, collisions });
  };

  const renameStudent = async (oldUsername, newUsername) => {
    const next = classList.students.map(s => s.username === oldUsername
      ? { ...s, username: newUsername, suffixApplied: newUsername !== oldUsername }
      : s);
    const { students, collisions } = await computeStudentCodes(
      next.map(s => s.username), publicKeyN,
    );
    const enriched = students.map((s) => {
      const prev = next.find(p => p.username === s.username);
      return prev ? { ...s, suffixApplied: prev.suffixApplied || s.suffixApplied } : s;
    });
    dispatch({ type: 'CL_SET_STUDENTS', students: enriched, collisions });
  };

  const removeStudent = async (username) => {
    const next = classList.students.filter(s => s.username !== username);
    const { students, collisions } = await computeStudentCodes(
      next.map(s => s.username), publicKeyN,
    );
    dispatch({ type: 'CL_SET_STUDENTS', students, collisions });
  };

  const addOne = async () => {
    const u = newName.trim().toLowerCase();
    if (!u) return;
    setNewName('');
    await addStudents([u]);
  };

  const exportTxt = () => {
    if (!classList.classCode) return;
    const lines = [];
    lines.push(`KaraWeb class login codes`);
    lines.push(`Class: ${classList.classCode}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('username,code');
    for (const s of classList.students) {
      lines.push(`${s.username},${s.code}`);
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${classList.classCode}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Value for the dropdown: '' = please choose; saved code = that class;
  // SENTINEL_NEW = "+ New class…"; otherwise (active draft not yet saved)
  // we still show the picker UI but the dropdown sits on SENTINEL_NEW.
  const dropdownValue = inSavedList
    ? classList.classCode
    : (picked ? SENTINEL_NEW : '');

  return (
    <div className="editor-tab-panel">
      <div className="security-callout">
        <div className="security-callout-title">👥 About class lists</div>
        <ul>
          <li>Students need a <strong>username</strong> and a <strong>6-digit user number</strong> to take cloud-save challenges. Build a class here to generate those numbers and export them as a printable <code>.txt</code> for distribution.</li>
          <li>Only the user numbers are ever sent to the cloud — never the usernames themselves.</li>
          <li>Class lists are kept locally on this device; pick the relevant class from the mask dropdown below the grid to translate user numbers back to usernames when viewing submissions.</li>
        </ul>
      </div>
      <section className="cl-section cl-classes-strip">
        <h3 className="cl-section-title">Your classes</h3>
        <div className="cl-row">
          <label>Class:</label>
          <select
            value={dropdownValue}
            onChange={e => onPickDropdown(e.target.value)}
          >
            <option value="">Please choose…</option>
            {savedClasses.map(c => (
              <option key={c.classCode} value={c.classCode}>
                {c.classCode} ({c.students?.length ?? 0} students)
              </option>
            ))}
            <option value={SENTINEL_NEW}>+ New class…</option>
          </select>
          <button className="btn-secondary" onClick={() => classFileInputRef.current?.click()}>Load from .txt…</button>
          <input
            type="file"
            accept=".txt,text/plain"
            ref={classFileInputRef}
            style={{ display: 'none' }}
            onChange={handleLoadClassFile}
          />
          {picked && (
            <>
              <button
                className="btn-primary"
                disabled={!classList.classCode}
                onClick={saveClassToList}
                title="Save the current class to this browser"
              >Save</button>
              <button
                className="cl-row-btn danger"
                disabled={!classList.classCode || !inSavedList}
                onClick={deleteCurrentClass}
                title="Delete this class from the browser"
              >✕ Delete</button>
            </>
          )}
        </div>
        {!picked && (
          <p className="cl-empty">Pick a saved class to edit it, choose <strong>+ New class…</strong> to start one from scratch, or <strong>Load from .txt…</strong> to import a previously-exported login-codes file.</p>
        )}
      </section>

      {picked && (
        <>
          <section className="cl-section">
            <h3 className="cl-section-title">1. Class code</h3>
            <div className="cl-row">
              <label>Teacher initials</label>
              <input
                value={classList.initials}
                maxLength={4}
                onChange={e => dispatch({ type: 'CL_SET_FIELD', field: 'initials', value: e.target.value.toUpperCase() })}
                style={{ width: 70 }}
              />
              <label>Year group</label>
              <select
                value={classList.yearGroup}
                onChange={e => dispatch({ type: 'CL_SET_FIELD', field: 'yearGroup', value: e.target.value })}
                style={{ width: 70 }}
              >
                <option value=""></option>
                {Array.from({ length: 13 }, (_, i) => i + 1).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
              <label>Class letter</label>
              <select
                value={classList.classLetter}
                onChange={e => dispatch({ type: 'CL_SET_FIELD', field: 'classLetter', value: e.target.value })}
                style={{ width: 70 }}
              >
                <option value=""></option>
                {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(L => (
                  <option key={L} value={L}>{L}</option>
                ))}
              </select>
              <label>Academic year</label>
              <select
                value={classList.academicYear || currentAcademicYear()}
                onChange={e => dispatch({ type: 'CL_SET_FIELD', field: 'academicYear', value: e.target.value })}
                style={{ width: 90 }}
              >
                {(() => {
                  // Always include the currently-set AY (even if outside the
                  // ±2 window) so loading an older or future class still
                  // renders the right selection.
                  const opts = new Set(academicYearOptions());
                  if (classList.academicYear) opts.add(classList.academicYear);
                  return [...opts].sort().map(ay => (
                    <option key={ay} value={ay}>{ay}</option>
                  ));
                })()}
              </select>
            </div>
            <div className="cl-codepreview">
              <span>Class code:</span>
              {codeReady
                ? <code className="cl-code">{classList.classCode}</code>
                : <span className="cl-hint">{codeHint}</span>}
            </div>
          </section>

          <section className="cl-section">
            <h3 className="cl-section-title">2. Students</h3>
            <div className="cl-row">
              <input
                placeholder="Add a username"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addOne(); }}
                style={{ width: 200 }}
              />
              <button className="btn-secondary" onClick={addOne}>+ Add</button>
              <button className="btn-secondary" onClick={() => setShowPaste(true)}>Paste in list…</button>
              <button className="btn-secondary" disabled={!classList.students.length || !classList.classCode} onClick={exportTxt}>Export login codes (.txt)</button>
            </div>

            <CollisionResolver
              collisions={classList.collisions}
              takenCodes={takenCodes}
              publicKeyN={publicKeyN}
              onRename={renameStudent}
            />

            {classList.students.length === 0 && (
              <p className="cl-empty">No students yet. Add usernames above or paste a list.</p>
            )}

            {classList.students.length > 0 && (
              <table className="cl-student-table">
                <thead>
                  <tr><th>Username</th><th>6-digit code</th><th></th></tr>
                </thead>
                <tbody>
                  {classList.students.map(s => (
                    <tr key={s.username}>
                      <td>
                        <code>{s.username}</code>
                        {s.suffixApplied && <span className="cl-tag">suffix</span>}
                      </td>
                      <td><code className="cl-code-cell">{s.code}</code></td>
                      <td>
                        <button
                          className="cl-row-btn danger"
                          title="Remove this student"
                          onClick={() => removeStudent(s.username)}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {classList.status?.message && (
            <div className={`cl-status cl-status-${classList.status.kind || ''}`}>
              {classList.status.message}
            </div>
          )}
        </>
      )}

      {showPaste && (
        <StudentBulkPasteModal
          existingUsernames={classList.students.map(s => s.username)}
          onConfirm={addStudents}
          onClose={() => setShowPaste(false)}
        />
      )}
      {rememberClass && (
        <RememberOnDeviceModal
          what="class list"
          detail={rememberClass.classCode}
          onYes={() => confirmRememberClass(true)}
          onNo={() => confirmRememberClass(false)}
        />
      )}
      {confirmModalEl}
    </div>
  );
}
