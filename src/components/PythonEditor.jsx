import React, { useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import RunnerOutputPanel from './RunnerOutputPanel.jsx';
import { registerKaraIntellisense } from '../python/monacoKaraIntellisense.js';
import { countPythonTokens } from '../utils/codeLimits.js';
import { useConfirmModal } from './ConfirmModal.jsx';

const FONT_SIZES = [10, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32];

export default function PythonEditor({ world, initWorld, python, runner, dispatch, pythonRunner, readOnly = false, pythonTokensCap = null }) {
  const monacoRef = useRef(null);
  const editorRef = useRef(null);
  const currentDecorationsRef = useRef([]);
  const errorDecorationsRef = useRef([]);
  const lastValidCodeRef = useRef(python.code ?? '');
  const capRef = useRef(pythonTokensCap);
  React.useEffect(() => { capRef.current = pythonTokensCap; }, [pythonTokensCap]);
  const restoringRef = useRef(false);
  const { alert: showAlert, modal: alertModal } = useConfirmModal();

  // Read-only init header — two lines the user can treat as already-present.
  // We use `initWorld` (frozen during a run) rather than the live `world` so
  // the displayed kara coordinates match what the running program started
  // with, not the live position as kara moves around mid-step.
  const headerWorld = initWorld ?? world;
  const initHeader = useMemo(() => {
    const { x, y, direction } = headerWorld.kara;
    return `from karaweb import Ladybird\nkara = Ladybird(${x}, ${y}, "${direction}")`;
  }, [headerWorld.kara]);

  const fontSize = python.fontSize ?? 14;

  // Track current-line + error-line decorations.
  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const decos = [];
    if (python.currentLine) {
      decos.push({
        range: new monaco.Range(python.currentLine, 1, python.currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-current-line',
          glyphMarginClassName: 'monaco-current-glyph',
        },
      });
    }
    currentDecorationsRef.current = editor.deltaDecorations(currentDecorationsRef.current, decos);
  }, [python.currentLine]);

  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const decos = [];
    if (python.errorLine) {
      decos.push({
        range: new monaco.Range(python.errorLine, 1, python.errorLine, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-error-line',
          glyphMarginClassName: 'monaco-error-glyph',
        },
      });
    }
    errorDecorationsRef.current = editor.deltaDecorations(errorDecorationsRef.current, decos);
  }, [python.errorLine]);

  const onEditorChange = (value) => {
    if (readOnly) return;
    if (restoringRef.current) return;
    const next = value ?? '';
    const cap = capRef.current;
    if (cap != null && countPythonTokens(next) > cap) {
      // Over the token cap — restore the last valid code in the
      // Monaco buffer and tell the student.
      restoringRef.current = true;
      try {
        const editor = editorRef.current;
        if (editor) editor.setValue(lastValidCodeRef.current);
      } finally {
        // Monaco's setValue fires another onChange synchronously;
        // the restoringRef guard above short-circuits that one.
        queueMicrotask(() => { restoringRef.current = false; });
      }
      showAlert({
        message: `You've reached the ${cap}-token limit for this challenge. Remove some code before adding more.`,
      });
      return;
    }
    lastValidCodeRef.current = next;
    dispatch({ type: 'PYC_SET_CODE', code: next, markDirty: true });
  };

  return (
    <div className="python-editor python-editor-monaco">
      <div className="python-init-banner">
        <div className="python-init-label">Initialization (auto from world — read-only)</div>
        <pre className="python-init-code">{initHeader}</pre>
      </div>

      <div className="python-mono-toolbar">
        <span className="python-mono-label">Font size:</span>
        <button
          className="python-mono-btn"
          title="Decrease font size"
          onClick={() => {
            const idx = FONT_SIZES.indexOf(fontSize);
            const next = idx > 0 ? FONT_SIZES[idx - 1] : FONT_SIZES[0];
            dispatch({ type: 'PYC_SET_FONT_SIZE', fontSize: next });
          }}
        >A−</button>
        <button
          className="python-mono-btn"
          title="Increase font size"
          onClick={() => {
            const idx = FONT_SIZES.indexOf(fontSize);
            const next = idx >= 0 && idx < FONT_SIZES.length - 1 ? FONT_SIZES[idx + 1] : FONT_SIZES[FONT_SIZES.length - 1];
            dispatch({ type: 'PYC_SET_FONT_SIZE', fontSize: next });
          }}
        >A+</button>
        <select
          className="python-mono-select"
          value={fontSize}
          onChange={e => dispatch({ type: 'PYC_SET_FONT_SIZE', fontSize: +e.target.value })}
        >
          {FONT_SIZES.map(s => (<option key={s} value={s}>{s} px</option>))}
        </select>
      </div>

      <div className="python-monaco-host">
        <Editor
          language="python"
          theme="vs"
          value={python.code || ''}
          onChange={onEditorChange}
          beforeMount={(monaco) => registerKaraIntellisense(monaco)}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
            registerKaraIntellisense(monaco);
          }}
          options={{
            fontSize,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 4,
            insertSpaces: true,
            automaticLayout: true,
            renderWhitespace: 'selection',
            wordWrap: 'on',
            scrollbar: { vertical: 'auto', horizontal: 'auto' },
            lineNumbers: 'on',
            readOnly,
          }}
        />
      </div>

      <RunnerOutputPanel runner={runner} dispatch={dispatch} pythonRunner={pythonRunner} />
      {alertModal}
    </div>
  );
}
