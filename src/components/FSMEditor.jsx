import React, { useState, useRef, useCallback, useEffect } from 'react';
import { transitionPath, formatGuard, formatAction, STATE_R } from '../utils.js';

// ── Arrow marker defs ────────────────────────────────────────────────────────

function Defs() {
  return (
    <defs>
      {[
        { id: 'arr',        color: '#64748b' },
        { id: 'arr-active', color: '#16a34a' },
        { id: 'arr-last',   color: '#d97706' },
        { id: 'arr-sel',    color: '#2563eb' },
        { id: 'arr-draw',   color: '#94a3b8' },
      ].map(({ id, color }) => (
        <marker key={id} id={id} markerWidth="9" markerHeight="6"
          refX="8" refY="3" orient="auto">
          <polygon points="0 0, 9 3, 0 6" fill={color} />
        </marker>
      ))}
    </defs>
  );
}

// ── Compute curve offset for a transition group ──────────────────────────────
// Returns offset per (fromId-toId) pair accounting for reverse pairs.
function buildCurveOffsets(transitions, states) {
  const stateMap = Object.fromEntries(states.map(s => [s.id, s]));
  // Group by unordered pair key
  const pairCount = {};
  for (const t of transitions) {
    const fwd = `${t.fromId}→${t.toId}`;
    const rev = `${t.toId}→${t.fromId}`;
    if (!pairCount[fwd]) pairCount[fwd] = 0;
    pairCount[fwd]++;
    if (!(rev in pairCount)) pairCount[rev] = 0; // ensure rev key exists
  }

  // For each directed pair, decide offset
  const offsets = {};
  for (const t of transitions) {
    const fwd = `${t.fromId}→${t.toId}`;
    const rev = `${t.toId}→${t.fromId}`;
    // If reverse pair has transitions, curve both
    offsets[fwd] = pairCount[rev] > 0 ? 35 : 0;
  }
  return offsets;
}

// ── Group transitions by (fromId, toId) so we share one arrow path ───────────
function groupTransitions(transitions) {
  const groups = {};
  for (const t of transitions) {
    const key = `${t.fromId}→${t.toId}`;
    if (!groups[key]) groups[key] = { fromId: t.fromId, toId: t.toId, items: [] };
    groups[key].items.push(t);
  }
  return Object.values(groups);
}

// ── Single state node ────────────────────────────────────────────────────────

function StateNode({
  state, isStart, isCurrent, isSelected, isDrawingSource, simMode,
  onMouseDown, onClick, onDoubleClick,
}) {
  let strokeColor = '#64748b';
  let strokeWidth = 2;
  let fillColor   = '#f8fafc';

  if (isCurrent)      { strokeColor = '#16a34a'; strokeWidth = 3; fillColor = '#dcfce7'; }
  else if (isSelected){ strokeColor = '#2563eb'; strokeWidth = 3; fillColor = '#eff6ff'; }
  if (isDrawingSource){ strokeColor = '#d97706'; strokeWidth = 3; }

  return (
    <g
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Start-state incoming arrow */}
      {isStart && (
        <line
          x1={state.x - STATE_R - 30} y1={state.y}
          x2={state.x - STATE_R - 2}  y2={state.y}
          stroke="#64748b" strokeWidth="2"
          markerEnd="url(#arr)"
        />
      )}
      {/* Outer ring for current state */}
      {isCurrent && (
        <circle cx={state.x} cy={state.y} r={STATE_R + 6}
          fill="none" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {/* Main circle */}
      <circle cx={state.x} cy={state.y} r={STATE_R}
        fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
      {/* Label */}
      <text x={state.x} y={state.y + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="13" fontWeight="600" fill={strokeColor}
        style={{ pointerEvents: 'none' }}
      >
        {state.label}
      </text>
    </g>
  );
}

// ── Transition arrow group (one arrow, stacked labels) ───────────────────────

function TransitionGroup({
  fromState, toState, transitions, curveOffset,
  selectedId, lastTransitionId, simMode, onClickTransition,
}) {
  const { d, lx, ly } = transitionPath(fromState, toState, curveOffset);
  const isSelf = fromState.id === toState.id;

  // Determine arrow color
  const ids = transitions.map(t => t.id);
  const isLast = ids.includes(lastTransitionId);
  const isSel  = ids.includes(selectedId);

  let stroke     = '#64748b';
  let markerEnd  = 'url(#arr)';
  let strokeW    = 1.8;
  if (isLast)     { stroke = '#d97706'; markerEnd = 'url(#arr-last)'; strokeW = 2.5; }
  else if (isSel) { stroke = '#2563eb'; markerEnd = 'url(#arr-sel)';  strokeW = 2.5; }

  // Invisible wider path for easier click
  const hitD = d;

  return (
    <g>
      {/* Visible path */}
      <path d={d} stroke={stroke} strokeWidth={strokeW} fill="none"
        markerEnd={markerEnd} />
      {/* Hit area */}
      <path d={hitD} stroke="transparent" strokeWidth="14" fill="none"
        style={{ cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); onClickTransition(transitions[0].id); }}
      />
      {/* Labels — stacked */}
      {transitions.map((t, i) => {
        const isThisSel  = t.id === selectedId;
        const isThisLast = t.id === lastTransitionId;
        const labelColor = isThisLast ? '#92400e' : isThisSel ? '#1d4ed8' : '#334155';
        const bg         = isThisSel || isThisLast ? (isThisLast ? '#fef3c7' : '#eff6ff') : '#ffffffcc';
        const lineH = 15;
        const totalH = transitions.length * lineH;
        const startY = ly - totalH / 2 + i * lineH + lineH / 2;

        const guardStr  = formatGuard(t.guard);
        const actionStr = formatAction(t.action);
        const text = `${guardStr} / ${actionStr}`;

        return (
          <g key={t.id}
            style={{ cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onClickTransition(t.id); }}
          >
            <rect
              x={lx - 4 - (text.length * 3.5)}
              y={startY - 9}
              width={(text.length * 7) + 8}
              height={14}
              rx="3" fill={bg} stroke={isThisSel ? '#2563eb' : isThisLast ? '#d97706' : '#cbd5e1'}
              strokeWidth="1"
            />
            <text
              x={lx} y={startY}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontFamily="monospace" fill={labelColor}
              style={{ pointerEvents: 'none' }}
            >
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Main FSMEditor ────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'select',        icon: '↖', label: 'Select / Move' },
  { id: 'addState',      icon: '⊕', label: 'Add State (click canvas)' },
  { id: 'addTransition', icon: '→', label: 'Add Transition (click two states)' },
  { id: 'delete',        icon: '✕', label: 'Delete (click state or transition)' },
];

export default function FSMEditor({
  fsm, simCurrentStateId, lastTransitionId, simMode, dispatch, onEditTransition,
}) {
  const svgRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);   // 'state-X' | 'trans-X' | null
  const [drawingFrom, setDrawingFrom] = useState(null); // stateId when drawing arrow
  const [mousePos, setMousePos] = useState({ x: 200, y: 200 });
  const [dragging, setDragging] = useState(null);        // { stateId, ox, oy }
  const [renaming, setRenaming] = useState(null);        // { stateId, label }

  // Reset tool to select when simulation starts
  useEffect(() => {
    if (simMode !== 'edit') {
      setTool('select');
      setDrawingFrom(null);
      setSelectedId(null);
    }
  }, [simMode]);

  const getSVGPos = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ── SVG mouse handlers ───────────────────────────────────────────────────

  const handleSVGMouseMove = useCallback((e) => {
    const pos = getSVGPos(e);
    setMousePos(pos);

    if (dragging) {
      dispatch({
        type: 'UPDATE_STATE',
        id: dragging.stateId,
        patch: { x: pos.x - dragging.ox, y: pos.y - dragging.oy },
      });
    }
  }, [dragging, getSVGPos, dispatch]);

  const handleSVGMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleSVGClick = useCallback((e) => {
    if (e.target !== svgRef.current && !e.target.closest?.('.svg-bg')) return;
    // Click on background
    if (tool === 'addState' && simMode === 'edit') {
      const pos = getSVGPos(e);
      dispatch({ type: 'ADD_STATE', x: pos.x, y: pos.y });
    }
    setSelectedId(null);
    setDrawingFrom(null);
  }, [tool, simMode, getSVGPos, dispatch]);

  // ── State node handlers ──────────────────────────────────────────────────

  const handleStateMouseDown = useCallback((e, stateId) => {
    e.stopPropagation();
    if (tool === 'select' && simMode === 'edit') {
      const pos = getSVGPos(e);
      const state = fsm.states.find(s => s.id === stateId);
      if (state) {
        setDragging({ stateId, ox: pos.x - state.x, oy: pos.y - state.y });
      }
    }
  }, [tool, simMode, getSVGPos, fsm.states]);

  const handleStateClick = useCallback((e, stateId) => {
    e.stopPropagation();

    if (simMode !== 'edit') {
      setSelectedId(`state-${stateId}`);
      return;
    }

    if (tool === 'delete') {
      dispatch({ type: 'DELETE_STATE', id: stateId });
      if (selectedId === `state-${stateId}`) setSelectedId(null);
      return;
    }

    if (tool === 'addTransition') {
      if (!drawingFrom) {
        setDrawingFrom(stateId);
      } else {
        // Complete transition — open edit modal
        onEditTransition({ mode: 'new', fromId: drawingFrom, toId: stateId });
        setDrawingFrom(null);
      }
      return;
    }

    // select tool
    setSelectedId(`state-${stateId}`);
    setDrawingFrom(null);
  }, [tool, simMode, drawingFrom, selectedId, dispatch, onEditTransition]);

  const handleStateDoubleClick = useCallback((e, state) => {
    e.stopPropagation();
    if (simMode !== 'edit') return;
    setRenaming({ stateId: state.id, label: state.label });
  }, [simMode]);

  const handleTransitionClick = useCallback((transId) => {
    if (tool === 'delete' && simMode === 'edit') {
      dispatch({ type: 'DELETE_TRANSITION', id: transId });
      if (selectedId === `trans-${transId}`) setSelectedId(null);
      return;
    }
    setSelectedId(`trans-${transId}`);
  }, [tool, simMode, selectedId, dispatch]);

  // ── Selected-state actions ───────────────────────────────────────────────

  const selectedStateId = selectedId?.startsWith('state-') ? selectedId.slice(6) : null;
  const selectedTransId = selectedId?.startsWith('trans-') ? selectedId.slice(6) : null;
  const selectedState   = fsm.states.find(s => s.id === selectedStateId);
  const selectedTrans   = fsm.transitions.find(t => t.id === selectedTransId);

  // ── Curve offsets ────────────────────────────────────────────────────────

  const stateMap    = Object.fromEntries(fsm.states.map(s => [s.id, s]));
  const offsets     = buildCurveOffsets(fsm.transitions, fsm.states);
  const groups      = groupTransitions(fsm.transitions);

  // ── Rename dialog ────────────────────────────────────────────────────────

  if (renaming) {
    return (
      <div className="fsm-editor">
        <div className="modal-overlay">
          <div className="modal">
            <h3>Rename State</h3>
            <input
              autoFocus
              className="rename-input"
              value={renaming.label}
              onChange={e => setRenaming(r => ({ ...r, label: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  dispatch({ type: 'UPDATE_STATE', id: renaming.stateId, patch: { label: renaming.label } });
                  setRenaming(null);
                }
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
            <div className="modal-actions">
              <button onClick={() => {
                dispatch({ type: 'UPDATE_STATE', id: renaming.stateId, patch: { label: renaming.label } });
                setRenaming(null);
              }}>OK</button>
              <button onClick={() => setRenaming(null)}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fsm-editor">
      {/* Toolbar */}
      <div className="fsm-toolbar">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => { setTool(t.id); setDrawingFrom(null); }}
            title={t.label}
            disabled={simMode !== 'edit' && t.id !== 'select'}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div className="toolbar-sep" />
        {/* Context-sensitive actions for selection */}
        {selectedState && simMode === 'edit' && (
          <>
            <button className="tool-btn"
              onClick={() => dispatch({ type: 'SET_START_STATE', id: selectedState.id })}
              title="Mark as start state"
            >
              ▶ Set Start
            </button>
            <button className="tool-btn danger"
              onClick={() => { dispatch({ type: 'DELETE_STATE', id: selectedState.id }); setSelectedId(null); }}
            >
              🗑 Delete State
            </button>
          </>
        )}
        {selectedTrans && simMode === 'edit' && (
          <>
            <button className="tool-btn"
              onClick={() => onEditTransition({ mode: 'edit', transitionId: selectedTrans.id })}
            >
              ✏ Edit Transition
            </button>
            <button className="tool-btn danger"
              onClick={() => { dispatch({ type: 'DELETE_TRANSITION', id: selectedTrans.id }); setSelectedId(null); }}
            >
              🗑 Delete Transition
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      {simMode === 'edit' && (
        <div className="fsm-hint">
          {tool === 'select'        && 'Drag states to rearrange. Click to select. Double-click state to rename.'}
          {tool === 'addState'      && 'Click on the canvas to add a new state.'}
          {tool === 'addTransition' && (drawingFrom
            ? `Now click the target state (drawing from "${fsm.states.find(s=>s.id===drawingFrom)?.label}")…`
            : 'Click the source state first.')}
          {tool === 'delete'        && 'Click a state or transition arrow to delete it.'}
        </div>
      )}

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        className="fsm-canvas"
        onClick={handleSVGClick}
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
      >
        {/* invisible background for click detection */}
        <rect className="svg-bg" x="0" y="0" width="100%" height="100%" fill="transparent" />

        <Defs />

        {/* Transition arrows */}
        {groups.map(g => {
          const from = stateMap[g.fromId];
          const to   = stateMap[g.toId];
          if (!from || !to) return null;
          const key = `${g.fromId}→${g.toId}`;
          const offset = offsets[key] ?? 0;
          return (
            <TransitionGroup
              key={key}
              fromState={from} toState={to}
              transitions={g.items}
              curveOffset={offset}
              selectedId={selectedTransId}
              lastTransitionId={lastTransitionId}
              simMode={simMode}
              onClickTransition={handleTransitionClick}
            />
          );
        })}

        {/* Drawing-in-progress arrow */}
        {drawingFrom && stateMap[drawingFrom] && (
          <line
            x1={stateMap[drawingFrom].x} y1={stateMap[drawingFrom].y}
            x2={mousePos.x} y2={mousePos.y}
            stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4"
            markerEnd="url(#arr-draw)"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* State nodes */}
        {fsm.states.map(state => (
          <StateNode
            key={state.id}
            state={state}
            isStart={state.id === fsm.startStateId}
            isCurrent={state.id === simCurrentStateId}
            isSelected={selectedId === `state-${state.id}`}
            isDrawingSource={drawingFrom === state.id}
            simMode={simMode}
            onMouseDown={e => handleStateMouseDown(e, state.id)}
            onClick={e => handleStateClick(e, state.id)}
            onDoubleClick={e => handleStateDoubleClick(e, state)}
          />
        ))}
      </svg>

      {/* Status */}
      {simMode !== 'edit' && simCurrentStateId && (
        <div className="fsm-sim-status">
          Current state: <strong>{fsm.states.find(s => s.id === simCurrentStateId)?.label}</strong>
        </div>
      )}
    </div>
  );
}
