import React from 'react';

/**
 * Pinned-at-top banner shown when /version.json reports a newer build
 * than the one this tab is running (see src/utils/updateCheck.js).
 *
 * Pure presentational — App.jsx owns the visibility flag and the
 * reload action. Banner stays until the user clicks Reload or closes
 * the tab; no "remind me later".
 */
export default function UpdateBanner({ onReload }) {
  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner-text">
        ✨ A new version of KaraWeb is available — please reload to get the latest.
      </span>
      <button
        className="update-banner-action"
        onClick={onReload}
        type="button"
      >
        🔄 Reload now
      </button>
    </div>
  );
}
