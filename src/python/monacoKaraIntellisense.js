// Monaco IntelliSense for Kara/Ladybird.
//
// Registers a Python completion provider that fires on `.` after any local
// variable known to hold a Ladybird instance, plus a hover provider that
// shows method docs over the methods themselves.
//
// "Known to hold a Ladybird instance" means either:
//   - the variable is literally `kara` (the auto-init binding), or
//   - the same source contains an earlier line of the form
//     `<name> = Ladybird(...)` (with or without `karaweb.` qualifier).

const KARA_METHODS = [
  { name: 'move',           sig: 'move()',           doc: 'Move kara one cell forward. Raises an error if blocked by a tree. Pushes a mushroom if there’s space behind it.', returns: 'None' },
  { name: 'turn_left',      sig: 'turn_left()',      doc: 'Rotate kara 90° to the left (anti-clockwise).', returns: 'None' },
  { name: 'turn_right',     sig: 'turn_right()',     doc: 'Rotate kara 90° to the right (clockwise).', returns: 'None' },
  { name: 'put_leaf',       sig: 'put_leaf()',       doc: 'Drop a leaf on the cell kara is standing on.', returns: 'None' },
  { name: 'remove_leaf',    sig: 'remove_leaf()',    doc: 'Pick up the leaf from the cell kara is standing on. Errors if there isn’t one.', returns: 'None' },
  { name: 'tree_front',     sig: 'tree_front()',     doc: 'True if the cell directly in front of kara contains a tree.', returns: 'bool' },
  { name: 'tree_left',      sig: 'tree_left()',      doc: 'True if the cell directly to kara’s left contains a tree.', returns: 'bool' },
  { name: 'tree_right',     sig: 'tree_right()',     doc: 'True if the cell directly to kara’s right contains a tree.', returns: 'bool' },
  { name: 'mushroom_front', sig: 'mushroom_front()', doc: 'True if the cell directly in front of kara contains a mushroom.', returns: 'bool' },
  { name: 'on_leaf',        sig: 'on_leaf()',        doc: 'True if kara is standing on a cell that has a leaf.', returns: 'bool' },
];

const VAR_RE = /(?:^|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*)\.$/;
const LADYBIRD_BIND_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:karaweb\.)?Ladybird\s*\(/m;

function ladybirdNames(modelText) {
  const names = new Set(['kara']);
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:karaweb\.)?Ladybird\s*\(/gm;
  let m;
  while ((m = re.exec(modelText)) !== null) names.add(m[1]);
  return names;
}

let registered = false;

export function registerKaraIntellisense(monaco) {
  if (registered) return;
  registered = true;

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const lineUpToCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const varMatch = VAR_RE.exec(lineUpToCursor);
      if (!varMatch) return { suggestions: [] };
      const varName = varMatch[1];
      const names = ladybirdNames(model.getValue());
      if (!names.has(varName)) return { suggestions: [] };

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      };

      return {
        suggestions: KARA_METHODS.map(m => ({
          label: { label: m.name, detail: ` ${m.sig.replace(m.name, '')} → ${m.returns}`, description: 'Ladybird' },
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: `${m.name}()`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace,
          range,
          detail: `${m.sig} → ${m.returns}`,
          documentation: { value: m.doc },
        })),
      };
    },
  });

  // Hover provider: show docs when the cursor sits on `kara.move`-style usages.
  monaco.languages.registerHoverProvider('python', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const method = KARA_METHODS.find(m => m.name === word.word);
      if (!method) return null;
      // Make sure the word follows `<known-name>.`
      const line = model.getLineContent(position.lineNumber);
      const before = line.slice(0, word.startColumn - 1);
      const m = /([A-Za-z_][A-Za-z0-9_]*)\.\s*$/.exec(before);
      if (!m) return null;
      const names = ladybirdNames(model.getValue());
      if (!names.has(m[1])) return null;
      return {
        range: new monaco.Range(
          position.lineNumber, word.startColumn,
          position.lineNumber, word.endColumn,
        ),
        contents: [
          { value: `**Ladybird.${method.sig}** → \`${method.returns}\`` },
          { value: method.doc },
        ],
      };
    },
  });

  // Also register `Ladybird` itself for hover docs.
  monaco.languages.registerHoverProvider('python', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word || word.word !== 'Ladybird') return null;
      return {
        range: new monaco.Range(
          position.lineNumber, word.startColumn,
          position.lineNumber, word.endColumn,
        ),
        contents: [
          { value: '**Ladybird(x, y, direction)**' },
          { value:
            'The programmable ladybird. Direction is one of `"right"`, `"down"`, `"left"`, `"up"`.\n\n' +
            'Methods: ' + KARA_METHODS.map(m => `\`${m.name}()\``).join(', ') + '.' },
        ],
      };
    },
  });
}
