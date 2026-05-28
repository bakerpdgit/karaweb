import React from 'react';

const TABS = [
  { id: 'challenges',  label: 'Challenges' },
  { id: 'teacherKeys', label: 'Teacher Keys' },
  { id: 'cloudSave',   label: 'Cloud Save' },
  { id: 'analyse',     label: 'Submissions' },
];

export default function EditorTabs({ activeTab, onChange, disabledHints }) {
  return (
    <div className="editor-tabs" role="tablist">
      {TABS.map(t => {
        const disabledReason = disabledHints?.[t.id];
        const isActive = t.id === activeTab;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            className={`editor-tab ${isActive ? 'active' : ''} ${disabledReason ? 'disabled' : ''}`}
            title={disabledReason || ''}
            disabled={!!disabledReason}
            onClick={() => !disabledReason && onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
