# KaraWeb Python runtime.
#
# Adapted from pythonfrontend's init.py — keeps only what KaraWeb needs:
#   - `Ladybird` class (kara's actions and sensors), bridged to main thread
#   - `pyrun(code)`            -- straight execution, no stepping
#   - `pydebug(code, ...)`     -- AST rewriting that injects a hit_breakpoint
#                                 call after every statement so the worker can
#                                 step / report current line back to the main
#                                 thread between statements.
#
# The main thread responds to each breakpoint with either "continue", "step
# again", or "stop", driven by the existing Run / Pause / Step / Reset UI.

import sys
import js
import ast
import copy
import json
import io
import types
import builtins
import traceback
from collections import deque
from pyodide.ffi import to_js


# ── stdout capture: pipe Python prints to the main-thread console ─────────────
class _WorkerStdout(io.TextIOBase):
    def __init__(self):
        self.buffer = ""
    def write(self, s):
        if not s:
            return 0
        # forward to JS so the host can decide what to do with it.
        try:
            js.workerPrint(s)
        except Exception:
            pass
        self.buffer += s
        return len(s)
    def flush(self):
        pass

_stdout_proxy = _WorkerStdout()
sys.stdout = _stdout_proxy
sys.stderr = _stdout_proxy


# ── JS bridge ────────────────────────────────────────────────────────────────

def post_message(data):
    js.workerPostMessage(to_js(data, dict_converter=js.Object.fromEntries))

def synchronise(url):
    x = js.XMLHttpRequest.new()
    x.open('get', url, False)
    x.setRequestHeader('cache-control', 'no-cache, no-store, max-age=0')
    x.send()
    return x.response


# ── Ladybird (kara) — methods marshalled to the main thread ──────────────────

class KaraError(Exception):
    """Raised when the world rejects a kara action (e.g. walking into a tree)."""
    pass

class Ladybird:
    """
    Kara, the programmable ladybird. Each method dispatches to the main thread
    via the service worker, which mutates the canonical world state and
    replies with either a value (for sensors) or an error (e.g. trying to walk
    into a tree). The worker thread blocks on a synchronous XHR until the main
    thread responds, so each call appears synchronous from Python's view.
    """

    def __init__(self, x=None, y=None, direction=None):
        # Recording-only: the world is authoritative. We accept the args so
        # user code like `kara = Ladybird(5, 3)` is natural to write, but the
        # block-generated init only ever produces calls that match the world.
        self._send({'action': 'init', 'x': x, 'y': y, 'direction': direction})

    def move(self):         self._send({'action': 'move'})
    def turn_left(self):    self._send({'action': 'turn_left'})
    def turn_right(self):   self._send({'action': 'turn_right'})
    def put_leaf(self):     self._send({'action': 'put_leaf'})
    def remove_leaf(self):  self._send({'action': 'remove_leaf'})

    def tree_front(self):     return self._send({'action': 'tree_front'})
    def tree_left(self):      return self._send({'action': 'tree_left'})
    def tree_right(self):     return self._send({'action': 'tree_right'})
    def mushroom_front(self): return self._send({'action': 'mushroom_front'})
    def on_leaf(self):        return self._send({'action': 'on_leaf'})

    def _send(self, msg):
        post_message({'cmd': 'kara', 'msg': json.dumps(msg)})
        raw = synchronise('/@kara@/req.js')
        # An empty / missing response is *always* a bug — the bridge has
        # dropped a message. Raising lets the user see what went wrong
        # rather than silently returning None and then looping forever
        # because a sensor read came back as None ("falsy → !None is True").
        if raw is None or raw == '':
            raise KaraError('Internal: kara bridge returned no response (likely a service-worker race).')
        try:
            resp = json.loads(raw)
        except Exception:
            raise KaraError('Internal: kara bridge returned malformed response.')
        if resp.get('error'):
            raise KaraError(resp['error'])
        return resp.get('value')


# ── Expose `karaweb` as an importable module ──────────────────────────────────
# So that user code can write `from karaweb import Ladybird` and have it work
# transparently, rather than depending on a magic global. KaraError ditto.
_karaweb_module = types.ModuleType('karaweb')
_karaweb_module.Ladybird = Ladybird
_karaweb_module.KaraError = KaraError
sys.modules['karaweb'] = _karaweb_module


# ── Step / debug machinery (AST rewriting + breakpoint hook) ──────────────────

# Map every source line of the user's program to the next line that actually
# carries an injected `hit_breakpoint(...)` call. Most lines map to themselves
# but blank/comment lines map forward to the next statement.
breakpoint_map = {}
# When the main thread tells us to "step", we set this True and the next
# breakpoint call will then pause.
step_into = True
last_seen_lineno = -1
last_seen_breakpoint_id = None
# Total number of statements actually injected with a breakpoint — useful for
# the main thread to know up front (currently unused, but cheap to expose).
injected_count = 0


def pyrun(code):
    """Straight execution, no stepping."""
    global_vars = _fresh_globals()
    exec(compile(ast.parse(code), filename="YourPythonCode.py", mode="exec"),
         global_vars)


def _fresh_globals():
    g = {}
    g['Ladybird'] = Ladybird
    g['KaraError'] = KaraError
    g['input'] = debug_input
    return g


def debug_input(prompt=""):
    """Prompt for user input via the main thread's output panel.

    Note: we deliberately do NOT print the prompt to stdout here — the JS
    side shows the prompt inline with the input field and echoes
    `prompt + answer` as a single output line on submit. Printing it here
    would just produce a duplicate.
    """
    post_message({'cmd': 'input', 'prompt': str(prompt) if prompt else ''})
    raw = synchronise('/@input@/req.js')
    try:
        resp = json.loads(raw) if raw else {}
    except Exception:
        resp = {}
    return resp.get('data', '')


def _make_breakpoint_call(lineno):
    """Build a fresh `hit_breakpoint(<lineno>)` AST node ready to inject."""
    return ast.Expr(value=ast.Call(
        func=ast.Name(id='hit_breakpoint', ctx=ast.Load()),
        args=[ast.Constant(value=lineno)],
        keywords=[],
    ))


def _instrument(node):
    """Recursively wrap every statement in every `body`-like list with
    `hit_breakpoint(stmt.lineno)`. This injects the breakpoint without
    touching any expression (so loop conditions, if-tests, etc. remain
    intact — a previous bug was caused by stale args propagating in via
    deepcopy of a shared template node with mis-located metadata)."""
    for attr in ('body', 'orelse', 'finalbody'):
        if hasattr(node, attr):
            body = getattr(node, attr)
            if not isinstance(body, list):
                continue
            new_body = []
            for stmt in body:
                if hasattr(stmt, 'lineno'):
                    new_body.append(_make_breakpoint_call(stmt.lineno))
                _instrument(stmt)
                new_body.append(stmt)
            setattr(node, attr, new_body)
    if hasattr(node, 'handlers'):
        for h in node.handlers:
            _instrument(h)


def pydebug(code, breakpoints=None, watches=None):
    """Step-debug execution: instrument every statement with a hit_breakpoint
    call, then exec. Each hit_breakpoint posts back to the main thread and
    blocks on a sync-XHR until the main thread says to continue."""
    global step_into, last_seen_lineno, last_seen_breakpoint_id, injected_count

    step_into = True
    last_seen_lineno = -1
    last_seen_breakpoint_id = None

    global_vars = _fresh_globals()
    global_vars['hit_breakpoint'] = hit_breakpoint
    global_vars['traceback'] = traceback

    parsed = ast.parse(code)
    _instrument(parsed)
    # Fill in any lineno/col_offset that our injected nodes don't carry from
    # the nearest enclosing real node — required for compile() to accept the
    # tree and for tracebacks to point at real user lines.
    ast.fix_missing_locations(parsed)

    injected_count = 0  # currently unused but kept for parity
    exec(compile(parsed, filename="YourPythonCode.py", mode="exec"), global_vars)


def hit_breakpoint(lineno):
    """Called from injected AST nodes before each user-program statement."""
    global step_into
    if not step_into:
        return
    step_into = False
    post_message({'cmd': 'breakpt', 'lineno': lineno})
    raw = synchronise('/@step@/break.js')
    try:
        resp = json.loads(raw) if raw else {}
    except Exception:
        resp = {}
    if resp.get('step'):
        step_into = True
