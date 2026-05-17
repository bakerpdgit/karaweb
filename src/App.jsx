import React, { useReducer, useEffect, useState, useCallback, useRef } from 'react';
import { initialState, reducer } from './store.js';
import { buildSaveData, downloadJSON, parseSaveData } from './utils.js';
import WorldEditor from './components/WorldEditor.jsx';
import FSMEditor from './components/FSMEditor.jsx';
import TransitionModal from './components/TransitionModal.jsx';
import SimulationControls from './components/SimulationControls.jsx';
import SensorDisplay from './components/SensorDisplay.jsx';
import ExecutionLog from './components/ExecutionLog.jsx';
import AboutModal from './components/AboutModal.jsx';
import SaveDialog from './components/SaveDialog.jsx';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [editTarget, setEditTarget]   = useState(null); // transition modal
  const [showAbout, setShowAbout]     = useState(false);
  const [showSave, setShowSave]       = useState(false);
  const [loadError, setLoadError]     = useState(null);
  const fileInputRef = useRef(null);

  const { world, fsm, sensors, sim, worldTool } = state;

  // ── Auto-run interval ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sim.mode !== 'running') return;
    const id = setInterval(() => dispatch({ type: 'SIM_STEP' }), sim.speed);
    return () => clearInterval(id);
  }, [sim.mode, sim.speed]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback((filename) => {
    const data = buildSaveData(world, fsm, filename);
    downloadJSON(data, filename);
  }, [world, fsm]);

  // ── Load ───────────────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';           // reset so same file can be reloaded
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

  const handleEditTransition = useCallback((target) => {
    setEditTarget(target);
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-title">
          <span className="kara-logo">🐞</span>
          <div className="app-title-text">
            <span className="app-name">KaraWeb</span>
            <span className="app-subtitle">
              An independent web-based re-implementation of the{' '}
              <a
                href="https://www.swisseduc.ch/informatik/karatojava/"
                target="_blank"
                rel="noreferrer"
                className="subtitle-link"
              >
                classic computer science tool
              </a>.
            </span>
          </div>
        </div>

        <div className="header-actions">
          {/* Save / Load */}
          <button
            className="header-btn"
            title="Save world & FSM to file"
            onClick={() => setShowSave(true)}
            disabled={sim.mode !== 'edit'}
          >
            💾 Save
          </button>
          <button
            className="header-btn"
            title="Load world & FSM from file"
            onClick={() => fileInputRef.current?.click()}
            disabled={sim.mode !== 'edit'}
          >
            📂 Open
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div className="header-sep" />
          <SimulationControls sim={sim} dispatch={dispatch} />
          <div className="header-sep" />

          <button
            className="header-btn about-btn"
            title="About KaraWeb"
            onClick={() => setShowAbout(true)}
          >
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
        <div className="left-panel">
          <div className="panel">
            <div className="panel-title">World</div>
            <WorldEditor
              world={world}
              sensors={sensors}
              simMode={sim.mode}
              worldTool={worldTool}
              dispatch={dispatch}
            />
          </div>
          <SensorDisplay sensors={sensors} />
        </div>

        <div className="right-panel panel">
          <div className="panel-title">Finite State Machine</div>
          <FSMEditor
            fsm={fsm}
            simCurrentStateId={sim.currentStateId}
            lastTransitionId={sim.lastTransitionId}
            simMode={sim.mode}
            dispatch={dispatch}
            onEditTransition={handleEditTransition}
          />
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
        <TransitionModal
          fsm={fsm}
          editTarget={editTarget}
          dispatch={dispatch}
          onClose={() => setEditTarget(null)}
        />
      )}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showSave  && <SaveDialog onSave={handleSave} onClose={() => setShowSave(false)} />}
    </div>
  );
}
