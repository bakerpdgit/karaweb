import React, { useCallback, useState } from 'react';
import { DIR_DELTA, turnLeft, turnRight } from '../utils.js';

const MIN_CELL = 20;
const MAX_CELL = 60;
const STEP     = 4;
const DEFAULT_CELL = 38;

// ── Sprite components ────────────────────────────────────────────────────────

export function KaraSprite({ direction, size }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[direction] ?? 0;
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" style={{ display: 'block' }}>
      <g transform={`rotate(${rot},19,19)`}>
        <ellipse cx="19" cy="22" rx="11" ry="13" fill="#e53e3e" />
        <line x1="19" y1="9" x2="19" y2="35" stroke="#7f1d1d" strokeWidth="1.5" />
        <circle cx="13" cy="20" r="2.8" fill="#7f1d1d" />
        <circle cx="25" cy="20" r="2.8" fill="#7f1d1d" />
        <circle cx="14" cy="29" r="2.2" fill="#7f1d1d" />
        <circle cx="24" cy="29" r="2.2" fill="#7f1d1d" />
        <circle cx="19" cy="9" r="7" fill="#1a202c" />
        <line x1="15" y1="4" x2="11" y2="0" stroke="#1a202c" strokeWidth="1.2" />
        <line x1="23" y1="4" x2="27" y2="0" stroke="#1a202c" strokeWidth="1.2" />
        <circle cx="11" cy="0" r="1.2" fill="#1a202c" />
        <circle cx="27" cy="0" r="1.2" fill="#1a202c" />
        <polygon points="19,2 16,7 22,7" fill="white" opacity="0.75" />
      </g>
    </svg>
  );
}

export function TreeSprite({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" style={{ display: 'block' }}>
      <rect x="15" y="26" width="8" height="12" rx="1" fill="#92400e" />
      <polygon points="19,2 4,20 34,20" fill="#166534" />
      <polygon points="19,8 6,23 32,23" fill="#14532d" />
    </svg>
  );
}

export function MushroomSprite({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" style={{ display: 'block' }}>
      <rect x="14" y="22" width="10" height="14" rx="2" fill="#d4a373" />
      <ellipse cx="19" cy="20" rx="15" ry="11" fill="#dc2626" />
      <circle cx="12" cy="17" r="3" fill="white" opacity="0.75" />
      <circle cx="22" cy="14" r="2.5" fill="white" opacity="0.75" />
      <circle cx="26" cy="21" r="2" fill="white" opacity="0.65" />
    </svg>
  );
}

export function LeafSprite({ size }) {
  // Three-lobe maple-style leaf with a short stem.
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" style={{ display: 'block' }}>
      {/* stem */}
      <line x1="19" y1="33" x2="19" y2="22" stroke="#166534" strokeWidth="1.8" strokeLinecap="round" />
      {/* left lobe */}
      <ellipse cx="10" cy="19" rx="5" ry="9" fill="#4ade80"
        stroke="#166534" strokeWidth="0.8"
        transform="rotate(-32 10 19)" />
      {/* right lobe */}
      <ellipse cx="28" cy="19" rx="5" ry="9" fill="#4ade80"
        stroke="#166534" strokeWidth="0.8"
        transform="rotate(32 28 19)" />
      {/* center (top) lobe */}
      <ellipse cx="19" cy="13" rx="5" ry="10" fill="#4ade80"
        stroke="#166534" strokeWidth="0.8" />
      {/* veins */}
      <line x1="19" y1="22" x2="19" y2="6"  stroke="#166534" strokeWidth="0.8" />
      <line x1="19" y1="22" x2="9"  y2="14" stroke="#166534" strokeWidth="0.7" />
      <line x1="19" y1="22" x2="29" y2="14" stroke="#166534" strokeWidth="0.7" />
    </svg>
  );
}

// Small "leaf present" badge shown in a cell corner when Kara is
// standing on a leaf — so the leaf is still visible at a glance even
// though Kara covers the centre of the cell.
export function LeafCornerBadge({ size }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 1, bottom: 1,
        width: size,
        height: size,
        zIndex: 2,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.4))',
      }}
    >
      <LeafSprite size={size} />
    </div>
  );
}

// ── Cell ─────────────────────────────────────────────────────────────────────

function WorldCell({ cell, isKara, karaDir, highlight, edgeSides, simMode, tool, onClick, onEnter, cellSize }) {
  const bgClass = [
    'world-cell',
    ...(edgeSides || []).map(side => `wrap-from-${side}`),
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
      {cell.hasLeaf && !isKara && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LeafSprite size={cellSize} />
        </div>
      )}
      {cell.object === 'tree'     && <TreeSprite size={cellSize} />}
      {cell.object === 'mushroom' && <MushroomSprite size={cellSize} />}
      {isKara && (
        <div className="kara-overlay">
          <KaraSprite direction={karaDir} size={cellSize} />
        </div>
      )}
      {cell.hasLeaf && isKara && (
        // Kara is standing on a leaf — show a small leaf badge in the
        // bottom-right corner so the leaf is still visible.
        <LeafCornerBadge size={Math.max(12, Math.round(cellSize * 0.45))} />
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
  const [cellSize, setCellSize]     = useState(DEFAULT_CELL);

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
      if (isKara) return;
      const obj = cell.object === worldTool ? null : worldTool;
      dispatch({ type: 'SET_CELL', x, y, patch: { object: obj } });
      return;
    }
  }, [world, simMode, worldTool, dispatch]);

  const handleClick = useCallback((x, y) => {
    applyTool(x, y);
    if (worldTool === 'kara' && world.kara.x === x && world.kara.y === y) {
      const dirs = ['right', 'down', 'left', 'up'];
      const next = dirs[(dirs.indexOf(world.kara.direction) + 1) % 4];
      dispatch({ type: 'SET_KARA', patch: { direction: next } });
    }
  }, [applyTool, world.kara, worldTool, dispatch]);

  // Build sensor highlight map + parallel wrap-direction map. A sensor
  // cell is "wrapped" when its position is on the opposite edge from
  // Kara because the unwrapped step landed outside the grid — we
  // surface this as a subtle dashed-edge chevron so the toroidal
  // geometry isn't silently confusing.
  const highlights = {};
  if (sensors) {
    const kp = `${world.kara.x},${world.kara.y}`;
    highlights[kp] = 'kara';
    const dirs = [
      { dir: world.kara.direction,            pos: sensors._frontPos, kind: 'front' },
      { dir: turnLeft(world.kara.direction),  pos: sensors._leftPos,  kind: 'left'  },
      { dir: turnRight(world.kara.direction), pos: sensors._rightPos, kind: 'right' },
    ];
    for (const { pos, kind } of dirs) {
      if (!pos) continue;
      const cellKey = `${pos.x},${pos.y}`;
      highlights[cellKey] = kind;
    }
  }
  // Edge cells get a dashed outer border on each side that touches the
  // world's perimeter — a universal "the world wraps here" hint that
  // applies regardless of where Kara is. Corner cells get two classes.
  // Computed in WorldCell directly from x/y/width/height.

  return (
    <div className="world-editor">
      {/* Tool palette */}
      <div className="world-toolbar">
        {TOOLS.map(t => (
          <button key={t.id}
            className={`tool-btn ${worldTool === t.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_WORLD_TOOL', tool: t.id })}
            title={t.label}
            disabled={simMode !== 'edit'}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div className="toolbar-sep" />
        <button className="tool-btn danger"
          onClick={() => dispatch({ type: 'CLEAR_WORLD' })}
          disabled={simMode !== 'edit'}
          title="Clear entire world"
        >
          🗑 Clear
        </button>
        <button className="tool-btn"
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
        <div className="toolbar-sep" />
        {/* Zoom controls */}
        <div className="zoom-control">
          <button className="tool-btn zoom-btn"
            onClick={() => setCellSize(s => Math.max(MIN_CELL, s - STEP))}
            title="Shrink grid cells"
            disabled={cellSize <= MIN_CELL}
          >−</button>
          <span className="zoom-label" title="Cell size">{cellSize}px</span>
          <button className="tool-btn zoom-btn"
            onClick={() => setCellSize(s => Math.min(MAX_CELL, s + STEP))}
            title="Grow grid cells"
            disabled={cellSize >= MAX_CELL}
          >+</button>
        </div>
      </div>

      {/* Grid — scroll wrapper handles horizontal overflow when panel is narrowed */}
      <div style={{ overflowX: 'auto' }}>
        <div
          className="world-grid"
          style={{
            gridTemplateColumns: `repeat(${world.width}, ${cellSize}px)`,
            gridTemplateRows:    `repeat(${world.height}, ${cellSize}px)`,
            '--cell-size': `${cellSize}px`,
          }}
          onMouseDown={() => setIsPainting(true)}
          onMouseUp={() => setIsPainting(false)}
          onMouseLeave={() => setIsPainting(false)}
        >
          {world.cells.map((row, y) =>
            row.map((cell, x) => {
              const key = `${x},${y}`;
              const edgeSides = [];
              if (y === 0)                 edgeSides.push('top');
              if (y === world.height - 1)  edgeSides.push('bottom');
              if (x === 0)                 edgeSides.push('left');
              if (x === world.width - 1)   edgeSides.push('right');
              return (
                <WorldCell
                  key={key}
                  cell={cell}
                  isKara={world.kara.x === x && world.kara.y === y}
                  karaDir={world.kara.direction}
                  highlight={highlights[key]}
                  edgeSides={edgeSides}
                  simMode={simMode}
                  tool={worldTool}
                  cellSize={cellSize}
                  onClick={() => handleClick(x, y)}
                  onEnter={() => isPainting && applyTool(x, y)}
                />
              );
            })
          )}
        </div>
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
