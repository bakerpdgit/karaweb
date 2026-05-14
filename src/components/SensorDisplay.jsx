import React from 'react';

const SENSOR_DEFS = [
  { key: 'treeFront',     label: 'Tree Front',     abbr: 'TF', icon: '🌲↑' },
  { key: 'treeLeft',      label: 'Tree Left',      abbr: 'TL', icon: '🌲←' },
  { key: 'treeRight',     label: 'Tree Right',     abbr: 'TR', icon: '🌲→' },
  { key: 'mushroomFront', label: 'Mushroom Front', abbr: 'MF', icon: '🍄↑' },
  { key: 'onLeaf',        label: 'On Leaf',        abbr: 'OL', icon: '🍃' },
];

export default function SensorDisplay({ sensors }) {
  return (
    <div className="sensor-display">
      <div className="panel-title">Sensors</div>
      <div className="sensor-grid">
        {SENSOR_DEFS.map(({ key, label, abbr, icon }) => {
          const val = sensors?.[key];
          return (
            <div key={key} className={`sensor-chip ${val ? 'on' : 'off'}`} title={label}>
              <span className="sensor-icon">{icon}</span>
              <span className="sensor-abbr">{abbr}</span>
              <span className={`sensor-val ${val ? 'true' : 'false'}`}>
                {val ? 'T' : 'F'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
