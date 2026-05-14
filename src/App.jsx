import React, { useReducer, useEffect, useState, useCallback } from 'react';
import { initialState, reducer } from './store.js';
import WorldEditor from './components/WorldEditor.jsx';
import FSMEditor from './components/FSMEditor.jsx';
import TransitionModal from './components/TransitionModal.jsx';
import SimulationControls from './components/SimulationControls.jsx';
import SensorDisplay from './components/SensorDisplay.jsx';
import ExecutionLog from './components/ExecutionLog.jsx';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [editTarget, setEditTarget] = useState(null); // modal target

  const { world, fsm, sensors, sim, worldTool } = state;

  // ── Auto-run interval ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sim.mode !== 'running') return;
    const id = setInterval(() => dispatch({ type: 'SIM_STEP' }), sim.speed);
    return () => clearInterval(id);
  }, [sim.mode, sim.speed]);

  const handleEditTransition = useCallback((target) => {
    setEditTarget(target);
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-title">
          <span className="kara-logo">🐞</span>
          <span>Kara — Finite State Machine</span>
        </div>
        <SimulationControls sim={sim} dispatch={dispatch} />
      </header>

      {/* Main layout */}
      <div className="main-layout">
        {/* Left: world + sensors */}
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

        {/* Right: FSM editor */}
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

      {/* Transition edit modal */}
      {editTarget && (
        <TransitionModal
          fsm={fsm}
          editTarget={editTarget}
          dispatch={dispatch}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
