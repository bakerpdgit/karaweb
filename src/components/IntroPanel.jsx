import React from 'react';
import MarkdownView from './MarkdownView.jsx';

/**
 * Standalone "Intro" panel that sits below the World/Target/Notes
 * tabbed panel. Renders the file-level introduction markdown. The
 * caller decides when to show it (typically hidden once the student
 * has loaded a challenge book — they don't need the welcome intro
 * cluttering the view).
 */
export default function IntroPanel({ markdown, onClose }) {
  if (!markdown || !markdown.trim()) return null;
  return (
    <div className="panel intro-panel">
      <div className="ctx-panel-header">
        <div className="ctx-panel-title">ℹ Intro</div>
        {onClose && (
          <button className="ctx-panel-close" onClick={onClose} title="Hide this panel">✕</button>
        )}
      </div>
      <div className="ctx-notes intro-panel-body">
        <MarkdownView markdown={markdown} />
      </div>
    </div>
  );
}
