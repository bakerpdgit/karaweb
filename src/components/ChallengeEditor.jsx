import React, { useRef, useState } from 'react';
import EditorTabs from './tabs/EditorTabs.jsx';
import TeacherKeysPanel from './classlist/TeacherKeysPanel.jsx';
import CloudSavePanel from './cloudsave/CloudSavePanel.jsx';
import AnalysePanel from './analyse/AnalysePanel.jsx';
import { useConfirmModal } from './ConfirmModal.jsx';
import { newGuid } from '../utils/guid.js';
import AllowedBlocksModal from './AllowedBlocksModal.jsx';
// Note: the checkpoint controls + the notes editor used to live in
// this file's ChallengesTab — they have been moved into
// ChallengeCheckpointBar (rendered above the world in App.jsx) and
// the Notes tab inside ChallengeContextPanel respectively.

/**
 * Challenge Editor view with a horizontal tab bar.
 *
 * The "Challenges" tab keeps the existing sidebar+form behaviour intact:
 * the world editor + program editor render in their usual panels below,
 * and the reducer redirects edits to the active challenge so those
 * components transparently edit challenge state when challengeEditor is on.
 *
 * The other tabs (Class List, Cloud Save, Analyse Submissions) drop in
 * panels that only need the sidebar area; the world/program panels keep
 * rendering below so Blockly/Monaco state is preserved across tab
 * switches.
 */
export default function ChallengeEditor({
  challenges,
  editingChallengeId,
  editorActiveTab,
  appMode,
  classList,
  keydetails,
  classes,
  challengeFileGuid,
  cloudSave,
  analyse,
  loadedCloudSave,
  dispatch,
  requestPrivateKey,
}) {
  const editing = challenges.find(c => c.id === editingChallengeId);

  // Cloud-save flow tabs are gated on having a teacher key pair. The
  // Teacher Keys tab itself is always available so the teacher can
  // generate / load keys before the rest unlock. Submissions stays
  // open when keys exist (its inner Class Setup section is still
  // useful even before Cloud Save is configured).
  const disabledHints = {};
  if (!keydetails) {
    disabledHints.cloudSave = 'Generate or load your teacher keys first';
    disabledHints.analyse   = 'Generate or load your teacher keys first';
  }

  // On the "challenges" tab the world / code editor renders below in
  // main-layout — the bar stays content-sized. On other tabs main-
  // layout is hidden so the bar should claim remaining space and
  // scroll its tall content (e.g. Submissions grid).
  const fillClass = editorActiveTab !== 'challenges' ? ' editor-bar-fill' : '';

  return (
    <div className={`challenge-editor-bar${fillClass}`}>
      <div className="challenge-editor-bar-header">
        <span className="challenge-editor-title">Challenge Editor</span>
        <button
          className="header-btn"
          title="Exit editor and return to default workspace"
          onClick={() => dispatch({ type: 'CH_EXIT_EDITOR' })}
        >✕ Exit editor</button>
      </div>

      <EditorTabs
        activeTab={editorActiveTab}
        onChange={(tab) => dispatch({ type: 'EDITOR_SET_TAB', tab })}
        disabledHints={disabledHints}
      />

      {editorActiveTab === 'challenges' && (
        <ChallengesTab
          challenges={challenges}
          editing={editing}
          appMode={appMode}
          challengeFileGuid={challengeFileGuid}
          dispatch={dispatch}
        />
      )}

      {editorActiveTab === 'teacherKeys' && (
        <TeacherKeysPanel
          keydetails={keydetails}
          dispatch={dispatch}
          requestPrivateKey={requestPrivateKey}
        />
      )}

      {editorActiveTab === 'cloudSave' && (
        <CloudSavePanel
          cloudSave={cloudSave}
          classList={classList}
          keydetails={keydetails}
          dispatch={dispatch}
        />
      )}

      {editorActiveTab === 'analyse' && (
        <AnalysePanel
          classList={classList}
          classes={classes}
          keydetails={keydetails}
          cloudSave={cloudSave}
          analyse={analyse}
          challenges={challenges}
          loadedCloudSave={loadedCloudSave}
          challengeFileGuid={challengeFileGuid}
          dispatch={dispatch}
          requestPrivateKey={requestPrivateKey}
        />
      )}
    </div>
  );
}

function ChallengesTab({ challenges, editing, appMode, challengeFileGuid, dispatch }) {
  const renameRef = useRef(null);
  const [renameDraft, setRenameDraft] = useState(editing?.name ?? '');
  const { confirm, modal } = useConfirmModal();
  const [allowedBlocksOpen, setAllowedBlocksOpen] = useState(false);

  React.useEffect(() => {
    setRenameDraft(editing?.name ?? '');
  }, [editing?.id, editing?.name]);

  const submitRename = () => {
    if (!editing) return;
    const n = renameDraft.trim();
    if (n && n !== editing.name) {
      dispatch({ type: 'CH_RENAME', id: editing.id, name: n });
    } else {
      setRenameDraft(editing.name);
    }
  };

  const regenerateGuid = async () => {
    const ok = await confirm({
      title: 'Regenerate file GUID?',
      message: 'Previously-submitted results stay in your sheet but will no longer appear in Analyse.',
      confirmLabel: 'Regenerate',
      variant: 'danger',
    });
    if (!ok) return;
    dispatch({ type: 'CH_FILE_GUID_SET', guid: newGuid() });
  };

  return (
    <>
      <div className="challenge-editor-body">
        <div className="challenge-list">
          {challenges.length === 0 && (
            <div className="challenge-list-empty">Click <strong>+ New challenge</strong> to create your first challenge.</div>
          )}
          {challenges.map((c, idx) => (
            <div
              key={c.id}
              className={`challenge-list-item ${c.id === editing?.id ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'CH_SET_EDITING_CHALLENGE', id: c.id })}
            >
              <span className="challenge-list-name">{c.name}</span>
              <button
                title="Move up"
                className="challenge-list-btn"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CH_MOVE', id: c.id, delta: -1 }); }}
                disabled={idx === 0}
              >↑</button>
              <button
                title="Move down"
                className="challenge-list-btn"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CH_MOVE', id: c.id, delta: +1 }); }}
                disabled={idx === challenges.length - 1}
              >↓</button>
              <button
                title="Delete this challenge"
                className="challenge-list-btn danger"
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = await confirm({
                    message: `Delete "${c.name}"?`,
                    confirmLabel: 'Delete',
                    variant: 'danger',
                  });
                  if (ok) dispatch({ type: 'CH_DELETE', id: c.id });
                }}
              >✕</button>
            </div>
          ))}
          <button
            className="header-btn challenge-list-new"
            title="Add a new challenge"
            onClick={() => dispatch({ type: 'CH_NEW' })}
          >+ New challenge</button>
          <span className="ch-file-guid">
            File GUID: <code title="Stable per-book identifier used by cloud-save">{challengeFileGuid ? challengeFileGuid.slice(0, 8) + '…' : '(none yet)'}</code>
            <button
              className="header-btn"
              title="Mint a new GUID (orphans previously-submitted results)"
              onClick={regenerateGuid}
              style={{ marginLeft: 6 }}
            >🔄</button>
          </span>
        </div>

        {modal}
        {editing && (
          <div className="challenge-edit-form">
            <div className="challenge-edit-row">
              <label>Name:</label>
              <input
                ref={renameRef}
                className="challenge-edit-name"
                value={renameDraft}
                onChange={e => setRenameDraft(e.target.value)}
                onBlur={submitRename}
                onKeyDown={e => { if (e.key === 'Enter') submitRename(); }}
              />
              <label>Mode:</label>
              <select
                value={editing.mode}
                onChange={e => dispatch({ type: 'CH_SET_MODE', id: editing.id, mode: e.target.value })}
                title="Programming mode the user must solve this challenge in"
              >
                <option value="fsm">FSM</option>
                <option value="blocks">Blocks</option>
                <option value="python">Python</option>
              </select>
              <label className="challenge-allow-mode" title="Lets the student switch programming mode while taking this challenge. Off by default — the student is locked to the mode you set.">
                <input
                  type="checkbox"
                  checked={!!editing.allowModeChange}
                  onChange={e => dispatch({ type: 'CH_SET_ALLOW_MODE_CHANGE', id: editing.id, allow: e.target.checked })}
                />
                Allow mode change
              </label>
              <label className="challenge-allow-mode" title="When ticked, the student is capped on how much they can add beyond the starter. Configure the cap below.">
                <input
                  type="checkbox"
                  checked={!!editing.limits?.enforced}
                  onChange={e => dispatch({ type: 'CH_SET_LIMITS', id: editing.id, limits: { enforced: e.target.checked } })}
                />
                Enforce code limit
              </label>
              <label className="challenge-allow-mode" title="When ticked, Kara's final facing direction is not checked — only her position and the cell contents.">
                <input
                  type="checkbox"
                  checked={!!editing.ignoreOrientation}
                  onChange={e => dispatch({ type: 'CH_SET_IGNORE_ORIENTATION', id: editing.id, ignore: e.target.checked })}
                />
                Ignore Kara's final orientation
              </label>
              <label className="challenge-allow-mode" title="When ticked, Kara just needs to pass through the target world at some point during execution (intermediates still in order). Default off — Kara must end on the target.">
                <input
                  type="checkbox"
                  checked={!!editing.endOnTargetNotRequired}
                  onChange={e => dispatch({ type: 'CH_SET_END_ON_TARGET_NOT_REQUIRED', id: editing.id, value: e.target.checked })}
                />
                End on target not required
              </label>
              {(editing.mode === 'blocks' || editing.allowModeChange) && (
                <button
                  type="button"
                  className="header-btn"
                  title="Restrict which Blockly blocks the student sees in the toolbox for this challenge"
                  onClick={() => setAllowedBlocksOpen(true)}
                >
                  {(editing.disallowedBlocks?.length ?? 0) > 0
                    ? `Allowed blocks (${editing.disallowedBlocks.length} disabled)…`
                    : 'Allowed blocks…'}
                </button>
              )}
            </div>
            <p className="challenge-edit-help">
              Paint each checkpoint world on the left; write the <strong>{editing.mode}</strong>
              {' '}starter on the right. The program must pass through every checkpoint to reach <em>Target</em>.
            </p>
            {editing.limits?.enforced && (
              <ChallengeLimitsEditor challenge={editing} appMode={appMode} dispatch={dispatch} />
            )}
          </div>
        )}
      </div>
      {allowedBlocksOpen && editing && (
        <AllowedBlocksModal
          disallowedBlocks={editing.disallowedBlocks ?? []}
          onSave={(next) => {
            dispatch({ type: 'CH_SET_DISALLOWED_BLOCKS', id: editing.id, disallowedBlocks: next });
            setAllowedBlocksOpen(false);
          }}
          onCancel={() => setAllowedBlocksOpen(false)}
        />
      )}
    </>
  );
}

// Per-mode caps on how much code the student can add beyond the
// starter. Rendered only when `editing.limits.enforced` is true.
// Shows only the field(s) for the editor's CURRENT app mode — to
// configure another mode the teacher switches the app mode first.
function ChallengeLimitsEditor({ challenge, appMode, dispatch }) {
  const lim = challenge.limits || {};
  const onNum = (mode, field) => (e) => {
    const raw = e.target.value.trim();
    const val = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw)));
    if (!Number.isFinite(val)) return;
    dispatch({ type: 'CH_SET_LIMITS', id: challenge.id, limits: { [mode]: { [field]: val } } });
  };
  return (
    <div className="challenge-limits-editor challenge-limits-row">
      <span className="challenge-limits-label">Code limit of</span>
      {appMode === 'blocks' && (
        <>
          <label>extra blocks
            <input type="number" min="0" value={lim.blocks?.added ?? 0}
              onChange={onNum('blocks', 'added')} style={{ width: 60 }} />
          </label>
          <span className="cl-hint">(beyond the starter)</span>
        </>
      )}
      {appMode === 'fsm' && (
        <>
          <label>extra states
            <input type="number" min="0" value={lim.fsm?.states ?? 0}
              onChange={onNum('fsm', 'states')} style={{ width: 60 }} />
          </label>
          <label>extra transitions
            <input type="number" min="0" value={lim.fsm?.transitions ?? 0}
              onChange={onNum('fsm', 'transitions')} style={{ width: 60 }} />
          </label>
          <span className="cl-hint">(beyond the starter)</span>
        </>
      )}
      {appMode === 'python' && (
        <>
          <label>extra tokens
            <input type="number" min="0" value={lim.python?.tokens ?? 0}
              onChange={onNum('python', 'tokens')} style={{ width: 60 }} />
          </label>
          <span className="cl-hint">(keywords / identifiers / literals / operators beyond the starter)</span>
        </>
      )}
    </div>
  );
}
