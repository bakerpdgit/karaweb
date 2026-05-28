// Turn a teacher-supplied GitHub link into something `fetch()` can
// actually retrieve. Returns the input unchanged when we don't
// recognise the host.
//
// Supported:
//   https://github.com/USER/REPO/blob/BRANCH/PATH/FILE.json
//     → https://raw.githubusercontent.com/USER/REPO/BRANCH/PATH/FILE.json
//   https://gist.github.com/USER/GIST_ID (single-file gist)
//     → https://gist.githubusercontent.com/USER/GIST_ID/raw
//   https://gist.github.com/USER/GIST_ID/raw[/FILE]
//     → https://gist.githubusercontent.com/USER/GIST_ID/raw[/FILE]
//   https://raw.githubusercontent.com/... → unchanged
//   https://gist.githubusercontent.com/... → unchanged
//   Anything else → unchanged

export function normaliseChallengesUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  let u;
  try { u = new URL(raw); } catch { return raw; }

  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);

  // github.com/USER/REPO/blob/BRANCH/PATH...
  if (host === 'github.com' && parts.length >= 5 && parts[2] === 'blob') {
    const [user, repo, , branch, ...rest] = parts;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${rest.join('/')}`;
  }

  // gist.github.com/USER/GIST_ID or gist.github.com/USER/GIST_ID/raw[/FILE]
  if (host === 'gist.github.com' && parts.length >= 2) {
    const [user, gistId, maybeRaw, ...rest] = parts;
    const tail = maybeRaw === 'raw'
      ? (rest.length ? `/raw/${rest.join('/')}` : '/raw')
      : '/raw';
    return `https://gist.githubusercontent.com/${user}/${gistId}${tail}`;
  }

  // Already a raw URL or unknown host — leave alone.
  return raw;
}
