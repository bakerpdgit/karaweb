import React from 'react';
import { KaraSprite, TreeSprite, MushroomSprite, LeafSprite, LeafCornerBadge } from './WorldEditor.jsx';

/**
 * Read-only mini-rendering of a world. Used to show the student the
 * target world they're trying to reach, alongside their working world.
 */
export default function WorldThumbnail({ world, cellSize = 22, title }) {
  if (!world) return null;
  return (
    <div className="world-thumbnail">
      {title && <div className="world-thumbnail-title">{title}</div>}
      <div
        className="world-thumbnail-grid"
        style={{
          gridTemplateColumns: `repeat(${world.width}, ${cellSize}px)`,
          gridTemplateRows:    `repeat(${world.height}, ${cellSize}px)`,
        }}
      >
        {world.cells.map((row, y) => row.map((cell, x) => {
          const isKara = world.kara.x === x && world.kara.y === y;
          return (
            <div key={`${x},${y}`} className="world-thumbnail-cell" style={{ width: cellSize, height: cellSize }}>
              {cell.hasLeaf && !isKara && (
                <div className="world-thumbnail-leaf">
                  <LeafSprite size={cellSize} />
                </div>
              )}
              {cell.object === 'tree'     && <TreeSprite size={cellSize} />}
              {cell.object === 'mushroom' && <MushroomSprite size={cellSize} />}
              {isKara && (
                <div className="world-thumbnail-kara">
                  <KaraSprite direction={world.kara.direction} size={cellSize} />
                </div>
              )}
              {cell.hasLeaf && isKara && (
                <LeafCornerBadge size={Math.max(10, Math.round(cellSize * 0.45))} />
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
