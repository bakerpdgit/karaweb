import React, { useReducer, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { initialState, reducer, getInitialAppMode, getSaveState, getCheckpointSequence, worldsEqual } from './store.js';
import { buildSaveData, downloadJSON, parseSaveData } from './utils.js';
import { INTRO_NOTES, EXAMPLES } from './examples.js';
import introToProgramming1 from '../dist-content/intro-to-programming-book-1.json';
import WorldEditor from './components/WorldEditor.jsx';
import WorldThumbnail from './components/WorldThumbnail.jsx';
import ChallengeContextPanel from './components/ChallengeContextPanel.jsx';
import FSMEditor from './components/FSMEditor.jsx';
import TransitionModal from './components/TransitionModal.jsx';
import SimulationControls from './components/SimulationControls.jsx';
import SensorDisplay from './components/SensorDisplay.jsx';
import VariablesDisplay from './components/VariablesDisplay.jsx';
import ExecutionLog from './components/ExecutionLog.jsx';
import AboutModal from './components/AboutModal.jsx';
import TutorialModal from './components/TutorialModal.jsx';
import { TUTORIAL_CHAPTERS, DEFAULT_TUTORIAL_SLUG } from './tutorial/index.js';
import {
  resolveUserSlot, getBookProgress, saveChallengeRun, saveChallengeResult,
  clearBookProgress, listBookProgressSlots, importBookProgress,
} from './utils/bookProgress.js';
import SaveDialog from './components/SaveDialog.jsx';
import NotesPanel from './components/NotesPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import BlocksEditor from './components/BlocksEditor.jsx';
import PythonEditor from './components/PythonEditor.jsx';
import ChallengesMenu from './components/ChallengesMenu.jsx';
import ChallengeEditor from './components/ChallengeEditor.jsx';
import ChallengeCheckpointBar from './components/ChallengeCheckpointBar.jsx';
import TeacherSolutionBar from './components/TeacherSolutionBar.jsx';
import StudentSolutionBar from './components/StudentSolutionBar.jsx';
import CodeLimitsBar, { SolutionExtrasBar } from './components/CodeLimitsBar.jsx';
import {
  effectiveBlocksCap, effectivePythonTokensCap,
  effectiveFsmStatesCap, effectiveFsmTransitionsCap,
} from './utils/codeLimits.js';
import StudentLoginModal from './components/cloudsave/StudentLoginModal.jsx';
import CloudSaveBanner from './components/cloudsave/CloudSaveBanner.jsx';
import TeacherKeyCheckModal from './components/cloudsave/TeacherKeyCheckModal.jsx';
import KeydetailsPasswordModal from './components/cloudsave/KeydetailsPasswordModal.jsx';
import WelcomeSlideshow from './components/WelcomeSlideshow.jsx';
import MainWelcomeSlideshow from './components/MainWelcomeSlideshow.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import { useConfirmModal } from './components/ConfirmModal.jsx';
import { checkForUpdate } from './utils/updateCheck.js';
import QueuedResultsChip from './components/QueuedResultsChip.jsx';
import QueuedSubmissionsModal from './components/QueuedSubmissionsModal.jsx';
import { unlockKeyDetailsFile } from './utils/keyDetailsFile.js';
import { deriveSubmissionVerifier } from './utils/passwordVerifier.js';
import ShareLinkModal from './components/ShareLinkModal.jsx';
import { normaliseChallengesUrl } from './utils/normaliseChallengesUrl.js';
import { usePythonRunner } from './python/usePythonRunner.js';
import { generateFromState, buildPythonProgram } from './python/blocks/pythonGenerator.js';
import {
  getKeyDetails, setKeyDetails,
  getStudentSession, setStudentSession,
  getGoogleDriveConfig, getCodehooksConfig,
  getLastLoadedCloudSave, setLastLoadedCloudSave,
  listClassLists, getClassList, setClassList,
  getWelcomeShown, setWelcomeShown,
  getMainWelcomeShown, setMainWelcomeShown,
  getSessionKeyDetails, setSessionKeyDetails,
  getSessionClasses, setSessionClasses,
  runLegacyMigrationOnce,
} from './utils/localStore.js';
import { encryptForPublicKey } from './utils/crypto/envelope.js';
import { postCloudResult } from './utils/cloudClient.js';
import { enqueueResult, flushQueue, flushAllQueues } from './utils/resultQueue.js';
import { getTurnstileToken } from './utils/turnstile.js';
import { currentSolutionSnapshot } from './utils/currentSolutionSnapshot.js';

// The localStorage key used for a loaded cloud-save file's session /
// queue / snapshot. Both backends now scope by the stable
// challengeFileGuid — Codehooks dropped per-class scoping when it
// adopted the pubFingerprint identity model.
function sessionKeyFor(cs) {
  return cs?.challengeFileGuid || null;
}

export default function App() {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => ({ ...initialState, appMode: getInitialAppMode() }),
  );
  const [editTarget, setEditTarget]     = useState(null);
  const [showAbout, setShowAbout]       = useState(false);
  // Teacher tutorial modal. Null = closed; string = open at that chapter slug.
  const [tutorialSlug, setTutorialSlug] = useState(null);
  const [showSave, setShowSave]         = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loadError, setLoadError]       = useState(null);
  const [migrationToast, setMigrationToast] = useState(null);
  const [showStudentLogin, setShowStudentLogin] = useState(false);
  // Teacher key-check (Exit / Edit gating when a cloud-save file is loaded)
  const [keyCheck, setKeyCheck] = useState(null);    // { action: 'exit'|'edit', onSuccess: fn }
  // Post-save share-link modal
  const [shareModal, setShareModal] = useState(null); // { filename } | null
  // Keydetails password modal — pops when an operation needs the
  // private key but the keypair is currently locked.
  //   { resolve, reject, errorText, busy }
  const [pwModal, setPwModal] = useState(null);
  // First-run welcome slideshow visibility. Re-evaluated when the
  // teacher enters the Challenge Editor.
  const [showWelcome, setShowWelcome] = useState(false);
  const [showMainWelcome, setShowMainWelcome] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [sensorsOpen, setSensorsOpen]   = useState(true);
  const [notesOpen, setNotesOpen]       = useState(true);
  const [showPanelsMenu, setShowPanelsMenu] = useState(false);
  const panelsMenuRef = useRef(null);

  const [leftWidth, setLeftWidth]       = useState(614);
  const leftWidthRef = useRef(leftWidth);
  useEffect(() => { leftWidthRef.current = leftWidth; }, [leftWidth]);

  const {
    appMode, world, fsm, sensors, sim, worldTool,
    blocks, python, runner,
    dirtyFsm, dirtyBlocks, dirtyPython,
    challenges, currentChallengeId, challengeEditor,
    editingChallengeId, editingCheckpointIdx, editingTarget, challengeResult,
    challengeWork,
    editorActiveTab, classList, cloudSave, analyse,
    loadedCloudSave, studentSession,
    keydetails, classes, challengeFileGuid,
    scratchpadChallenge,
  } = state;

  const activeChallenge = currentChallengeId
    ? (scratchpadChallenge?.id === currentChallengeId
        ? scratchpadChallenge
        : challenges.find(c => c.id === currentChallengeId))
    : null;
  const editingChallenge = (challengeEditor && editingChallengeId)
    ? challenges.find(c => c.id === editingChallengeId)
    : null;
  // Whichever challenge is in scope for the side panels (notes + target).
  const contextChallenge = editingChallenge ?? activeChallenge;

  // ── Per-book localStorage progress ───────────────────────────────────
  // bookGuid identifies the loaded book; userSlot scopes progress to
  // each student (their 6-digit cloud code, or 'anon' when not logged in).
  const bookGuid = loadedCloudSave?.challengeFileGuid || challengeFileGuid || '';
  const userSlot = useMemo(() => resolveUserSlot(studentSession), [studentSession?.studentCode]);
  // Bumped after every save/reset so the cached read re-runs and the
  // UI (ChallengesMenu indicators) re-renders.
  const [progressTick, setProgressTick] = useState(0);
  const bookProgress = useMemo(() => {
    if (!bookGuid) return null;
    return getBookProgress(bookGuid, userSlot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookGuid, userSlot, progressTick]);
  const hasAnyProgress = useMemo(() => {
    if (!bookGuid) return false;
    return listBookProgressSlots(bookGuid).length > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookGuid, progressTick]);

  // Keep latest studentSession in a ref so async callbacks (e.g. the
  // restore-from-file prompt) can read the current slot without
  // re-creating their parent useCallbacks on every change.
  const studentSessionRef = useRef(studentSession);
  useEffect(() => { studentSessionRef.current = studentSession; }, [studentSession]);

  // Hydrate `challengeWork` from localStorage whenever the book identity
  // or the active user-slot changes. Replaces in-memory work entirely
  // so a slot switch doesn't carry the previous student's code over.
  useEffect(() => {
    if (!bookGuid) return;
    const progress = getBookProgress(bookGuid, userSlot);
    const workMap = {};
    if (progress?.challenges) {
      for (const ch of challenges) {
        const stored = progress.challenges[ch.guid];
        if (stored?.code) workMap[ch.id] = stored.code;
      }
    }
    dispatch({ type: 'CH_HYDRATE_WORK', workMap, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookGuid, userSlot]);

  // Confirm modal used by the "Reset book progress" action.
  const { confirm: confirmAction, modal: confirmModalEl } = useConfirmModal();
  const requestResetBookProgress = useCallback(async () => {
    if (!bookGuid) return;
    const ok = await confirmAction({
      title: 'Reset book progress?',
      message: 'This wipes all locally-stored code and pass marks for this book of challenges across ALL students who have used this browser. It does NOT affect any results already submitted to the cloud.',
      confirmLabel: 'Reset',
      variant: 'danger',
    });
    if (!ok) return;
    clearBookProgress(bookGuid);
    dispatch({ type: 'CH_RESET_BOOK_PROGRESS' });
    setProgressTick(t => t + 1);
  }, [bookGuid, confirmAction]);

  // Save-progress export: build the book file with the current user's
  // progress embedded as `userProgress`. Re-opening the file on any
  // device prompts the user to restore — see the import path in
  // loadParsedJson.
  const handleSaveBookProgress = useCallback(() => {
    if (!bookGuid) return;
    const progress = getBookProgress(bookGuid, userSlot);
    if (!progress?.challenges || Object.keys(progress.challenges).length === 0) return;
    const snap = getSaveState(state);
    const filename = `karaweb_progress_${userSlot}`;
    downloadJSON(
      buildSaveData({
        world: snap.world,
        fsm:   snap.fsm,
        appMode: snap.appMode,
        blocklyState:   snap.blocks?.blocklyState ?? null,
        pythonCode:     snap.python?.code ?? '',
        pythonFontSize: snap.python?.fontSize ?? 14,
        name:           filename,
        challenges:     snap.challenges,
        challengeWork:  snap.challengeWork,
        cloudSave:      loadedCloudSave ?? null,
        challengeFileGuid: bookGuid,
        userProgress: {
          bookGuid, userSlot,
          updatedAt: progress.updatedAt || new Date().toISOString(),
          challenges: progress.challenges,
        },
      }),
      filename,
    );
  }, [bookGuid, userSlot, state, loadedCloudSave]);

  const pythonRunner = usePythonRunner({ appMode, world, sim, dispatch });

  // FSM-mode auto-run interval; python modes are driven by the worker itself.
  useEffect(() => {
    if (appMode !== 'fsm') return;
    if (sim.mode !== 'running') return;
    const id = setInterval(() => dispatch({ type: 'SIM_STEP' }), sim.speed);
    return () => clearInterval(id);
  }, [appMode, sim.mode, sim.speed]);

  // When a challenge run finishes (sim moves to paused with savedWorld set
  // and runner is idle/finished), check the world against the target.
  // Also fires in editor mode so the teacher can verify their starter
  // or solution actually solves the challenge.
  useEffect(() => {
    const idForCheck = currentChallengeId
      || (challengeEditor ? editingChallengeId : null);
    if (!idForCheck) return;
    if (challengeResult) return;             // already decided
    const ranFSM = appMode === 'fsm' && sim.mode === 'paused' && sim.savedWorld;
    const ranPY  = (appMode === 'blocks' || appMode === 'python')
                 && (runner.status === 'finished' || runner.status === 'error');
    if (ranFSM || ranPY) {
      dispatch({ type: 'CH_CHECK_RESULT' });
    }
  }, [currentChallengeId, challengeEditor, editingChallengeId, challengeResult, appMode, sim.mode, sim.savedWorld, runner.status]);

  // ── Progress save: code snapshot at run-start ────────────────────────
  // Watches sim.mode + runner.status for the transition into a running
  // state. On the rising edge, snapshot the active mode's code for the
  // active student challenge and persist to localStorage.
  const wasRunningRef = useRef(false);
  useEffect(() => {
    const isRunning = sim.mode === 'running' || runner.status === 'running';
    const wasRunning = wasRunningRef.current;
    wasRunningRef.current = isRunning;
    if (!isRunning || wasRunning) return;
    // Only record runs against the student's currentChallenge (not the
    // teacher's editor sanity-run, not the scratchpad).
    if (!currentChallengeId || challengeEditor || scratchpadChallenge) return;
    const ch = challenges.find(c => c.id === currentChallengeId);
    if (!ch || !bookGuid || !ch.guid) return;
    const code = { fsm: null, blocks: null, python: '' };
    if (appMode === 'fsm')    code.fsm    = fsm;
    if (appMode === 'blocks') code.blocks = blocks.blocklyState;
    if (appMode === 'python') code.python = python.code;
    saveChallengeRun(bookGuid, userSlot, ch.guid, code);
    setProgressTick(t => t + 1);
  }, [sim.mode, runner.status, currentChallengeId, challengeEditor, scratchpadChallenge,
      challenges, bookGuid, userSlot, appMode, fsm, blocks.blocklyState, python.code]);

  // ── Progress save: pass/fail at result-time ──────────────────────────
  // Watches challengeResult for the transition from null to non-null;
  // persists the outcome to localStorage. The preceding run-start
  // effect has already stored the code snapshot — this just updates
  // the `passed` flag on the same entry.
  const lastResultRef = useRef(null);
  useEffect(() => {
    const prev = lastResultRef.current;
    lastResultRef.current = challengeResult;
    if (!challengeResult || challengeResult === prev) return;
    if (!currentChallengeId || challengeEditor || scratchpadChallenge) return;
    const ch = challenges.find(c => c.id === currentChallengeId);
    if (!ch || !bookGuid || !ch.guid) return;
    saveChallengeResult(bookGuid, userSlot, ch.guid, challengeResult === 'success');
    setProgressTick(t => t + 1);
  }, [challengeResult, currentChallengeId, challengeEditor, scratchpadChallenge,
      challenges, bookGuid, userSlot]);

  // ── Checkpoint progression tracking ──────────────────────────────────
  // While a challenge is running we watch the world after each change
  // and advance `sim.checkpointIdx` as soon as the world matches the
  // next-expected checkpoint. CH_CHECK_RESULT at the end of the run
  // requires the final checkpoint (target) to have been reached.
  // Also runs in editor mode against the editing challenge so the
  // teacher's check-run reports pass/fail correctly.
  useEffect(() => {
    const ch = activeChallenge ?? editingChallenge;
    if (!ch) return;
    if (sim.mode === 'edit') return;          // not running
    if (challengeResult) return;              // already decided
    const seq = getCheckpointSequence(ch);
    const lastIdx = seq.length - 1;
    const cmpOpts = { ignoreOrientation: !!ch.ignoreOrientation };
    let reached = sim.checkpointIdx ?? 0;
    while (reached < lastIdx && worldsEqual(world, seq[reached + 1], cmpOpts)) {
      reached += 1;
    }
    if (reached !== (sim.checkpointIdx ?? 0)) {
      dispatch({ type: 'SIM_ADVANCE_CHECKPOINT', idx: reached });
    }
  }, [world, sim.mode, sim.checkpointIdx, challengeResult, activeChallenge, editingChallenge]);

  // ── Challenge context panel auto-open ─────────────────────────────────
  // Open the side context panel whenever a challenge becomes active or
  // the teacher enters the editor on a challenge — both cases give the
  // user something useful (notes / target / editor) to look at.
  useEffect(() => {
    if (contextChallenge) setNotesOpen(true);
  }, [contextChallenge?.id, challengeEditor]);

  // ── Auto-switch programming mode when entering a locked challenge ───
  // The teacher set this challenge's `mode`; the student is locked to
  // it unless `allowModeChange` is true. Snap the app mode to the
  // challenge mode on entry so the right editor surface is showing.
  useEffect(() => {
    if (!activeChallenge) return;
    if (activeChallenge.allowModeChange) return;
    if (appMode !== activeChallenge.mode) {
      dispatch({ type: 'SET_APP_MODE', mode: activeChallenge.mode });
    }
  }, [activeChallenge?.id, activeChallenge?.mode, activeChallenge?.allowModeChange]);

  // ── Cloud submission of challenge results ─────────────────────────────
  // Once the challenge result is decided AND we have a cloud-save block
  // loaded AND we have a logged-in student session, build an encrypted
  // result envelope and POST it. On failure we enqueue and try later.
  //
  // Skipped when the student was viewing the teacher's reference
  // solution — running the solution shouldn't count as the student's
  // own submission.
  useEffect(() => {
    if (!currentChallengeId) return;
    if (!challengeResult) return;
    if (sim.showingSolution) return;
    const sessionKey = sessionKeyFor(loadedCloudSave);
    if (!sessionKey) return;
    if (!studentSession?.sessionKey) return;
    if (studentSession.sessionKey !== sessionKey) return;
    // Identify the challenge by its stable guid.
    const ch = challenges.find(c => c.id === currentChallengeId);
    if (!ch?.guid) return;
    const submittedAt = new Date().toISOString();
    const passed = challengeResult === 'success';
    // Inner payload that gets RSA-OAEP encrypted. Contains the student's
    // solution program so the teacher can render it in Analyse.
    const innerPayload = {
      type: 'karaweb-result-v1',
      studentCode:       studentSession.studentCode,
      challengeGuid:     ch.guid,
      challengeName:     ch.name,
      challengeFileGuid: loadedCloudSave.challengeFileGuid || null,
      submittedAt,
      passed,
      solution: currentSolutionSnapshot(state),
    };
    let cancelled = false;
    (async () => {
      let envelope;
      try {
        envelope = await encryptForPublicKey(innerPayload, loadedCloudSave.publicKeyJwk);
      } catch (err) {
        console.warn('Result encryption failed:', err);
        return;
      }
      if (cancelled) return;
      const queueItem = {
        encryptedPayload: envelope,
        submittedAt,
        challengeGuid: ch.guid,
        challengeFileGuid: loadedCloudSave.challengeFileGuid || null,
        passed,
        studentCode: studentSession.studentCode,
      };
      // Both backends now default to TURNSTILE_REQUIRED=true, so fetch
      // a token on every submission regardless of which backend the
      // book uses.
      let turnstileToken = '';
      try {
        turnstileToken = await getTurnstileToken();
      } catch (err) {
        console.warn('Turnstile token fetch failed:', err?.message ?? err);
      }
      if (cancelled) return;
      try {
        await postCloudResult(loadedCloudSave, {
          studentCode: studentSession.studentCode,
          challengeGuid: ch.guid,
          passed,
          encryptedPayload: envelope,
          submittedAt,
          turnstileToken,
        });
      } catch (err) {
        console.warn('Result POST failed, enqueueing:', err?.message ?? err);
        enqueueResult(sessionKey, queueItem);
      }
    })();
    return () => { cancelled = true; };
  }, [challengeResult, currentChallengeId]);

  // ── Boot: try to drain any queued result buffers ──────────────────────
  // We resolve each class's cloudSave from the snapshot the student-login
  // flow persisted. Classes the user has never logged into locally get
  // skipped (we don't know where to post their results).
  useEffect(() => {
    const resolve = (cc) => getLastLoadedCloudSave(cc) || null;
    flushAllQueues(resolve).catch(err => console.warn('Queue flush failed:', err));
  }, []);

  // ── Drain the queue on focus (student switching tabs / returning) ─────
  useEffect(() => {
    const key = sessionKeyFor(loadedCloudSave);
    if (!key) return;
    const handler = () => {
      if (document.visibilityState === 'visible') {
        flushQueue(key, loadedCloudSave).catch(() => { /* ignore — try again later */ });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [loadedCloudSave]);

  useEffect(() => {
    if (!showPanelsMenu) return;
    const handler = (e) => {
      if (!panelsMenuRef.current?.contains(e.target)) setShowPanelsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanelsMenu]);

  // ── Boot: legacy migration + load keydetails + classes from localStorage ─
  useEffect(() => {
    const m = runLegacyMigrationOnce();
    if (m.ran && (m.keydetailsImported || m.classesImported || m.codehooksConfigsRenamed)) {
      console.info('karaweb localStorage migration:', m);
      const bits = [];
      if (m.keydetailsImported)        bits.push('keys');
      if (m.classesImported)           bits.push(`${m.classesImported} class${m.classesImported === 1 ? '' : 'es'}`);
      if (m.codehooksConfigsRenamed)   bits.push(`${m.codehooksConfigsRenamed} codehooks setting${m.codehooksConfigsRenamed === 1 ? '' : 's'}`);
      setMigrationToast('Migrated legacy storage: ' + bits.join(', ') + '.');
    }
    // Keydetails: prefer the opt-in localStorage copy; otherwise fall
    // back to the per-tab sessionStorage mirror so a page reload within
    // the same tab restores keys even when the teacher said "No" to the
    // remember-on-device prompt.
    const storedKeys = getKeyDetails() || getSessionKeyDetails();
    if (storedKeys?.publicKeyJwk) {
      if (storedKeys.privateKeyJwk) {
        // Plain-text stored keys → unlocked from the start.
        dispatch({ type: 'KEY_SET', keydetails: {
          publicKeyJwk:  storedKeys.publicKeyJwk,
          privateKeyJwk: storedKeys.privateKeyJwk,
        }});
      } else if (storedKeys.encryptedKeyPair?.ciphertext) {
        // Stored in encrypted form → boot in a locked state. The
        // password modal will pop the first time any private-key
        // operation runs.
        dispatch({ type: 'KEY_SET', keydetails: {
          publicKeyJwk:     storedKeys.publicKeyJwk,
          privateKeyJwk:    null,
          encryptedKeyPair: storedKeys.encryptedKeyPair,
        }});
      }
    }
    // Classes: merge whatever's in opt-in localStorage with whatever the
    // sessionStorage mirror remembers (localStorage wins on classCode
    // collisions because it's the explicitly-saved copy).
    const localClasses   = listClassLists().map(cc => getClassList(cc)).filter(Boolean);
    const sessionClasses = getSessionClasses();
    const mergedByCode   = new Map();
    for (const c of sessionClasses) if (c?.classCode) mergedByCode.set(c.classCode, c);
    for (const c of localClasses)   if (c?.classCode) mergedByCode.set(c.classCode, c);
    const mergedClasses = Array.from(mergedByCode.values());
    if (mergedClasses.length) {
      dispatch({ type: 'CLASSES_SET_LIST', list: mergedClasses });
    }
  }, []);

  // Note: we deliberately do NOT auto-persist keydetails or class
  // lists to localStorage. The "Remember on this device?" modal
  // (TeacherKeysPanel + ClassListPanel) is the only path that writes
  // those keys, so the teacher is explicitly opting in each time.

  // ── Session-tier auto-mirror ─────────────────────────────────────────
  // Always shadow state.keydetails + state.classes into sessionStorage
  // (unconditional, regardless of the user's Yes/No on the
  // remember-on-device prompt) so a page reload within the same tab
  // re-hydrates them without re-prompting. The localStorage tier is
  // still opt-in via TeacherKeyCheckModal / ClassListPanel; this is a
  // pure additional safety net per tab.
  useEffect(() => {
    if (!keydetails?.publicKeyJwk) {
      setSessionKeyDetails(null);
      return;
    }
    setSessionKeyDetails({
      publicKeyJwk:     keydetails.publicKeyJwk,
      privateKeyJwk:    keydetails.privateKeyJwk ?? null,
      encryptedKeyPair: keydetails.encryptedKeyPair ?? null,
      submissionVerifier: keydetails.submissionVerifier ?? null,
    });
  }, [
    keydetails?.publicKeyJwk,
    keydetails?.privateKeyJwk,
    keydetails?.encryptedKeyPair,
    keydetails?.submissionVerifier,
  ]);

  useEffect(() => {
    setSessionClasses(classes ?? []);
  }, [classes]);

  // ── First-run welcome slideshow ──────────────────────────────────────
  // Pop the welcome slideshow the first time the teacher enters the
  // Challenge Editor. The "don't show again" tickbox writes a
  // localStorage flag; ticking the matching Settings checkbox clears
  // it and re-pops the slideshow on the spot.
  useEffect(() => {
    if (challengeEditor && !getWelcomeShown()) {
      setShowWelcome(true);
    }
  }, [challengeEditor]);

  // Main-site welcome slideshow: pops once on first visit (any context,
  // teacher or student). Same don't-show-again localStorage pattern.
  useEffect(() => {
    if (!getMainWelcomeShown()) setShowMainWelcome(true);
  }, []);

  // ── New-version-available banner ─────────────────────────────────────
  // /version.json (written by the Vite build hook) holds the deployed
  // build timestamp; the JS bundle has its own copy inlined as
  // __BUILD_TIME__. If they differ, a newer build is live and we ask
  // the user to reload. Check on mount + on every tab-focus/pageshow so
  // returning users notice updates promptly without any background poll.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      checkForUpdate().then(stale => {
        if (!cancelled && stale) setUpdateAvailable(true);
      });
    };
    run();
    const onVis = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', run);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', run);
    };
  }, []);

  // ── Password-protected keydetails: idle-relock + on-demand unlock ─────
  const IDLE_LOCK_MS = 60 * 60 * 1000;   // 60 minutes
  const IDLE_POLL_MS = 30 * 1000;        // poll every 30s; granularity is fine
  useEffect(() => {
    if (!keydetails?.encryptedKeyPair) return;     // no password → never locks
    if (!keydetails.privateKeyJwk)      return;     // already locked
    const id = setInterval(() => {
      if (Date.now() - (keydetails.lastUsedAt ?? 0) > IDLE_LOCK_MS) {
        dispatch({ type: 'KEY_LOCK' });
      }
    }, IDLE_POLL_MS);
    return () => clearInterval(id);
  }, [keydetails?.encryptedKeyPair, keydetails?.privateKeyJwk, keydetails?.lastUsedAt]);

  // Returns the in-memory private key, prompting for the password and
  // unlocking on demand if currently locked. Used by every code path
  // that needs the private key (Analyse fetch, re-export, decrypt-
  // and-show-solution-as-teacher).
  const requestPrivateKey = useCallback(async () => {
    if (!keydetails?.publicKeyJwk) {
      throw new Error('No keydetails loaded.');
    }
    // Fast path: have unlocked key OR no password to begin with.
    if (keydetails.privateKeyJwk) {
      const stale = !!keydetails.encryptedKeyPair
        && Date.now() - (keydetails.lastUsedAt ?? 0) > IDLE_LOCK_MS;
      if (!stale) {
        dispatch({ type: 'KEY_TOUCH' });
        return keydetails.privateKeyJwk;
      }
      // Treat stale-key path the same as locked — prompt again.
      dispatch({ type: 'KEY_LOCK' });
    }
    if (!keydetails.encryptedKeyPair) {
      throw new Error('Private key is missing and no encrypted blob is available to recover it.');
    }
    // Slow path: pop the unlock modal and wait for the password.
    return new Promise((resolve, reject) => {
      setPwModal({ resolve, reject, errorText: null, busy: false });
    });
  }, [keydetails]);

  const onUnlockSubmit = async (password) => {
    if (!keydetails?.encryptedKeyPair) {
      setPwModal(null);
      return;
    }
    setPwModal(m => m ? { ...m, busy: true, errorText: null } : m);
    try {
      const { privateKeyJwk } = await unlockKeyDetailsFile(keydetails.encryptedKeyPair, password);
      // Compute the submission verifier from the same password while
      // we still have it. Stays in memory (state); never persisted.
      const submissionVerifier = await deriveSubmissionVerifier(password, keydetails.publicKeyJwk);
      dispatch({ type: 'KEY_UNLOCK', privateKeyJwk, submissionVerifier });
      // Resolve waiting callers before clearing the modal so they
      // don't observe a transient null-pwModal state.
      const resolver = pwModal?.resolve;
      setPwModal(null);
      resolver?.(privateKeyJwk);
    } catch (err) {
      setPwModal(m => m ? { ...m, busy: false, errorText: err?.message ?? String(err) } : m);
    }
  };
  const onUnlockCancel = () => {
    pwModal?.reject?.(new Error('Password entry cancelled.'));
    setPwModal(null);
  };

  // ── Cloud-save file → student login prompt ─────────────────────────────
  // Whenever a cloud-save file lands (loadedCloudSave goes from null to a
  // valid object), check whether we already have a student session for
  // that class in localStorage. If so, auto-restore it; if not, pop the
  // login modal. Skip this whole flow when the *teacher* is the one with
  // the file open (i.e. they already have keydetails for that class in
  // their state — they aren't a student of their own class).
  useEffect(() => {
    const key = sessionKeyFor(loadedCloudSave);
    if (!key) return;
    // Teacher pathway: their per-teacher public key matches the public
    // key embedded in the loaded file → skip the student-login modal.
    if (keydetails?.publicKeyJwk?.n
        && loadedCloudSave?.publicKeyJwk?.n
        && keydetails.publicKeyJwk.n === loadedCloudSave.publicKeyJwk.n) {
      return;
    }
    // Already logged in for this file?
    if (studentSession?.sessionKey === key) return;
    // Try to restore from localStorage.
    const cached = getStudentSession(key);
    if (cached?.username && cached?.studentCode && cached?.sessionKey === key) {
      dispatch({ type: 'STUDENT_LOGIN', ...cached });
      setShowStudentLogin(false);
      return;
    }
    setShowStudentLogin(true);
  }, [loadedCloudSave]);

  // ── Teacher key-check gating ──────────────────────────────────────────
  // When the student is inside a cloud-save challenges book, exiting
  // challenge mode (or jumping into the editor) is gated on the teacher
  // proving they hold the matching keydetails. If we already have
  // matching keys in app state, the action runs immediately.
  const teacherKeysMatch = !!(
    keydetails?.publicKeyJwk?.n
    && loadedCloudSave?.publicKeyJwk?.n
    && keydetails.publicKeyJwk.n === loadedCloudSave.publicKeyJwk.n
  );

  const requestExitChallenge = useCallback(() => {
    // No cloud-save file loaded → no gating needed.
    if (!loadedCloudSave?.publicKeyJwk?.n) {
      dispatch({ type: 'CH_EXIT_PLAY' });
      return;
    }
    if (teacherKeysMatch) {
      dispatch({ type: 'CH_EXIT_PLAY' });
      return;
    }
    setKeyCheck({
      action: 'exit',
      onSuccess: () => {
        setKeyCheck(null);
        dispatch({ type: 'CH_EXIT_PLAY' });
      },
    });
  }, [loadedCloudSave, teacherKeysMatch]);

  const requestEnterEditor = useCallback(() => {
    if (!loadedCloudSave?.publicKeyJwk?.n) {
      dispatch({ type: 'CH_ENTER_EDITOR' });
      return;
    }
    if (teacherKeysMatch) {
      dispatch({ type: 'CH_ENTER_EDITOR' });
      return;
    }
    setKeyCheck({
      action: 'edit',
      onSuccess: () => {
        setKeyCheck(null);
        dispatch({ type: 'CH_ENTER_EDITOR' });
      },
    });
  }, [loadedCloudSave, teacherKeysMatch]);

  // Next-challenge helper — wraps to the first challenge after the last.
  const goToNextChallenge = useCallback(() => {
    if (!currentChallengeId || challenges.length === 0) return;
    const idx = challenges.findIndex(c => c.id === currentChallengeId);
    const nextIdx = (idx + 1) % challenges.length;
    dispatch({ type: 'CH_SELECT', id: challenges[nextIdx].id });
  }, [currentChallengeId, challenges]);
  const hasNextChallenge = challenges.length > 1;

  const handleStudentLogin = useCallback((session) => {
    // Normalise the session shape: always carries sessionKey + (legacy)
    // classCode + challengeFileGuid for ease of debugging.
    const key = sessionKeyFor(loadedCloudSave) || session.sessionKey;
    const normalised = { ...session, sessionKey: key };
    setStudentSession(key, normalised);
    if (sessionKeyFor(loadedCloudSave) === key) {
      setLastLoadedCloudSave(key, loadedCloudSave);
    }
    dispatch({ type: 'STUDENT_LOGIN', ...normalised });
    setShowStudentLogin(false);
  }, [loadedCloudSave]);

  // Keep the loadedCloudSave snapshot in sync whenever a new (or
  // re-saved) cloud-save file is loaded while the student is already
  // logged in for that file. Covers the cached-session-restore path.
  useEffect(() => {
    const key = sessionKeyFor(loadedCloudSave);
    if (!key) return;
    if (studentSession?.sessionKey !== key) return;
    setLastLoadedCloudSave(key, loadedCloudSave);
  }, [loadedCloudSave, studentSession?.sessionKey]);

  // ── Save / Load ────────────────────────────────────────────────────────────

  const handleSave = useCallback((filename, cloudSaveEmbed) => {
    const snap = getSaveState(state);
    // For google-drive cloud-save we need the file's stable GUID baked in.
    let cs = cloudSaveEmbed;
    if (cs && cs.method === 'google-drive') {
      cs = { ...cs, challengeFileGuid: state.challengeFileGuid || undefined };
    }
    downloadJSON(
      buildSaveData({
        world: snap.world,
        fsm:   snap.fsm,
        appMode: snap.appMode,
        blocklyState:   snap.blocks?.blocklyState ?? null,
        pythonCode:     snap.python?.code ?? '',
        pythonFontSize: snap.python?.fontSize ?? 14,
        name: filename,
        challenges:    snap.challenges,
        challengeWork: snap.challengeWork,
        challengeFileGuid: state.challengeFileGuid || undefined,
        cloudSave:     cs ?? null,
      }),
      filename,
    );
    dispatch({ type: 'MARK_SAVED' });
    // Offer the "Share with students" link generator only when the save
    // includes formal challenges — there's no point sharing an empty
    // workspace.
    if ((snap.challenges?.length ?? 0) > 0) {
      setShareModal({ filename: `${filename}.json` });
    }
  }, [state]);

  // Shared parser/dispatcher used by both manual file uploads and the
  // `?challenges=URL` boot loader.
  const loadParsedJson = useCallback((rawJson) => {
    const parsed = parseSaveData(rawJson);
    dispatch({ type: 'LOAD_WORLD_FSM', world: parsed.world, fsm: parsed.fsm });
    if (parsed.appMode) {
      dispatch({ type: 'SET_APP_MODE', mode: parsed.appMode });
    }
    if (parsed.blocklyState) {
      dispatch({ type: 'BLK_SET_STATE', blocklyState: parsed.blocklyState, markDirty: false });
    }
    if (parsed.pythonCode != null) {
      dispatch({ type: 'PYC_SET_CODE', code: parsed.pythonCode, markDirty: false });
    }
    if (parsed.pythonFontSize) {
      dispatch({ type: 'PYC_SET_FONT_SIZE', fontSize: parsed.pythonFontSize });
    }
    if (parsed.challenges || parsed.challengeWork || parsed.cloudSave) {
      dispatch({
        type: 'CH_REPLACE_ALL',
        challenges:    parsed.challenges,
        challengeWork: parsed.challengeWork,
        cloudSave:     parsed.cloudSave,
        challengeFileGuid: parsed.challengeFileGuid,
      });
      const firstChallenge = parsed.challenges?.[0];
      if (firstChallenge?.id) {
        dispatch({ type: 'CH_SELECT', id: firstChallenge.id });
      }
    }
    // If the file embeds saved progress, prompt the student to restore
    // it into this device's localStorage. Deferred to a microtask so
    // the CH_REPLACE_ALL + initial hydrate from existing localStorage
    // have settled first — the prompt then sees a fully-loaded UI
    // behind it.
    if (parsed.userProgress?.bookGuid && parsed.userProgress?.challenges) {
      const fileProgress = parsed.userProgress;
      const fileChallenges = parsed.challenges || [];
      Promise.resolve().then(async () => {
        const ok = await confirmAction({
          title: 'Saved progress detected',
          message: 'This file includes saved progress (your code and pass marks). Restore it to this device? If you skip, the existing progress on this browser (if any) is kept untouched.',
          confirmLabel: 'Restore',
          cancelLabel:  'Skip',
          variant: 'primary',
        });
        if (!ok) return;
        const slot = resolveUserSlot(studentSessionRef.current);
        importBookProgress(fileProgress.bookGuid, slot, fileProgress.challenges);
        const workMap = {};
        for (const ch of fileChallenges) {
          const stored = fileProgress.challenges[ch.guid];
          if (stored?.code) workMap[ch.id] = stored.code;
        }
        dispatch({ type: 'CH_HYDRATE_WORK', workMap, replace: true });
        setProgressTick(t => t + 1);
      });
    }
    setLoadError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmAction]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        loadParsedJson(JSON.parse(ev.target.result));
      } catch (err) {
        setLoadError(err.message);
      }
    };
    reader.readAsText(file);
  }, [loadParsedJson]);

  // ── Deep-link loader: ?challenges=<urlencoded raw URL> on boot ──────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('challenges');
    if (!url) return;
    const target = normaliseChallengesUrl(url);
    if (!target) return;
    (async () => {
      try {
        const r = await fetch(target, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const json = await r.json();
        loadParsedJson(json);
      } catch (err) {
        setLoadError('Could not load ?challenges= file: ' + (err?.message ?? err));
      }
    })();
    // We deliberately leave the query string in the URL so reloading
    // the page reloads the same challenges. The teacher (if it's
    // their own keys + file) sees no extra friction.
  }, [loadParsedJson]);

  // ── Deep-link loader: ?tutorial=<chapter-slug> on boot ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('tutorial');
    if (!slug) return;
    const known = TUTORIAL_CHAPTERS.some(c => c.slug === slug);
    setTutorialSlug(known ? slug : DEFAULT_TUTORIAL_SLUG);
  }, []);

  // Loading an example installs it as a one-challenge "book" so the
  // student gets pass/fail + Show solution semantics for free, using
  // the same code path as loading a teacher-authored challenges file.
  // (Pre-Phase-C, examples loaded only a world + seeded all three
  // mode editors with the reference solutions.)
  const handleExampleSelect = useCallback((id) => {
    // Bundled multi-challenge books (loaded the same way as opening a
    // teacher-shared .json file). The "book:" prefix keeps them
    // distinct from the single-challenge EXAMPLES entries.
    if (id === 'book:intro1') {
      try {
        loadParsedJson(JSON.parse(JSON.stringify(introToProgramming1)));
      } catch (err) {
        setLoadError(err.message);
      }
      return;
    }
    const ex = EXAMPLES.find(e => e.id === id);
    if (!ex) return;
    try {
      // EXAMPLES entries are already full Challenge objects. We deep-clone
      // by JSON round-trip so a future challenge edit doesn't mutate the
      // shared module-level instance.
      const challenge = JSON.parse(JSON.stringify(ex));
      dispatch({
        type: 'CH_REPLACE_ALL',
        challenges: [challenge],
        challengeWork: {},
        challengeFileGuid: '',
        cloudSave: null,
      });
      dispatch({ type: 'CH_SELECT', id: challenge.id });
      setNotesOpen(true);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [loadParsedJson]);

  const handleHSplitDrag = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidthRef.current;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      setLeftWidth(Math.max(300, startWidth + delta));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleEditTransition = useCallback((target) => setEditTarget(target), []);

  // ── Build the run-ready Python (or null on failure) ─────────────────────────
  const generatePython = useCallback(() => {
    try {
      if (appMode === 'blocks') {
        return generateFromState(world, blocks.blocklyState);
      }
      if (appMode === 'python') {
        return buildPythonProgram(world, python.code);
      }
      return null;
    } catch (err) {
      console.error('Failed to generate Python:', err);
      dispatch({
        type: 'RUN_SET_ERROR',
        message: `Failed to generate Python: ${err.message ?? err}`,
      });
      return null;
    }
  }, [appMode, world, blocks.blocklyState, python.code]);

  const panelTitle =
    appMode === 'fsm'    ? 'Finite State Machine' :
    appMode === 'blocks' ? 'Blocks' :
                           'Python';

  return (
    <div className="app">
      {updateAvailable && (
        <UpdateBanner onReload={() => window.location.reload()} />
      )}
      <header className="app-header">
        <div className="app-title">
          <span className="kara-logo">🐞</span>
          <div className="app-title-text">
            <span className="app-name">KaraWeb</span>
            <span className="app-subtitle">
              An independent re-implementation of{' '}
              <a href="https://www.swisseduc.ch/informatik/karatojava/"
                 target="_blank" rel="noreferrer" className="subtitle-link">
                classic Kara
              </a>.
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button className="header-btn" title="Save world & program to file"
            onClick={() => setShowSave(true)} disabled={sim.mode !== 'edit'}>
            💾 Save
          </button>
          <button className="header-btn" title="Load world & program from file"
            onClick={() => fileInputRef.current?.click()} disabled={sim.mode !== 'edit'}>
            📂 Open
          </button>
          <input ref={fileInputRef} type="file" accept=".json"
            style={{ display: 'none' }} onChange={handleFileChange} />

          <select className="examples-select" value=""
            onChange={e => { if (e.target.value) handleExampleSelect(e.target.value); }}
            disabled={sim.mode !== 'edit'} title="Load a built-in example">
            <option value="">⚡ Examples...</option>
            {EXAMPLES.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
            <option disabled>──────── Books ────────</option>
            <option value="book:intro1">📘 Introduction to Programming 1</option>
          </select>

          <div className="panels-menu-wrap" ref={panelsMenuRef}>
            <button className="header-btn" title="Show / hide panels"
              onClick={() => setShowPanelsMenu(v => !v)}>
              ▤ Panels
            </button>
            {showPanelsMenu && (
              <div className="panels-menu">
                <button className={`panels-menu-item ${sensorsOpen ? 'checked' : ''}`}
                  onClick={() => setSensorsOpen(v => !v)}>
                  {sensorsOpen ? '☑' : '☐'} Sensors
                </button>
                <button className={`panels-menu-item ${notesOpen ? 'checked' : ''}`}
                  onClick={() => setNotesOpen(v => !v)}>
                  {notesOpen ? '☑' : '☐'} Notes
                </button>
              </div>
            )}
          </div>

          <ChallengesMenu
            challenges={challenges}
            currentChallengeId={currentChallengeId}
            challengeEditor={challengeEditor}
            scratchpadChallenge={scratchpadChallenge}
            disabled={sim.mode !== 'edit'}
            dispatch={dispatch}
            onRequestExit={requestExitChallenge}
            onRequestEnterEditor={requestEnterEditor}
            gated={!!loadedCloudSave?.publicKeyJwk?.n && !teacherKeysMatch}
            bookProgress={bookProgress}
            hasAnyProgress={hasAnyProgress}
            onResetBookProgress={requestResetBookProgress}
            onSaveBookProgress={handleSaveBookProgress}
          />

          <div className="header-sep" />

          <QueuedResultsChip
            sessionKey={sessionKeyFor(loadedCloudSave)}
            onClick={() => setQueueModalOpen(true)}
          />
          <button className="header-btn" title="Settings"
            onClick={() => setShowSettings(true)}>
            ⚙ Settings
          </button>
          <button className="header-btn" title="Teacher tutorial — how everything fits together"
            onClick={() => setTutorialSlug(DEFAULT_TUTORIAL_SLUG)}>
            📖 Tutorial
          </button>
          <button className="header-btn about-btn" title="About KaraWeb"
            onClick={() => setShowAbout(true)}>
            ℹ About
          </button>
        </div>
      </header>

      {loadError && (
        <div className="load-error-banner">
          ⚠ {loadError}
          <button onClick={() => setLoadError(null)}>✕</button>
        </div>
      )}

      {migrationToast && (
        <div className="load-error-banner" style={{ background: '#ecfdf5', borderBottomColor: '#34d399' }}>
          ℹ {migrationToast}
          <button onClick={() => setMigrationToast(null)}>✕</button>
        </div>
      )}

      {loadedCloudSave?.apiBaseUrl && (
        <CloudSaveBanner
          loadedCloudSave={loadedCloudSave}
          studentSession={studentSession}
          keydetails={keydetails}
          onLoginAgain={() => {
            dispatch({ type: 'STUDENT_LOGOUT' });
            setShowStudentLogin(true);
          }}
          onOpenQueue={() => setQueueModalOpen(true)}
        />
      )}

      {challengeEditor && (
        <ChallengeEditor
          challenges={challenges}
          editingChallengeId={editingChallengeId}
          editorActiveTab={editorActiveTab}
          appMode={appMode}
          classList={classList}
          keydetails={keydetails}
          classes={classes}
          challengeFileGuid={challengeFileGuid}
          cloudSave={cloudSave}
          analyse={analyse}
          loadedCloudSave={loadedCloudSave}
          dispatch={dispatch}
          requestPrivateKey={requestPrivateKey}
        />
      )}

      {activeChallenge && !challengeEditor && (
        <div className={`challenge-banner ${challengeResult ?? ''}`}>
          <span className="challenge-banner-label">
            🎯 <strong>{activeChallenge.name}</strong>
            <span className="challenges-mode-tag">{activeChallenge.mode}</span>
          </span>
          {challengeResult === 'success' && (
            <span className="challenge-banner-status success">✅ Success — well done!</span>
          )}
          {challengeResult === 'fail' && (
            <span className="challenge-banner-status fail">✗ Not quite — try again or reset.</span>
          )}
          {/* In scratchpad mode we hide Reset code and Next challenge —
              they make no sense for a one-off preview of a student's
              submission. The teacher just has "Return to grid". */}
          {!scratchpadChallenge && (
            <>
              <button
                className="header-btn"
                title="Restore the starter code for this challenge"
                onClick={() => dispatch({ type: 'CH_RESET_TO_STARTER' })}
                disabled={sim.mode !== 'edit'}
              >Reset code</button>
              {hasNextChallenge && (
                <button
                  className="header-btn"
                  title="Move on to the next challenge in this book"
                  onClick={goToNextChallenge}
                >Next challenge →</button>
              )}
            </>
          )}
          {/* Scratchpad mode (teacher previewing a student submission)
              shows a dedicated "Return to grid" button that restores
              the Submissions tab in the editor without a backend
              round-trip. Otherwise: only show Exit challenge for
              plain (non-cloud-save) books — secured books keep the
              student locked in. */}
          {scratchpadChallenge ? (
            <button
              className="header-btn highlight"
              title="Return to the submissions grid in the Challenge Editor"
              onClick={() => dispatch({ type: 'CH_EXIT_SCRATCHPAD' })}
            >↩ Return to grid</button>
          ) : !loadedCloudSave?.publicKeyJwk?.n && (
            <button
              className="header-btn"
              title="Exit the challenge and return to your default workspace"
              onClick={requestExitChallenge}
            >Exit challenge</button>
          )}
        </div>
      )}

      <div
        className="main-layout"
        style={
          (challengeEditor && editorActiveTab !== 'challenges')
            ? { display: 'none' }
            : undefined
        }
      >
        <div className="left-panel" style={{ width: leftWidth }}>
          {challengeEditor && editorActiveTab === 'challenges' && editingChallenge && (
            <ChallengeCheckpointBar
              editing={editingChallenge}
              editingCheckpointIdx={editingCheckpointIdx}
              dispatch={dispatch}
            />
          )}
          <div className="left-world-section">
            <div className="panel">
              <div className="panel-title">World</div>
              <WorldEditor world={world} sensors={sensors} simMode={sim.mode}
                worldTool={worldTool} dispatch={dispatch} />
            </div>
            {/* Variables chip sits flush under the world so loop-counter
                values are visible alongside Kara's movement during a run.
                Renders nothing when there's no active run or no primitive
                locals to surface — see VariablesDisplay.jsx. */}
            <VariablesDisplay locals={runner.locals} />
          </div>
          <div className="left-panel-scroll">
            {notesOpen && (
              <ChallengeContextPanel
                introMarkdown={INTRO_NOTES}
                challenge={contextChallenge}
                isEditing={!!editingChallenge}
                onClose={() => setNotesOpen(false)}
                dispatch={dispatch}
              />
            )}
            {sensorsOpen && (
              <SensorDisplay sensors={sensors} onClose={() => setSensorsOpen(false)} />
            )}
          </div>
        </div>

        <div className="hsplit-handle" onMouseDown={handleHSplitDrag} />

        <div className="right-panel panel">
          {/* SimulationControls used to live in the top header bar; moved
              here so the Run / Pause / Reset / Speed controls sit right
              above the code editor where users instinctively look. */}
          <div className="sim-controls-bar">
            <SimulationControls
              sim={sim}
              dispatch={dispatch}
              appMode={appMode}
              pythonRunner={pythonRunner}
              runnerStatus={runner.status}
              generatePython={generatePython}
              awaitingInput={runner.awaitingInput}
            />
          </div>
          {challengeEditor && editorActiveTab === 'challenges' && editingChallenge && challengeResult && (
            <div className={`editor-result-bar ${challengeResult}`}>
              {challengeResult === 'success'
                ? <span>✅ Pass — this {editingTarget} code solves the challenge.</span>
                : <span>✗ Fail — this {editingTarget} code doesn't reach the target.</span>}
              <span className="editor-result-hint">Reset to clear.</span>
            </div>
          )}
          {challengeEditor && editorActiveTab === 'challenges' && editingChallenge && (
            <TeacherSolutionBar
              editing={editingChallenge}
              editingTarget={editingTarget}
              appMode={appMode}
              keydetails={keydetails}
              dispatch={dispatch}
              requestPrivateKey={requestPrivateKey}
            />
          )}
          {challengeEditor && editorActiveTab === 'challenges' && editingChallenge && editingTarget === 'solution' && (
            <SolutionExtrasBar
              challenge={editingChallenge}
              appMode={appMode}
              fsm={fsm}
              blocksState={blocks.blocklyState}
              pythonCode={python.code}
            />
          )}
          {!challengeEditor && activeChallenge && (
            <StudentSolutionBar
              challenge={activeChallenge}
              appMode={appMode}
              showing={!!sim.showingSolution}
              keydetails={keydetails}
              dispatch={dispatch}
              requestPrivateKey={requestPrivateKey}
            />
          )}
          {!challengeEditor && activeChallenge && !sim.showingSolution && (
            <CodeLimitsBar
              challenge={activeChallenge}
              appMode={appMode}
              fsm={fsm}
              blocksState={blocks.blocklyState}
              pythonCode={python.code}
            />
          )}
          <div className="panel-title">{panelTitle}</div>
          {sim.error && (
            <div className="fsm-error-banner">
              <span>⚠ {sim.error}</span>
              <button onClick={() => {
                dispatch({ type: 'CLEAR_SIM_ERROR' });
                dispatch({ type: 'RUN_SET_ERROR', message: null, blockId: null, line: null });
              }}>✕</button>
            </div>
          )}
          {/* `editorKey` forces stateful editors (Blockly, Monaco) to remount
              when the active challenge, editor context, or solution-view
              state changes — otherwise their internal models keep stale
              workspace state across switches. */}
          {(() => {
            const ctxKey = challengeEditor
              ? `edit-${editingChallengeId ?? 'none'}-${editingTarget ?? 'starter'}-${state.editorRefreshTick ?? 0}`
              : `play-${currentChallengeId ?? 'default'}${sim.showingSolution ? '-sol' : ''}-${state.editorRefreshTick ?? 0}`;
            // `readOnly` is set when the student is viewing the
            // reference solution. Teachers in edit mode are never
            // read-only — they're always editing either starter or
            // solution code, just into different slots.
            const readOnly = !challengeEditor && !!sim.showingSolution;
            // Limits only apply when the student is actually playing
            // a challenge (not while editing it, not while viewing a
            // read-only reference solution).
            const limitsActive = !!activeChallenge && !challengeEditor && !sim.showingSolution;
            const blocksCap   = limitsActive ? effectiveBlocksCap(activeChallenge)         : null;
            const tokensCap   = limitsActive ? effectivePythonTokensCap(activeChallenge)   : null;
            const statesCap   = limitsActive ? effectiveFsmStatesCap(activeChallenge)      : null;
            if (appMode === 'fsm') {
              return (
                <FSMEditor key={ctxKey}
                  fsm={fsm} simCurrentStateId={sim.currentStateId}
                  lastTransitionId={sim.lastTransitionId} simMode={sim.mode}
                  dispatch={dispatch} onEditTransition={handleEditTransition}
                  readOnly={readOnly} fsmStatesCap={statesCap} />
              );
            }
            if (appMode === 'blocks') {
              return (
                <BlocksEditor key={ctxKey}
                  blocks={blocks} runner={runner}
                  dispatch={dispatch} pythonRunner={pythonRunner}
                  readOnly={readOnly} blocksCap={blocksCap}
                  disallowedBlocks={contextChallenge?.disallowedBlocks ?? []}
                />
              );
            }
            // While a run is in progress (running or user-paused mid-run),
            // freeze the init header to the snapshotted savedWorld so the
            // displayed `kara = Ladybird(x, y, ...)` matches what the program
            // actually started with. Once the run finishes or is reset, fall
            // back to the live world.
            const runActive = runner.status === 'running' || runner.status === 'paused';
            const initWorld = (runActive && sim.savedWorld) ? sim.savedWorld : world;
            return (
              <PythonEditor key={ctxKey}
                world={world} initWorld={initWorld} python={python} runner={runner}
                dispatch={dispatch} pythonRunner={pythonRunner}
                readOnly={readOnly} pythonTokensCap={tokensCap}
              />
            );
          })()}

          {/* Only show the loading overlay when the user clicked Run while
              the pyodide runtime is still loading. Background pre-warm is silent. */}
          {(appMode === 'blocks' || appMode === 'python')
            && runner.status === 'loading'
            && sim.mode === 'running' && (
            <div className="python-loading-overlay">
              <div className="python-loading-card">
                <div className="python-spinner" />
                <div>Building Python runtime…</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="bottom-panel panel"
        style={
          (challengeEditor && editorActiveTab !== 'challenges')
            ? { display: 'none' }
            : undefined
        }
      >
        <div className="panel-title">
          Execution Log
          {sim.log.length > 0 && (
            <span className="log-count">{sim.log.length} step{sim.log.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <ExecutionLog log={sim.log} />
      </div>

      {editTarget && (
        <TransitionModal fsm={fsm} editTarget={editTarget}
          dispatch={dispatch} onClose={() => setEditTarget(null)}
          fsmTransitionsCap={(activeChallenge && !challengeEditor && !sim.showingSolution)
            ? effectiveFsmTransitionsCap(activeChallenge)
            : null} />
      )}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {tutorialSlug && (
        <TutorialModal
          initialSlug={tutorialSlug}
          onClose={() => setTutorialSlug(null)}
        />
      )}
      {confirmModalEl}
      {showSave  && (
        <SaveDialog
          onSave={handleSave}
          onClose={() => setShowSave(false)}
          keydetails={keydetails}
          cloudSave={cloudSave}
        />
      )}
      {shareModal && (
        <ShareLinkModal
          savedFilename={shareModal.filename}
          onClose={() => setShareModal(null)}
        />
      )}
      {keyCheck && loadedCloudSave?.publicKeyJwk && (
        <TeacherKeyCheckModal
          requiredPublicKeyJwk={loadedCloudSave.publicKeyJwk}
          action={keyCheck.action}
          dispatch={dispatch}
          onSuccess={keyCheck.onSuccess}
          onCancel={() => setKeyCheck(null)}
        />
      )}
      {showStudentLogin && sessionKeyFor(loadedCloudSave) && (
        <StudentLoginModal
          sessionKey={sessionKeyFor(loadedCloudSave)}
          loadedCloudSave={loadedCloudSave}
          knownLogin={getStudentSession(sessionKeyFor(loadedCloudSave))}
          onLogin={handleStudentLogin}
          onCancel={() => setShowStudentLogin(false)}
        />
      )}
      {queueModalOpen && (
        <QueuedSubmissionsModal
          sessionKey={sessionKeyFor(loadedCloudSave)}
          loadedCloudSave={loadedCloudSave}
          onClose={() => setQueueModalOpen(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          appMode={appMode}
          dirtyFsm={dirtyFsm} dirtyBlocks={dirtyBlocks} dirtyPython={dirtyPython}
          dispatch={dispatch}
          pythonRunner={pythonRunner}
          activeChallenge={activeChallenge}
          onClose={() => setShowSettings(false)}
          onShowMainWelcome={() => setShowMainWelcome(true)}
          onShowEditorWelcome={() => setShowWelcome(true)}
        />
      )}
      {pwModal && (
        <KeydetailsPasswordModal
          mode="unlock"
          errorText={pwModal.errorText}
          busy={pwModal.busy}
          onSubmit={onUnlockSubmit}
          onCancel={onUnlockCancel}
        />
      )}
      {showWelcome && (
        <WelcomeSlideshow
          onClose={(dontShow) => {
            if (dontShow) setWelcomeShown(true);
            setShowWelcome(false);
          }}
          onOpenTutorial={() => {
            setShowWelcome(false);
            setTutorialSlug(DEFAULT_TUTORIAL_SLUG);
          }}
        />
      )}
      {showMainWelcome && (
        <MainWelcomeSlideshow
          onClose={(dontShow) => {
            if (dontShow) setMainWelcomeShown(true);
            setShowMainWelcome(false);
          }}
          onOpenTutorial={() => {
            setShowMainWelcome(false);
            setTutorialSlug(DEFAULT_TUTORIAL_SLUG);
          }}
        />
      )}
    </div>
  );
}
