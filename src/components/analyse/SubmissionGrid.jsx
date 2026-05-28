import React from 'react';

/**
 * Cell colour rules (from the spec):
 *   first    light green — passed first try
 *   eventual dark green  — passed after one or more failures
 *   fail     red          — latest attempt failed
 *   null     blank        — no attempts
 *
 * Column headers display "#1", "#2", … with the full challenge name
 * shown as the native tooltip on hover. Hovering a cell shows the
 * latest attempt time + attempts count.
 */
export default function SubmissionGrid({ students, challenges, cells, onCellClick }) {
  if (!students.length) {
    return <div className="analyse-empty">No students to display. Pick a Class mask above, or check your filter.</div>;
  }
  if (!challenges.length) {
    return <div className="analyse-empty">No challenges loaded — open a cloud-save challenges file.</div>;
  }
  return (
    <div className="analyse-grid-wrap">
      <table className="analyse-grid">
        <thead>
          <tr>
            <th className="agrid-corner">Student</th>
            {challenges.map((ch, idx) => (
              <th key={ch.guid || ch.id} title={ch.name} className="agrid-colhead">#{idx + 1}</th>
            ))}
            <th className="agrid-corner-r">Score</th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => {
            const row = cells[s.code] || {};
            let passed = 0;
            for (const ch of challenges) {
              const cell = row[ch.guid || ch.id];
              if (cell?.status === 'first' || cell?.status === 'eventual') passed += 1;
            }
            return (
              <tr key={s.code}>
                <th
                  className={`agrid-rowhead ${s.unknown ? 'agrid-rowhead-unknown' : ''}`}
                  title={s.unknown ? `Code ${s.code} — not in the masked class` : `code ${s.code}`}
                >{s.username}</th>
                {challenges.map((ch) => {
                  const cell = row[ch.guid || ch.id];
                  const clickable = !!cell;
                  const cls  = `agrid-cell ${cell ? `agrid-${cell.status}` : ''} ${clickable ? 'agrid-clickable' : ''}`;
                  const ttl  = cell
                    ? `${cell.status} · ${cell.attempts} attempt${cell.attempts === 1 ? '' : 's'} · latest ${cell.latest.submittedAt}${onCellClick ? ' (click to view solution)' : ''}`
                    : 'no submissions';
                  return (
                    <td
                      key={(ch.guid || ch.id) + s.code}
                      className={cls}
                      title={ttl}
                      onClick={clickable && onCellClick ? () => onCellClick(s, ch, cell) : undefined}
                    ></td>
                  );
                })}
                <td className="agrid-score">{passed}/{challenges.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="analyse-legend">
      <span className="agrid-legend-box agrid-first" /> passed first try
      <span className="agrid-legend-box agrid-eventual" /> passed eventually
      <span className="agrid-legend-box agrid-fail" /> failed (latest)
      <span className="agrid-legend-box" /> no attempt
    </div>
  );
}
