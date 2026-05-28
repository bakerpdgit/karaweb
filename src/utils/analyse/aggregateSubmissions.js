// Pure aggregator: turn a list of decrypted submission payloads into a
// 2-D map of cell statuses keyed by studentCode → challengeGuid.
//
// Per-cell statuses (matching the user spec):
//   'first'    light-green — passed on the only / first attempt
//   'eventual' dark-green  — passed eventually (>1 attempt, latest is pass)
//   'fail'     red         — latest attempt was a fail
//   null                   — no attempts recorded
//
// Each payload is expected to be of the form:
//   { type: 'karaweb-result-v1', studentCode, challengeGuid, passed,
//     submittedAt: ISO8601 }

export function aggregateSubmissions(payloads) {
  // group[studentCode][challengeGuid] = [{ passed, submittedAt }, ...]
  const groups = new Map();
  for (const p of payloads) {
    if (!p?.studentCode || !p?.challengeGuid) continue;
    if (!groups.has(p.studentCode)) groups.set(p.studentCode, new Map());
    const byCh = groups.get(p.studentCode);
    if (!byCh.has(p.challengeGuid)) byCh.set(p.challengeGuid, []);
    byCh.get(p.challengeGuid).push({
      passed: !!p.passed,
      submittedAt: p.submittedAt,
    });
  }

  const cells = {};
  for (const [studentCode, byCh] of groups.entries()) {
    cells[studentCode] = {};
    for (const [challengeGuid, attempts] of byCh.entries()) {
      // Sort ascending by submittedAt so the last entry is the latest.
      attempts.sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
      const latest = attempts[attempts.length - 1];
      const firstWasPass = attempts[0].passed;
      const latestIsPass = latest.passed;
      let status;
      if (!latestIsPass) status = 'fail';
      else if (attempts.length === 1 || firstWasPass) status = 'first';
      else status = 'eventual';
      cells[studentCode][challengeGuid] = { status, attempts: attempts.length, latest };
    }
  }
  return cells;
}
