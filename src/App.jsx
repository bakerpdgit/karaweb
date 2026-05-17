import React, { useReducer, useEffect, useState, useCallback, useRef } from 'react';
import { initialState, reducer } from './store.js';
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

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [editTarget, setEditTarget]     = useState(null);
  const [showAbout, setShowAbout]       = useState(false);
  const [showSave, setShowSave]         = useState(false);
  const [loadError, setLoadError]       = useState(null);
  const fileInputRef = useRef(null);

  // ── Panel visibility ────────────────────────────────────────────────────────
  const [sensorsOpen, setSensorsOpen]   = useState(true);
  const [notesOpen, setNotesOpen]       = useState(true);
  const [showPanelsMenu, setShowPanelsMenu] = useState(false);
  const panelsMenuRef = useRef(null);

  // ── Notes panel ─────────────────────────────────────────────────────────────
  const [currentNotes, setCurrentNotes] = useState(INTRO_NOTES);

  // ── Horizontal splitter (left / right panels) ────────────────────────────────
  const [leftWidth, setLeftWidth]       = useState(614);
  const leftWidthRef = useRef(leftWidth);
  useEffect(() => { leftWidthRef.current = leftWidth; }, [leftWidth]);

  const { world, fsm, sensors, sim, worldTool } = state;

  // ── Auto-run interval ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sim.mode !== 'running') return;
    const id = setInterval(() => dispatch({ type: 'SIM_STEP' }), sim.speed);
    return () => clearInterval(id);
  }, [sim.mode, sim.speed]);

  // ── Close panels-menu on outside click ────────────────────────────────────
  useEffect(() => {
    if (!showPanelsMenu) return;
    const handler = (e) => {
      if (!panelsMenuRef.current?.contains(e.target)) setShowPanelsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanelsMenu]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback((filename) => {
    downloadJSON(buildSaveData(world, fsm, filename), filename);
  }, [world, fsm]);

  // ── Load from file ─────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        const { world: w, fsm: f } = parseSaveData(raw);
        dispatch({ type: 'LOAD_WORLD_FSM', world: w, fsm: f });
        setLoadError(null);
      } catch (err) {
        setLoadError(err.message);
      }
    };
    reader.readAsText(file);
  }, []);

  // ── Load example ───────────────────────────────────────────────────────────
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
      setCurrentNotes(ex.notes);
      setNotesOpen(true);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  // ── Horizontal panel resize drag ───────────────────────────────────────────
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

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-title">
          <span className="kara-logo">🐞</span>
          <div className="app-title-text">
            <span className="app-name">KaraWeb</span>
            <span className="app-subtitle">
              An independent re-implementation of{' '}
              <a
                href="https://www.swisseduc.ch/informatik/karatojava/"
                target="_blank"
                rel="noreferrer"
                className="subtitle-link"
              >
                classic Kara
              </a>.
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button className="header-btn" title="Save world & FSM to file"
            onClick={() => setShowSave(true)} disabled={sim.mode !== 'edit'}>
            💾 Save
          </button>
          <button className="header-btn" title="Load world & FSM from file"
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

          {/* Panels visibility toggle */}
          <div className="panels-menu-wrap" ref={panelsMenuRef}>
            <button className="header-btn" title="Show / hide panels"
              onClick={() => setShowPanelsMenu(v => !v)}>
              ▤ Panels
            </button>
            {showPanelsMenu && (
              <div className="panels-menu">
                <button
                  className={`panels-menu-item ${sensorsOpen ? 'checked' : ''}`}
                  onClick={() => setSensorsOpen(v => !v)}
                >
                  {sensorsOpen ? '☑' : '☐'} Sensors
                </button>
                <button
                  className={`panels-menu-item ${notesOpen ? 'checked' : ''}`}
                  onClick={() => setNotesOpen(v => !v)}
                >
                  {notesOpen ? '☑' : '☐'} Notes
                </button>
              </div>
            )}
          </div>

          <div className="header-sep" />
          <SimulationControls sim={sim} dispatch={dispatch} />
          <div className="header-sep" />

          <button className="header-btn about-btn" title="About KaraWeb"
            onClick={() => setShowAbout(true)}>
            ℹ About
          </button>
        </div>
      </header>

      {/* Load error banner */}
      {loadError && (
        <div className="load-error-banner">
          ⚠ {loadError}
          <button onClick={() => setLoadError(null)}>✕</button>
        </div>
      )}

      {/* Main layout */}
      <div className="main-layout">
        {/* Left panel */}
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

        {/* Horizontal resize handle */}
        <div className="hsplit-handle" onMouseDown={handleHSplitDrag} />

        {/* Right panel */}
        <div className="right-panel panel">
          <div className="panel-title">Finite State Machine</div>
          {sim.error && (
            <div className="fsm-error-banner">
              <span>⚠ {sim.error}</span>
              <button onClick={() => dispatch({ type: 'CLEAR_SIM_ERROR' })}>✕</button>
            </div>
          )}
          <FSMEditor fsm={fsm} simCurrentStateId={sim.currentStateId}
            lastTransitionId={sim.lastTransitionId} simMode={sim.mode}
            dispatch={dispatch} onEditTransition={handleEditTransition} />
        </div>
      </div>

      {/* Bottom: execution log */}
      <div className="bottom-panel panel">
        <div className="panel-title">
          Execution Log
          {sim.log.length > 0 && (
            <span className="log-count">{sim.log.length} step{sim.log.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <ExecutionLog log={sim.log} />
      </div>

      {/* Modals */}
      {editTarget && (
        <TransitionModal fsm={fsm} editTarget={editTarget}
          dispatch={dispatch} onClose={() => setEditTarget(null)} />
      )}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showSave  && <SaveDialog onSave={handleSave} onClose={() => setShowSave(false)} />}
    </div>
  );
}
