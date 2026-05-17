// React hook wrapping PythonRunner so it can read fresh world/speed/mode
// values without re-creating the worker on every render.

import { useEffect, useMemo, useRef } from 'react';
import { PythonRunner } from './PythonRunner.js';

export function usePythonRunner({ appMode, world, sim, dispatch }) {
  const worldRef  = useRef(world);
  const speedRef  = useRef(sim.speed);
  const modeRef   = useRef(appMode);

  useEffect(() => { worldRef.current  = world;     }, [world]);
  useEffect(() => { speedRef.current  = sim.speed; }, [sim.speed]);
  useEffect(() => { modeRef.current   = appMode;   }, [appMode]);

  const runner = useMemo(() => new PythonRunner({
    getWorld:  () => worldRef.current,
    getSpeed:  () => speedRef.current,
    getMode:   () => modeRef.current,
    dispatch,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Pre-warm pyodide whenever the user enters a Python-using mode.
  useEffect(() => {
    if (appMode === 'blocks' || appMode === 'python') {
      runner.prewarm();
    }
  }, [appMode, runner]);

  useEffect(() => {
    return () => { runner.destroyWorker(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return runner;
}
