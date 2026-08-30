"""Offline replay of challenge-book solutions.

Reads the payload written by scripts/verifyBook.mjs and runs each program
against a port of the world model in src/utils.js (move / turn / leaf
semantics, wrap-around vs fixed edges, mushroom pushing) and the pass rule
in store.js CH_CHECK_RESULT (ordered checkpoints, then the target).

Usage:  python scripts/simulateBook.py scripts/tmp/verify-payload.json
"""

import json
import sys

# Windows consoles default to cp1252; the report uses ✓/✗.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

DIRECTIONS = ["right", "down", "left", "up"]
DELTA = {"right": (1, 0), "down": (0, 1), "left": (-1, 0), "up": (0, -1)}

MAX_ACTIONS = 20000          # runaway-loop guard


class KaraError(Exception):
    pass


def turn_left(d):
    return DIRECTIONS[(DIRECTIONS.index(d) + 3) % 4]


def turn_right(d):
    return DIRECTIONS[(DIRECTIONS.index(d) + 1) % 4]


class World:
    def __init__(self, w, fixed_edges=False):
        self.width = w["width"]
        self.height = w["height"]
        self.cells = [[{"hasLeaf": bool(c.get("hasLeaf")), "object": c.get("object")}
                       for c in row] for row in w["cells"]]
        self.kara = dict(w["kara"])
        self.fixed_edges = fixed_edges

    def step(self, x, y, d):
        """Cell one square along `d`, or None when off a fixed edge."""
        dx, dy = DELTA[d]
        nx, ny = x + dx, y + dy
        if self.fixed_edges:
            if nx < 0 or nx >= self.width or ny < 0 or ny >= self.height:
                return None
            return (nx, ny)
        return (nx % self.width, ny % self.height)

    def equals(self, other, ignore_orientation=False):
        if self.width != other["width"] or self.height != other["height"]:
            return False
        k, ok = self.kara, other["kara"]
        if k["x"] != ok["x"] or k["y"] != ok["y"]:
            return False
        if not ignore_orientation and k["direction"] != ok["direction"]:
            return False
        for y in range(self.height):
            for x in range(self.width):
                a, b = self.cells[y][x], other["cells"][y][x]
                if bool(a["hasLeaf"]) != bool(b.get("hasLeaf")):
                    return False
                if (a["object"] or None) != (b.get("object") or None):
                    return False
        return True


class Ladybird:
    """The `kara` object exposed to the program under test."""

    def __init__(self, world, on_change):
        self._w = world
        self._on_change = on_change
        self._actions = 0

    # ── actions ──────────────────────────────────────────────────────
    def _acted(self):
        self._actions += 1
        if self._actions > MAX_ACTIONS:
            raise KaraError("program did not finish (over %d actions)" % MAX_ACTIONS)
        self._on_change()

    def move(self):
        w = self._w
        front = w.step(w.kara["x"], w.kara["y"], w.kara["direction"])
        if front is None:
            raise KaraError("Kara cannot walk off the edge of the world!")
        fx, fy = front
        cell = w.cells[fy][fx]
        if cell["object"] == "tree":
            raise KaraError("Kara cannot move into a tree!")
        if cell["object"] == "mushroom":
            behind = w.step(fx, fy, w.kara["direction"])
            if behind is None:
                raise KaraError("Cannot push mushroom off the edge of the world!")
            bx, by = behind
            if w.cells[by][bx]["object"] is not None:
                raise KaraError("Cannot push mushroom — cell behind it is blocked!")
            w.cells[by][bx]["object"] = "mushroom"
            cell["object"] = None
        w.kara["x"], w.kara["y"] = fx, fy
        self._acted()

    def turn_left(self):
        self._w.kara["direction"] = turn_left(self._w.kara["direction"])
        self._acted()

    def turn_right(self):
        self._w.kara["direction"] = turn_right(self._w.kara["direction"])
        self._acted()

    def put_leaf(self):
        w = self._w
        w.cells[w.kara["y"]][w.kara["x"]]["hasLeaf"] = True
        self._acted()

    def remove_leaf(self):
        w = self._w
        cell = w.cells[w.kara["y"]][w.kara["x"]]
        if not cell["hasLeaf"]:
            raise KaraError("No leaf to remove here!")
        cell["hasLeaf"] = False
        self._acted()

    # ── sensors ──────────────────────────────────────────────────────
    def _look(self, d):
        w = self._w
        pos = w.step(w.kara["x"], w.kara["y"], d)
        if pos is None:
            return None                      # off a fixed edge
        return w.cells[pos[1]][pos[0]]

    def tree_front(self):
        c = self._look(self._w.kara["direction"])
        return True if c is None else c["object"] == "tree"

    def tree_left(self):
        c = self._look(turn_left(self._w.kara["direction"]))
        return True if c is None else c["object"] == "tree"

    def tree_right(self):
        c = self._look(turn_right(self._w.kara["direction"]))
        return True if c is None else c["object"] == "tree"

    def mushroom_front(self):
        c = self._look(self._w.kara["direction"])
        return False if c is None else c["object"] == "mushroom"

    def on_leaf(self):
        w = self._w
        return bool(w.cells[w.kara["y"]][w.kara["x"]]["hasLeaf"])


def run_case(case, mode, which="programs"):
    """Run one program. Returns (ok, detail)."""
    code = case.get(which, {}).get(mode)
    if code is None:
        return None, "no %s solution" % mode

    seq = case["checkpoints"]
    last_idx = len(seq) - 1
    ignore = case["ignoreOrientation"]
    world = World(seq[0], case["fixedEdges"])
    reached = [0]

    def on_change():
        # Mirrors the checkpoint effect in App.jsx: after every world
        # change, advance as far along the sequence as matches, in order.
        while reached[0] < last_idx and world.equals(seq[reached[0] + 1], ignore):
            reached[0] += 1

    kara = Ladybird(world, on_change)
    env = {"kara": kara, "__name__": "__main__"}
    try:
        exec(compile(code, "<%s:%s>" % (case["name"], mode), "exec"), env)
    except KaraError as e:
        return False, "runtime: %s" % e
    except Exception as e:                       # noqa: BLE001 - report anything
        return False, "%s: %s" % (type(e).__name__, e)

    if case["noCheckTarget"]:
        return True, "ran clean (%d actions)" % kara._actions

    on_change()
    if reached[0] < last_idx:
        return False, ("only reached checkpoint %d of %d (kara ended at %s facing %s)"
                       % (reached[0], last_idx, (world.kara["x"], world.kara["y"]),
                          world.kara["direction"]))
    if not case["endOnTargetNotRequired"] and not world.equals(seq[last_idx], ignore):
        return False, ("passed through the target but did not end on it "
                       "(kara at %s facing %s)"
                       % ((world.kara["x"], world.kara["y"]), world.kara["direction"]))
    return True, "%d actions" % kara._actions


def main():
    payload = json.load(open(sys.argv[1], encoding="utf-8"))
    failures = 0
    for case in payload["cases"]:
        line = []
        for mode in ("blocks", "python"):
            ok, detail = run_case(case, mode)
            if ok is None:
                line.append("%s —" % mode)
            elif ok:
                line.append("%s ok (%s)" % (mode, detail))
            else:
                failures += 1
                line.append("%s FAIL [%s]" % (mode.upper(), detail))
        # A starter that already passes would hand the student the answer.
        for mode in ("blocks", "python"):
            ok, detail = run_case(case, mode, "starters")
            if ok:
                failures += 1
                line.append("%s STARTER ALREADY PASSES" % mode.upper())
        status = "✗" if any("FAIL" in p or "ALREADY" in p for p in line) else "✓"
        print("%s %-34s %s" % (status, case["name"], " | ".join(line)))
    print("\n%d/%d challenges clean in both modes."
          % (len(payload["cases"]) - failures, len(payload["cases"]))
          if failures == 0 else
          "\n%d solution run(s) failed." % failures)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
