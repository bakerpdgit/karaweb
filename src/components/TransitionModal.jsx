import React, { useState } from 'react';
import { makeDefaultGuard } from '../utils.js';
import { useConfirmModal } from './ConfirmModal.jsx';

const SENSORS = [
  { key: 'treeFront',     label: 'Tree Front',      desc: 'Tree directly ahead of Kara' },
  { key: 'treeLeft',      label: 'Tree Left',       desc: 'Tree to Kara\'s left' },
  { key: 'treeRight',     label: 'Tree Right',      desc: 'Tree to Kara\'s right' },
  { key: 'mushroomFront', label: 'Mushroom Front',  desc: 'Mushroom directly ahead of Kara' },
  { key: 'onLeaf',        label: 'On Leaf',         desc: 'Kara is standing on a leaf' },
];

const ACTIONS = [
  { value: 'none',       label: '— (no action)',   icon: '—' },
  { value: 'move',       label: 'Move forward',    icon: '↑' },
  { value: 'turnLeft',   label: 'Turn left (↺)',   icon: '↺' },
  { value: 'turnRight',  label: 'Turn right (↻)',  icon: '↻' },
  { value: 'putLeaf',    label: 'Put leaf',        icon: '+🍃' },
  { value: 'removeLeaf', label: 'Remove leaf',     icon: '−🍃' },
];

// Three-way toggle: null (don't care) → true → false → null
function GuardToggle({ value, onChange }) {
  const states = [
    { val: null,  label: '?',   cls: 'dc',    title: "Don't care" },
    { val: true,  label: '✓',   cls: 'yes',   title: 'Must be TRUE' },
    { val: false, label: '✗',   cls: 'no',    title: 'Must be FALSE' },
  ];
  const cur = states.find(s => s.val === value) ?? states[0];
  const next = states[(states.indexOf(cur) + 1) % states.length];

  return (
    <button
      className={`guard-toggle ${cur.cls}`}
      onClick={() => onChange(next.val)}
      title={cur.title}
    >
      {cur.label}
    </button>
  );
}

export default function TransitionModal({ fsm, editTarget, dispatch, onClose, fsmTransitionsCap = null }) {
  // editTarget: { mode: 'new', fromId, toId } | { mode: 'edit', transitionId }
  const isNew = editTarget.mode === 'new';
  const existing = isNew ? null : fsm.transitions.find(t => t.id === editTarget.transitionId);

  const fromState = fsm.states.find(s => s.id === (isNew ? editTarget.fromId : existing?.fromId));
  const toState   = fsm.states.find(s => s.id === (isNew ? editTarget.toId   : existing?.toId));

  const [guard, setGuard]   = useState(existing?.guard   ?? makeDefaultGuard());
  const [action, setAction] = useState(existing?.action  ?? 'none');
  const { alert: showAlert, modal: alertModal } = useConfirmModal();

  const updateGuard = (key, val) => setGuard(g => ({ ...g, [key]: val }));

  const handleSave = async () => {
    if (isNew) {
      // Block the add if the teacher's transitions cap is hit. Edits
      // to existing transitions are always allowed (no count change).
      if (fsmTransitionsCap != null && fsm.transitions.length >= fsmTransitionsCap) {
        await showAlert({
          message: `You've reached the ${fsmTransitionsCap}-transition limit for this challenge. Delete a transition before adding another.`,
        });
        onClose();
        return;
      }
      dispatch({
        type: 'ADD_TRANSITION',
        fromId: editTarget.fromId,
        toId:   editTarget.toId,
        guard,
        action,
      });
    } else {
      dispatch({
        type: 'UPDATE_TRANSITION',
        id: existing.id,
        patch: { guard, action },
      });
    }
    onClose();
  };

  // How many sensor combinations match this guard (for info)
  const matchCount = (() => {
    const dcs = Object.values(guard).filter(v => v === null).length;
    return Math.pow(2, dcs);
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal transition-modal" onClick={e => e.stopPropagation()}>
        <h3>{isNew ? 'Add Transition' : 'Edit Transition'}</h3>

        <div className="transition-route">
          <span className="state-chip">{fromState?.label ?? '?'}</span>
          <span className="route-arrow">→</span>
          <span className="state-chip">{toState?.label ?? '?'}</span>
        </div>

        {/* Guard conditions */}
        <div className="section-title">Guard (sensor conditions):</div>
        <div className="guard-table">
          <div className="guard-header">
            <span>Sensor</span>
            <span>Condition</span>
          </div>
          {SENSORS.map(({ key, label, desc }) => (
            <div key={key} className="guard-row">
              <label title={desc}>{label}</label>
              <GuardToggle value={guard[key]} onChange={val => updateGuard(key, val)} />
              <span className="guard-current-val">
                {guard[key] === null ? 'any' : guard[key] ? 'true' : 'false'}
              </span>
            </div>
          ))}
        </div>
        <div className="guard-hint">
          This guard matches <strong>{matchCount}</strong> of 32 possible sensor combination{matchCount !== 1 ? 's' : ''}.
          Transitions are checked in order; first match fires.
        </div>

        {/* Action */}
        <div className="section-title">Action:</div>
        <div className="action-grid">
          {ACTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              className={`action-btn ${action === value ? 'selected' : ''}`}
              onClick={() => setAction(value)}
            >
              <span className="action-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleSave}>
            {isNew ? 'Add' : 'Save'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
      {alertModal}
    </div>
  );
}
