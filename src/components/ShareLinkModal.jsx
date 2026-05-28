import React, { useMemo, useState } from 'react';
import { normaliseChallengesUrl } from '../utils/normaliseChallengesUrl.js';
import { copyToClipboard } from '../utils/copyToClipboard.js';

/**
 * Pops after the teacher saves a challenges file. Offers an easy way
 * to share the challenges with students via a direct deep link:
 *   https://your-karaweb-host/?challenges=<urlencoded-raw-file-url>
 *
 * The teacher uploads the saved JSON file somewhere public (GitHub
 * repo, gist, or anywhere with a raw URL). They paste the link and
 * the modal generates the karaweb deep link.
 */
export default function ShareLinkModal({ savedFilename, onClose }) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [copied,    setCopied]    = useState(false);

  const normalised = useMemo(() => normaliseChallengesUrl(sourceUrl), [sourceUrl]);

  const shareLink = useMemo(() => {
    if (!normalised) return '';
    const base = (typeof window !== 'undefined')
      ? (window.location.origin + window.location.pathname)
      : '';
    return base + '?challenges=' + encodeURIComponent(normalised);
  }, [normalised]);

  const copy = async () => {
    if (!shareLink) return;
    const ok = await copyToClipboard(shareLink);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-link-modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Share with students (optional)</h3>
        <p className="modal-help">
          You just saved <strong>{savedFilename}</strong>. If you put that
          file on a <strong>public</strong> location (a GitHub repo, a public
          Gist, or any public raw URL), you can generate a direct link
          students can open without needing to download the JSON file.
        </p>
        <p className="modal-help">
          Paste the GitHub link to the file below. We'll convert it to a raw
          URL automatically.
        </p>

        <label className="save-label">
          GitHub link to {savedFilename}:
          <input
            autoFocus
            className="rename-input"
            value={sourceUrl}
            placeholder="https://github.com/YOU/REPO/blob/main/challenges/y10a.json"
            onChange={e => setSourceUrl(e.target.value)}
            spellCheck={false}
          />
        </label>

        {sourceUrl && !shareLink && (
          <p className="cl-hint">Couldn't parse that as a URL.</p>
        )}

        {shareLink && (
          <>
            <p className="save-label" style={{ marginTop: 12 }}>Share this link with students:</p>
            <div className="share-link-row">
              <input
                className="share-link-output"
                readOnly
                value={shareLink}
                onClick={e => e.currentTarget.select()}
                spellCheck={false}
              />
              <button className="btn-primary" onClick={copy}>
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <p className="modal-help">
              Anyone who opens this link will get your challenges loaded
              automatically. If it's a cloud-save file, the student-login
              prompt still shows first.
            </p>
          </>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
