import React from 'react';
import MarkdownView from './MarkdownView.jsx';

export default function NotesPanel({ markdown, onClose }) {
  return (
    <div className="notes-panel">
      <div className="notes-header">
        <span className="notes-title">Notes</span>
        <button className="notes-close" onClick={onClose} title="Close notes">✕</button>
      </div>
      <div className="notes-body">
        <MarkdownView markdown={markdown} />
      </div>
    </div>
  );
}
