import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import { toolboxJson, filterToolbox } from '../python/blocks/toolbox.js';
import { validateBlocksState } from '../utils/blocksValidate.js';
import { initBlocks } from '../python/blocks/pythonGenerator.js';
import RunnerOutputPanel from './RunnerOutputPanel.jsx';
import { countBlocks } from '../utils/codeLimits.js';
import { useConfirmModal } from './ConfirmModal.jsx';

// Initialise our custom block defs once at module load.
initBlocks();

export default function BlocksEditor({ blocks, runner, dispatch, pythonRunner, readOnly = false, blocksCap = null, disallowedBlocks = [] }) {
  const userRef = useRef(null);
  const userWorkspaceRef = useRef(null);
  const lastHighlightedRef = useRef(null);
  // Limit-enforcement plumbing: keep `cap` fresh via ref so the
  // change listener (captured at mount) reads the current value.
  const blocksCapRef = useRef(blocksCap);
  useEffect(() => { blocksCapRef.current = blocksCap; }, [blocksCap]);
  const lastValidRef = useRef(null);
  const { alert: showAlert, modal: alertModal } = useConfirmModal();
  // Stable string key for the disallowed-blocks list — used in the
  // live-update effect's deps so we only react when the SET changes,
  // not on every parent re-render.
  const disallowedKey = disallowedBlocks.join('|');

  // ── User workspace ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userRef.current) return;
    const ws = Blockly.inject(userRef.current, {
      // In read-only mode we hide the toolbox so the user can't drag in
      // new blocks; Blockly's own readOnly option also disables drag /
      // mutate of existing blocks. We still allow zoom + scroll so the
      // user can inspect.
      readOnly,
      toolbox: readOnly ? null : filterToolbox(toolboxJson, disallowedBlocks),
      trashcan: !readOnly,
      zoom: { controls: true, wheel: false, startScale: 0.95 },
      grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
    });
    userWorkspaceRef.current = ws;

    if (blocks.blocklyState) {
      try {
        Blockly.serialization.workspaces.load(blocks.blocklyState, ws);
        // One-shot validation paint right after the workspace loads
        // so existing warnings show up before the user touches anything.
        if (!readOnly) {
          try {
            const issues = validateBlocksState(blocks.blocklyState);
            const firstMsg = new Map();
            for (const i of issues) {
              if (!firstMsg.has(i.blockId)) firstMsg.set(i.blockId, i.message);
            }
            for (const b of ws.getAllBlocks(false)) {
              const msg = firstMsg.get(b.id);
              try { b.setWarningText(msg ?? null); } catch {}
            }
          } catch {}
        }
      } catch (e) {
        console.warn('Failed to load blocks.blocklyState:', e);
      }
    }
    // In read-only (solution view) mode there's no editing surface, so
    // workspace pan / placement is just inspection. Reposition all top
    // blocks so the bounding box starts near (10, 10) — otherwise the
    // saved coords (potentially far down-right from the teacher's
    // original layout) leave the reader scrolling.
    if (readOnly && blocks.blocklyState) {
      try {
        const tops = ws.getTopBlocks(false);
        if (tops.length > 0) {
          let minX = Infinity, minY = Infinity;
          for (const b of tops) {
            const xy = b.getRelativeToSurfaceXY();
            if (xy.x < minX) minX = xy.x;
            if (xy.y < minY) minY = xy.y;
          }
          const dx = 10 - minX;
          const dy = 10 - minY;
          if (dx !== 0 || dy !== 0) {
            for (const b of tops) b.moveBy(dx, dy);
          }
          ws.scrollbar?.set?.(0, 0);
        }
      } catch (e) {
        console.warn('Failed to reposition solution blocks:', e);
      }
    }
    // Seed last-valid for the limit-revert path.
    lastValidRef.current = blocks.blocklyState ?? null;

    // No change-listener in read-only mode — even if Blockly's own
    // gating misses something, we don't want spurious BLK_SET_STATE
    // dispatches against the solution view.
    if (!readOnly) {
      let pending = false;
      let reverting = false;
      const listener = (event) => {
        if (reverting) return;
        if (event.isUiEvent) return;
        if (event.type === Blockly.Events.FINISHED_LOADING) return;
        if (pending) return;
        pending = true;
        queueMicrotask(() => {
          pending = false;
          try {
            const json = Blockly.serialization.workspaces.save(ws);
            const cap = blocksCapRef.current;
            if (cap != null && countBlocks(json) > cap) {
              // Restore the last valid workspace + tell the student.
              reverting = true;
              try {
                ws.clear();
                if (lastValidRef.current) {
                  Blockly.serialization.workspaces.load(lastValidRef.current, ws);
                }
              } catch {}
              queueMicrotask(() => { reverting = false; });
              showAlert({
                message: `You've reached the ${cap}-block limit for this challenge. Remove a block before adding more.`,
              });
              return;
            }
            lastValidRef.current = json;
            dispatch({ type: 'BLK_SET_STATE', blocklyState: json, markDirty: true });
            // Live syntax-style validation: walk the just-saved state
            // and paint warning bubbles on blocks with empty required
            // inputs (e.g. a while loop with no condition).
            try {
              const issues = validateBlocksState(json);
              const badIds = new Set(issues.map(i => i.blockId));
              // Build first-message-per-block map (a single bubble can't
              // show two messages; first issue is the most actionable).
              const firstMsg = new Map();
              for (const i of issues) {
                if (!firstMsg.has(i.blockId)) firstMsg.set(i.blockId, i.message);
              }
              for (const b of ws.getAllBlocks(false)) {
                if (badIds.has(b.id)) {
                  try { b.setWarningText(firstMsg.get(b.id)); } catch {}
                } else {
                  try { b.setWarningText(null); } catch {}
                }
              }
            } catch {}
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
    }
    return () => {
      ws.dispose();
      userWorkspaceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-update the toolbox when the teacher toggles disallowed blocks
  // via the management modal. Skip in read-only mode (no toolbox there).
  useEffect(() => {
    if (readOnly) return;
    const ws = userWorkspaceRef.current;
    if (!ws) return;
    try {
      ws.updateToolbox(filterToolbox(toolboxJson, disallowedBlocks));
    } catch (e) {
      console.warn('Failed to update toolbox:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disallowedKey, readOnly]);

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
      {alertModal}
    </div>
  );
}
