import React from 'react';
import { formatGuard } from '../utils.js';

const SENSOR_ABBR = ['TF', 'TL', 'TR', 'MF', 'OL'];
const SENSOR_KEYS = ['treeFront', 'treeLeft', 'treeRight', 'mushroomFront', 'onLeaf'];

export default function ExecutionLog({ log }) {
  if (!log || log.length === 0) {
    return (
      <div className="exec-log empty">
        <em>Execution log will appear here when you run the simulation.</em>
      </div>
    );
  }

  return (
    <div className="exec-log">
      <div className="exec-log-header">
        <span>#</span>
        <span>From → To</span>
        <span>TF TL TR MF OL</span>
        <span>Action</span>
      </div>
      {log.map(entry => (
        <div key={entry.step} className="exec-row">
          <span className="exec-step">{entry.step}</span>
          <span className="exec-states">
            {entry.fromLabel} → {entry.toLabel}
          </span>
          <span className="exec-sensors">
            {SENSOR_KEYS.map((k, i) => (
              <span key={k} className={`sensor-bit ${entry.sensors?.[k] ? 'on' : 'off'}`}>
                {entry.sensors?.[k] ? '1' : '0'}
              </span>
            ))}
          </span>
          <span className="exec-action">{entry.action}</span>
        </div>
      ))}
    </div>
  );
}
