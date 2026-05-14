import React, { useCallback, useState } from 'react';

const CELL = 38;

// ── Sprite components ────────────────────────────────────────────────────────

function KaraSprite({ direction }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[direction] ?? 0;
  return (
    <svg width={CELL} height={CELL} viewBox="0 0 38 38" style={{ display: 'block' }}>
      <g transform={`rotate(${rot},19,19)`}>
        {/* body */}
        <ellipse cx="19" cy="22" rx="11" ry="13" fill="#e53e3e" />
        {/* wing line */}
        <line x1="19" y1="9" x2="19" y2="35" stroke="#7f1d1d" strokeWidth="1.5" />
        {/* spots */}
        <circle cx="13" cy="20" r="2.8" fill="#7f1d1d" />
        <circle cx="25" cy="20" r="2.8" fill="#7f1d1d" />
        <circle cx="14" cy="29" r="2.2" fill="#7f1d1d" />
        <circle cx="24" cy="29" r="2.2" fill="#7f1d1d" />
        {/* head */}
        <circle cx="19" cy="9" r="7" fill="#1a202c" />
        {/* antennae */}
        <line x1="15" y1="4" x2="11" y2="0" stroke="#1a202c" strokeWidth="1.2" />
        <line x1="23" y1="4" x2="27" y2="0" stroke="#1a202c" strokeWidth="1.2" />
        <circle cx="11" cy="0" r="1.2" fill="#1a202c" />
        <circle cx="27" cy="0" r="1.2" fill="#1a202c" />
        {/* direction arrow on head */}
        <polygon points="19,2 16,7 22,7" fill="white" opacity="0.75" />
      </g>
    </svg>
  );
}

function TreeSprite() {
  return (
    <svg width={CELL} height={CELL} viewBox="0 0 38 38" style={{ display: 'block' }}>
      <rect x="15" y="26" width="8" height="12" rx="1" fill="#92400e" />
      <polygon points="19,2 4,20 34,20" fill="#166534" />
      <polygon points="19,8 6,23 32,23" fill="#14532d" />
    </svg>
  );
}

function MushroomSprite() {
  return (
    <svg width={CELL} height={CELL} viewBox="0 0 38 38" style={{ display: 'block' }}>
      <rect x="14" y="22" width="10" height="14" rx="2" fill="#d4a373" />
      <ellipse cx="19" cy="20" rx="15" ry="11" fill="#dc2626" />
      <circle cx="12" cy="17" r="3" fill="white" opacity="0.75" />
      <circle cx="22" cy="14" r="2.5" fill="white" opacity="0.75" />
      <circle cx="26" cy="21" r="2" fill="white" opacity="0.65" />
    </svg>
  );
}

function LeafSprite() {
  return (
    <svg width={CELL} height={CELL} viewBox="0 0 38 38" style={{ display: 'block' }}>
      <ellipse cx="19" cy="20" rx="13" ry="8" fill="#4ade80"
        transform="rotate(-35 19 20)" />
      <line x1="19" y1="30" x2="19" y2="10" stroke="#16a34a" strokeWidth="1.4"
        transform="rotate(-35 19 20)" />
    </svg>
  );
}

// ── Cell ─────────────────────────────────────────────────────────────────────

function WorldCell({ cell, isKara, karaDir, highlight, simMode, tool, onClick, onEnter }) {
  const bgClass = [
    'world-cell',
    cell.hasLeaf ? 'has-leaf' : '',
    highlight === 'front' ? 'sensor-front' : '',
    highlight === 'left'  ? 'sensor-left'  : '',
    highlight === 'right' ? 'sensor-right' : '',
    highlight === 'kara'  ? 'sensor-kara'  : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={bgClass}
      onClick={onClick}
      onMouseEnter={onEnter}
      title={`obj:${cell.object ?? 'none'} leaf:${cell.hasLeaf}`}
    >
      {/* Leaf layer — always below objects and Kara */}
      {cell.hasLeaf && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: isKara ? 0.45 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LeafSprite />
        </div>
      )}
      {cell.object === 'tree'     && <TreeSprite />}
      {cell.object === 'mushroom' && <MushroomSprite />}
      {isKara && (
        <div className="kara-overlay">
          <KaraSprite direction={karaDir} />
        </div>
      )}
    </div>
  );
}

// ── Tools palette ────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'tree',     label: 'Tree',     icon: '🌲' },
  { id: 'mushroom', label: 'Mushroom', icon: '🍄' },
  { id: 'leaf',     label: 'Leaf',     icon: '🍃' },
  { id: 'erase',    label: 'Erase',    icon: '🧹' },
  { id: 'kara',     label: 'Kara',     icon: '🐞' },
];

// ── WorldEditor ──────────────────────────────────────────────────────────────

export default function WorldEditor({ world, sensors, simMode, worldTool, dispatch }) {
  const [isPainting, setIsPainting] = useState(false);

  const applyTool = useCallback((x, y) => {
    if (simMode !== 'edit') return;
    const cell = world.cells[y][x];
    const isKara = world.kara.x === x && world.kara.y === y;

    if (worldTool === 'kara') {
      if (cell.object !== 'tree' && cell.object !== 'mushroom') {
        dispatch({ type: 'SET_KARA', patch: { x, y } });
      }
      return;
    }

    if (worldTool === 'erase') {
      if (isKara) return;
      dispatch({ type: 'SET_CELL', x, y, patch: { hasLeaf: false, object: null } });
      return;
    }

    if (worldTool === 'leaf') {
      dispatch({ type: 'SET_CELL', x, y, patch: { hasLeaf: !cell.hasLeaf } });
      return;
    }

    if (worldTool === 'tree' || worldTool === 'mushroom') {
      if (isKara) return; // can't place on Kara
      const obj = cell.object === worldTool ? null : worldTool;
      dispatch({ type: 'SET_CELL', x, y, patch: { object: obj } });
      return;
    }
  }, [world, simMode, worldTool, dispatch]);

  const handleClick = useCallback((x, y) => {
    applyTool(x, y);
    // Clicking Kara's cell in pointer-like mode rotates her direction
    if (worldTool === 'kara' && world.kara.x === x && world.kara.y === y) {
      const dirs = ['right', 'down', 'left', 'up'];
      const next = dirs[(dirs.indexOf(world.kara.direction) + 1) % 4];
      dispatch({ type: 'SET_KARA', patch: { direction: next } });
    }
  }, [applyTool, world.kara, worldTool, dispatch]);

  // Build sensor highlight map
  const highlights = {};
  if (sensors) {
    const kp = `${world.kara.x},${world.kara.y}`;
    highlights[kp] = 'kara';
    if (sensors._frontPos) highlights[`${sensors._frontPos.x},${sensors._frontPos.y}`] = 'front';
    if (sensors._leftPos)  highlights[`${sensors._leftPos.x},${sensors._leftPos.y}`]  = 'left';
    if (sensors._rightPos) highlights[`${sensors._rightPos.x},${sensors._rightPos.y}`] = 'right';
  }

  return (
    <div className="world-editor">
      {/* Tool palette */}
      <div className="world-toolbar">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`tool-btn ${worldTool === t.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_WORLD_TOOL', tool: t.id })}
            title={t.label}
            disabled={simMode !== 'edit'}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div className="toolbar-sep" />
        <button
          className="tool-btn danger"
          onClick={() => dispatch({ type: 'CLEAR_WORLD' })}
          disabled={simMode !== 'edit'}
          title="Clear entire world"
        >
          🗑 Clear
        </button>
        <button
          className="tool-btn"
          onClick={() => {
            const dirs = ['right', 'down', 'left', 'up'];
            const next = dirs[(dirs.indexOf(world.kara.direction) + 1) % 4];
            dispatch({ type: 'SET_KARA', patch: { direction: next } });
          }}
          disabled={simMode !== 'edit'}
          title="Rotate Kara clockwise"
        >
          ↻ Rotate Kara
        </button>
      </div>

      {/* Grid */}
      <div
        className="world-grid"
        style={{
          gridTemplateColumns: `repeat(${world.width}, ${CELL}px)`,
          gridTemplateRows:    `repeat(${world.height}, ${CELL}px)`,
        }}
        onMouseDown={() => setIsPainting(true)}
        onMouseUp={() => setIsPainting(false)}
        onMouseLeave={() => setIsPainting(false)}
      >
        {world.cells.map((row, y) =>
          row.map((cell, x) => {
            const key = `${x},${y}`;
            return (
              <WorldCell
                key={key}
                cell={cell}
                isKara={world.kara.x === x && world.kara.y === y}
                karaDir={world.kara.direction}
                highlight={highlights[key]}
                simMode={simMode}
                tool={worldTool}
                onClick={() => handleClick(x, y)}
                onEnter={() => isPainting && applyTool(x, y)}
              />
            );
          })
        )}
      </div>

      {/* World size controls */}
      {simMode === 'edit' && (
        <div className="world-size-row">
          <label>Width:
            <input type="number" min="5" max="30" value={world.width}
              onChange={e => dispatch({ type: 'RESIZE_WORLD', width: +e.target.value, height: world.height })}
            />
          </label>
          <label>Height:
            <input type="number" min="5" max="20" value={world.height}
              onChange={e => dispatch({ type: 'RESIZE_WORLD', width: world.width, height: +e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
