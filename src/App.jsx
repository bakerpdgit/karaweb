import React, { useReducer, useEffect, useState, useCallback, useRef } from 'react';
import { initialState, reducer, getInitialAppMode, getSaveState } from './store.js';
import { buildSaveData, downloadJSON, parseSaveData } from './utils.js';
import { INTRO_NOTES, EXAMPLES } from './examples.js';
import WorldEditor from './components/WorldEditor.jsx';
import FSMEditor from './components/FSMEditor.jsx';
import TransitionModal from './components/TransitionModal.jsx';
import SimulationControls from './components/SimulationControls.jsx';
import SensorDisplay from './components/SensorDisplay.jsx';
import ExecutionLog from './components/ExecutionLog.jsx';
import AboutModal from './components/AboutModal.jsx';
import SaveDialog from './components/SaveDialog.jsx';
import NotesPanel from './components/NotesPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import BlocksEditor from './components/BlocksEditor.jsx';
import PythonEditor from './components/PythonEditor.jsx';
import ChallengesMenu from './components/ChallengesMenu.jsx';
import ChallengeEditor from './components/ChallengeEditor.jsx';
import { usePythonRunner } from './python/usePythonRunner.js';
import { generateFromState, buildPythonProgram } from './python/blocks/pythonGenerator.js';

export default function App() {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => ({ ...initialState, appMode: getInitialAppMode() }),
  );
  const [editTarget, setEditTarget]     = useState(null);
  const [showAbout, setShowAbout]       = useState(false);
  const [showSave, setShowSave]         = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loadError, setLoadError]       = useState(null);
  const fileInputRef = useRef(null);

  const [sensorsOpen, setSensorsOpen]   = useState(true);
  const [notesOpen, setNotesOpen]       = useState(true);
  const [showPanelsMenu, setShowPanelsMenu] = useState(false);
  const panelsMenuRef = useRef(null);

  const [currentNotes, setCurrentNotes] = useState(INTRO_NOTES);

  const [leftWidth, setLeftWidth]       = useState(614);
  const leftWidthRef = useRef(leftWidth);
  useEffect(() => { leftWidthRef.current = leftWidth; }, [leftWidth]);

  const {
    appMode, world, fsm, sensors, sim, worldTool,
    blocks, python, runner,
    dirtyFsm, dirtyBlocks, dirtyPython,
    challenges, currentChallengeId, challengeEditor,
    editingChallengeId, editingWorldView, challengeResult,
    challengeWork,
  } = state;

  const activeChallenge = currentChallengeId
    ? challenges.find(c => c.id === currentChallengeId)
    : null;

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
  useEffect(() => {
    if (!currentChallengeId) return;
    if (challengeResult) return;             // already decided
    const ranFSM = appMode === 'fsm' && sim.mode === 'paused' && sim.savedWorld;
    const ranPY  = (appMode === 'blocks' || appMode === 'python')
                 && (runner.status === 'finished' || runner.status === 'error');
    if (ranFSM || ranPY) {
      dispatch({ type: 'CH_CHECK_RESULT' });
    }
  }, [currentChallengeId, challengeResult, appMode, sim.mode, sim.savedWorld, runner.status]);

  useEffect(() => {
    if (!showPanelsMenu) return;
    const handler = (e) => {
      if (!panelsMenuRef.current?.contains(e.target)) setShowPanelsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanelsMenu]);

  // ── Save / Load ────────────────────────────────────────────────────────────

  const handleSave = useCallback((filename) => {
    const snap = getSaveState(state);
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
      }),
      filename,
    );
    dispatch({ type: 'MARK_SAVED' });
  }, [state]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        const parsed = parseSaveData(raw);
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
        if (parsed.challenges || parsed.challengeWork) {
          dispatch({
            type: 'CH_REPLACE_ALL',
            challenges:    parsed.challenges,
            challengeWork: parsed.challengeWork,
          });
        }
        setLoadError(null);
      } catch (err) {
        setLoadError(err.message);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleExampleSelect = useCallback((id) => {
    if (id === 'intro') {
      setCurrentNotes(INTRO_NOTES);
      setNotesOpen(true);
      return;
    }
    const ex = EXAMPLES.find(e => e.id === id);
    if (!ex) return;
    try {
      const { world: w, fsm: f } = parseSaveData({ karaWebVersion: 1, world: ex.world, fsm: ex.fsm });
      dispatch({ type: 'LOAD_WORLD_FSM', world: w, fsm: f });
      // Also seed the Blocks + Python workspaces with the example's
      // solutions, so flipping modes shows working code for any mode.
      if (ex.blocks)  dispatch({ type: 'BLK_SET_STATE', blocklyState: ex.blocks, markDirty: false });
      if (ex.python)  dispatch({ type: 'PYC_SET_CODE',  code: ex.python,         markDirty: false });
      setCurrentNotes(ex.notes);
      setNotesOpen(true);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

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
            <option value="intro">📖 Introduction</option>
            {EXAMPLES.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
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
            disabled={sim.mode !== 'edit'}
            dispatch={dispatch}
          />

          <div className="header-sep" />
          <SimulationControls
            sim={sim}
            dispatch={dispatch}
            appMode={appMode}
            pythonRunner={pythonRunner}
            runnerStatus={runner.status}
            generatePython={generatePython}
            awaitingInput={runner.awaitingInput}
          />
          <div className="header-sep" />

          <button className="header-btn" title="Settings"
            onClick={() => setShowSettings(true)}>
            ⚙ Settings
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

      {challengeEditor && (
        <ChallengeEditor
          challenges={challenges}
          editingChallengeId={editingChallengeId}
          editingWorldView={editingWorldView}
          dispatch={dispatch}
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
          <button
            className="header-btn"
            title="Restore the starter code for this challenge"
            onClick={() => dispatch({ type: 'CH_RESET_TO_STARTER' })}
            disabled={sim.mode !== 'edit'}
          >Reset code</button>
          <button
            className="header-btn"
            title="Exit the challenge and return to your default workspace"
            onClick={() => dispatch({ type: 'CH_EXIT_PLAY' })}
          >Exit challenge</button>
        </div>
      )}

      <div className="main-layout">
        <div className="left-panel" style={{ width: leftWidth }}>
          <div className="left-world-section">
            <div className="panel">
              <div className="panel-title">World</div>
              <WorldEditor world={world} sensors={sensors} simMode={sim.mode}
                worldTool={worldTool} dispatch={dispatch} />
            </div>
            {sensorsOpen && (
              <SensorDisplay sensors={sensors} onClose={() => setSensorsOpen(false)} />
            )}
          </div>
          {notesOpen && (
            <NotesPanel markdown={currentNotes} onClose={() => setNotesOpen(false)} />
          )}
        </div>

        <div className="hsplit-handle" onMouseDown={handleHSplitDrag} />

        <div className="right-panel panel">
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
              when the active challenge or editor context changes — otherwise
              their internal models keep stale workspace state across switches. */}
          {(() => {
            const editorKey = challengeEditor
              ? `edit-${editingChallengeId ?? 'none'}`
              : `play-${currentChallengeId ?? 'default'}`;
            if (appMode === 'fsm') {
              return (
                <FSMEditor key={editorKey}
                  fsm={fsm} simCurrentStateId={sim.currentStateId}
                  lastTransitionId={sim.lastTransitionId} simMode={sim.mode}
                  dispatch={dispatch} onEditTransition={handleEditTransition} />
              );
            }
            if (appMode === 'blocks') {
              return (
                <BlocksEditor key={editorKey}
                  blocks={blocks} runner={runner}
                  dispatch={dispatch} pythonRunner={pythonRunner}
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
              <PythonEditor key={editorKey}
                world={world} initWorld={initWorld} python={python} runner={runner}
                dispatch={dispatch} pythonRunner={pythonRunner}
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

      <div className="bottom-panel panel">
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
          dispatch={dispatch} onClose={() => setEditTarget(null)} />
      )}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showSave  && <SaveDialog onSave={handleSave} onClose={() => setShowSave(false)} />}
      {showSettings && (
        <SettingsModal
          appMode={appMode}
          dirtyFsm={dirtyFsm} dirtyBlocks={dirtyBlocks} dirtyPython={dirtyPython}
          dispatch={dispatch}
          pythonRunner={pythonRunner}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
