import React, { useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import RunnerOutputPanel from './RunnerOutputPanel.jsx';
import { registerKaraIntellisense } from '../python/monacoKaraIntellisense.js';
import { countPythonTokens } from '../utils/codeLimits.js';
import { useConfirmModal } from './ConfirmModal.jsx';

// Two read-only init lines are rendered in their own Monaco editor with
// line numbers 1–2; the student editor offsets its line numbers by this
// amount so 'line 1' of student code is displayed as line 3 in the gutter.
const INIT_LINE_COUNT = 2;

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

  // Track current-line + error-line decorations. The runner reports
  // line numbers in *student-code* coordinates (1 = first student line),
  // but Monaco's editor model knows nothing about the read-only init
  // header above it — student line N corresponds to Monaco range row N.
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
        <div
          className="python-init-monaco-host"
          style={{ height: fontSize * 1.5 * INIT_LINE_COUNT + 6 }}
        >
          <Editor
            language="python"
            theme="vs"
            value={initHeader}
            options={{
              fontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              scrollBeyondLastColumn: 0,
              tabSize: 4,
              insertSpaces: true,
              automaticLayout: true,
              wordWrap: 'off',
              scrollbar: { vertical: 'hidden', horizontal: 'hidden', handleMouseWheel: false },
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              glyphMargin: false,
              folding: false,
              readOnly: true,
              domReadOnly: true,
              renderLineHighlight: 'none',
              contextmenu: false,
              overviewRulerBorder: false,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
            }}
          />
        </div>
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
            lineNumbers: (n) => String(n + INIT_LINE_COUNT),
            lineNumbersMinChars: 3,
            readOnly,
          }}
        />
      </div>

      <RunnerOutputPanel runner={runner} dispatch={dispatch} pythonRunner={pythonRunner} />
      {alertModal}
    </div>
  );
}
