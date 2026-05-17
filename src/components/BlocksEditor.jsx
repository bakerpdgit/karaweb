import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { toolboxJson } from '../python/blocks/toolbox.js';
import { initBlocks } from '../python/blocks/pythonGenerator.js';
import RunnerOutputPanel from './RunnerOutputPanel.jsx';

// Initialise our custom block defs once at module load.
initBlocks();

export default function BlocksEditor({ blocks, runner, dispatch, pythonRunner }) {
  const userRef = useRef(null);
  const userWorkspaceRef = useRef(null);
  const lastHighlightedRef = useRef(null);

  // ── User workspace ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userRef.current) return;
    const ws = Blockly.inject(userRef.current, {
      toolbox: toolboxJson,
      trashcan: true,
      zoom: { controls: true, wheel: false, startScale: 0.95 },
      grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
    });
    userWorkspaceRef.current = ws;

    if (blocks.blocklyState) {
      try {
        Blockly.serialization.workspaces.load(blocks.blocklyState, ws);
      } catch (e) {
        console.warn('Failed to load blocks.blocklyState:', e);
      }
    }

    let pending = false;
    const listener = (event) => {
      if (event.isUiEvent) return;
      if (event.type === Blockly.Events.FINISHED_LOADING) return;
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        try {
          const json = Blockly.serialization.workspaces.save(ws);
          dispatch({ type: 'BLK_SET_STATE', blocklyState: json, markDirty: true });
        } catch (e) {
          console.warn('Failed to serialise workspace:', e);
        }
      });
    };
    ws.addChangeListener(listener);

    return () => {
      ws.removeChangeListener(listener);
      ws.dispose();
      userWorkspaceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Block highlighting (current step) ─────────────────────────────────────
  useEffect(() => {
    const ws = userWorkspaceRef.current;
    if (!ws) return;
    const prev = lastHighlightedRef.current;
    if (prev) {
      try {
        const b = ws.getBlockById(prev);
        if (b) b.removeSelect?.();
      } catch {}
    }
    const next = blocks.currentBlockId;
    if (next) {
      try {
        const b = ws.getBlockById(next);
        if (b) {
          ws.highlightBlock(next);
          b.addSelect?.();
        }
      } catch {}
    } else {
      try { ws.highlightBlock(null); } catch {}
    }
    lastHighlightedRef.current = next;
  }, [blocks.currentBlockId]);

  // Error highlighting (Blockly warning balloon).
  useEffect(() => {
    const ws = userWorkspaceRef.current;
    if (!ws) return;
    for (const b of ws.getAllBlocks(false)) {
      try { b.setWarningText(null); } catch {}
    }
    if (blocks.errorBlockId) {
      try {
        const b = ws.getBlockById(blocks.errorBlockId);
        if (b) b.setWarningText('This block caused an error.');
      } catch {}
    }
  }, [blocks.errorBlockId]);

  useEffect(() => {
    const onResize = () => {
      try {
        if (userWorkspaceRef.current) Blockly.svgResize(userWorkspaceRef.current);
      } catch {}
    };
    onResize();
    window.addEventListener('resize', onResize);
    const t = setTimeout(onResize, 60);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, []);

  return (
    <div className="python-editor">
      <div ref={userRef} className="python-user-canvas" />
      <RunnerOutputPanel runner={runner} dispatch={dispatch} pythonRunner={pythonRunner} />
    </div>
  );
}
