// Pyodide web worker for KaraWeb's Python modes.
//
// Loads pyodide via importScripts() from the jsdelivr CDN, executes our
// `kara_init.py` runtime (Ladybird, pyrun, pydebug, AST breakpoints), then
// accepts run/debug commands from the main thread. Before each run we use
// pyodide.loadPackagesFromImports() to auto-install any built-in packages
// the user code references; unknown packages fall back to micropip.

const PYODIDE_VERSION = '0.28.0';
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const ctx = {
  pyodide: null,
  ready: false,
  micropipReady: false,
};

self.onmessage = (e) => {
  const data = e.data;
  if (!data || !data.cmd) return;

  if (data.cmd === 'init') {
    initialise().catch((err) => {
      self.postMessage({ cmd: 'init-failed', message: String(err?.message ?? err) });
    });
    return;
  }

  if (data.cmd === 'reset') {
    // Hard-destroy is done by terminating the worker from main thread; for
    // an in-place soft reset we just clear globals.
    if (ctx.pyodide) {
      try {
        ctx.pyodide.runPython("for k in list(globals()): \n    if not k.startswith('_') and k not in ('Ladybird','KaraError','hit_breakpoint','pydebug','pyrun','synchronise','post_message','karaweb','sys','js','ast','json','copy','traceback','builtins'): \n        del globals()[k]");
      } catch {}
    }
    return;
  }

  if (data.cmd === 'debug' || data.cmd === 'run') {
    if (!ctx.ready) { workerPrint('Pyodide not yet initialised\n'); return; }
    runUserCode(data.code, data.cmd === 'debug').catch((err) => {
      workerPrint(String(err?.message ?? err) + '\n');
      self.postMessage({ cmd: 'debug-finished', reason: 'error' });
    });
    return;
  }
};

async function runUserCode(code, stepped) {
  let reason = 'ok';
  let errorLine = null;
  try {
    // Auto-install any built-in pyodide packages referenced by imports.
    try {
      await ctx.pyodide.loadPackagesFromImports(code, {
        messageCallback: (m) => {
          // pyodide prints "Loading X" / "Loaded X" — surface as installing chips
          const match = /^Loading (\S+)/.exec(m);
          if (match) self.postMessage({ cmd: 'installing', name: match[1] });
        },
      });
    } catch {}
    self.postMessage({ cmd: 'install-done' });

    if (stepped) {
      ctx.pyodide.globals.get('pydebug')(code, null, []);
    } else {
      ctx.pyodide.globals.get('pyrun')(code);
    }
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes('KeyboardInterrupt')) {
      reason = 'interrupt';
    } else if (msg.includes('ModuleNotFoundError')) {
      // Try micropip for pip-only packages, then re-run.
      const moduleMatch = /No module named ['"]([^'"]+)['"]/.exec(msg);
      const pkg = moduleMatch && moduleMatch[1];
      if (pkg) {
        try {
          await ensureMicropip();
          self.postMessage({ cmd: 'installing', name: pkg });
          await ctx.pyodide.runPythonAsync(`import micropip\nawait micropip.install('${pkg}')`);
          self.postMessage({ cmd: 'install-done' });
          // Re-execute now that the package is available.
          if (stepped) ctx.pyodide.globals.get('pydebug')(code, null, []);
          else         ctx.pyodide.globals.get('pyrun')(code);
        } catch (installErr) {
          self.postMessage({ cmd: 'install-failed', name: pkg, message: String(installErr?.message ?? installErr) });
          workerPrint(msg + '\n');
          reason = 'error';
        }
      } else {
        workerPrint(cleanTraceback(msg) + '\n');
        reason = 'error';
      }
    } else {
      const m = msg.match(/File "YourPythonCode\.py", line (\d+)/);
      if (m) errorLine = parseInt(m[1], 10);
      workerPrint(cleanTraceback(msg) + '\n');
      reason = 'error';
    }
  }
  self.postMessage({ cmd: 'debug-finished', reason, errorLine });
}

async function ensureMicropip() {
  if (ctx.micropipReady) return;
  await ctx.pyodide.loadPackage('micropip');
  ctx.micropipReady = true;
}

async function initialise() {
  importScripts(`${PYODIDE_CDN}pyodide.js`);
  // Cache-bust kara_init.py so a stale browser HTTP cache can't keep us on
  // an old version. The worker is fetched fresh each session anyway.
  const initUrl = `/python-runtime/kara_init.py?v=${Date.now()}`;
  const [initPy, pyodide] = await Promise.all([
    fetch(initUrl, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`Failed to fetch kara_init.py (${r.status})`);
      return r.text();
    }),
    self.loadPyodide({ indexURL: PYODIDE_CDN }),
  ]);
  ctx.pyodide = pyodide;
  await pyodide.runPythonAsync(initPy);
  const fp = initPy.includes('def _instrument') ? 'v2-clean-AST' : 'v1-template';
  // Surface in dev console which pydebug we're actually running.
  console.log(`[pyodide-worker] init.py loaded (${fp}, ${initPy.length} bytes)`);
  ctx.ready = true;
  self.postMessage({ cmd: 'init-done' });
}

function cleanTraceback(msg) {
  return String(msg)
    .replace(/File "<exec>", line \d+, in <module>\n/g, '')
    .replace(/File "<string>", line \d+, in <module>\n/g, '');
}

function workerPostMessage(msg) { self.postMessage(msg); }
function workerPrint(msg)       { self.postMessage({ cmd: 'print', msg: String(msg) }); }
function workerInterrupted()    { return false; }

Object.assign(self, { workerPostMessage, workerPrint, workerInterrupted });
