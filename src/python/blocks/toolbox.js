// Toolbox configuration for the Python Blocks mode.
//
// Categories mirror the simple-Python subset specified in the plan:
//   - Kara (custom blocks, actions + sensors)
//   - Logic (if / comparisons / boolean ops / literals)
//   - Loops (while / for-in-range)
//   - Math (numbers + arithmetic)
//   - Text (string literal + concatenation + len)
//   - Lists (literal + append / get / set / len)
//   - Variables (Blockly built-in, dynamic typed flyout)
//   - Functions (Blockly built-in, mutator-driven)

export const toolboxJson = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Kara',
      colour: '#e11d48',
      contents: [
        { kind: 'block', type: 'kara_move' },
        { kind: 'block', type: 'kara_turn_left' },
        { kind: 'block', type: 'kara_turn_right' },
        { kind: 'block', type: 'kara_put_leaf' },
        { kind: 'block', type: 'kara_remove_leaf' },
        { kind: 'label', text: 'Sensors' },
        { kind: 'block', type: 'kara_tree_front' },
        { kind: 'block', type: 'kara_tree_left' },
        { kind: 'block', type: 'kara_tree_right' },
        { kind: 'block', type: 'kara_mushroom_front' },
        { kind: 'block', type: 'kara_on_leaf' },
      ],
    },
    {
      kind: 'category',
      name: 'Logic',
      colour: '#5b67a5',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      colour: '#5ba55b',
      contents: [
        { kind: 'block', type: 'controls_whileUntil' },
        {
          kind: 'block',
          type: 'controls_for',
          inputs: {
            FROM: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
            TO:   { shadow: { type: 'math_number', fields: { NUM: 10 } } },
            BY:   { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          },
        },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: '#5b80a5',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_round' },
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      colour: '#a55b80',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length' },
      ],
    },
    {
      kind: 'category',
      name: 'Lists',
      colour: '#745ba5',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' },
        { kind: 'block', type: 'lists_repeat' },
      ],
    },
    {
      kind: 'category',
      name: 'Variables',
      colour: '#a55b99',
      custom: 'VARIABLE',
    },
    {
      kind: 'category',
      name: 'Functions',
      colour: '#995ba5',
      custom: 'PROCEDURE',
    },
  ],
};

// Human-readable catalogue used by the "Allowed blocks" management
// modal. Mirrors `toolboxJson` but skips `Variables` / `Functions`
// (those are `custom` dynamic flyouts with no per-block entries to
// toggle individually) and skips `label` entries.
export const DISABLEABLE_BLOCKS = [
  { category: 'Kara', colour: '#e11d48', blocks: [
    { type: 'kara_move',           label: 'move' },
    { type: 'kara_turn_left',      label: 'turn left' },
    { type: 'kara_turn_right',     label: 'turn right' },
    { type: 'kara_put_leaf',       label: 'put leaf' },
    { type: 'kara_remove_leaf',    label: 'remove leaf' },
    { type: 'kara_tree_front',     label: 'tree front?' },
    { type: 'kara_tree_left',      label: 'tree left?' },
    { type: 'kara_tree_right',     label: 'tree right?' },
    { type: 'kara_mushroom_front', label: 'mushroom front?' },
    { type: 'kara_on_leaf',        label: 'on leaf?' },
  ]},
  { category: 'Logic', colour: '#5b67a5', blocks: [
    { type: 'controls_if',    label: 'if' },
    { type: 'logic_compare',  label: 'compare (=, <, >, …)' },
    { type: 'logic_operation', label: 'and / or' },
    { type: 'logic_negate',   label: 'not' },
    { type: 'logic_boolean',  label: 'true / false' },
  ]},
  { category: 'Loops', colour: '#5ba55b', blocks: [
    { type: 'controls_whileUntil', label: 'while / until' },
    { type: 'controls_for',        label: 'for from … to …' },
  ]},
  { category: 'Math', colour: '#5b80a5', blocks: [
    { type: 'math_number',     label: 'number' },
    { type: 'math_arithmetic', label: '+ − × ÷ ^' },
    { type: 'math_modulo',     label: 'modulo (remainder)' },
    { type: 'math_round',      label: 'round' },
  ]},
  { category: 'Text', colour: '#a55b80', blocks: [
    { type: 'text',         label: 'text literal' },
    { type: 'text_join',    label: 'join text' },
    { type: 'text_length',  label: 'text length' },
  ]},
  { category: 'Lists', colour: '#745ba5', blocks: [
    { type: 'lists_create_with', label: 'create list' },
    { type: 'lists_length',      label: 'list length' },
    { type: 'lists_getIndex',    label: 'get item from list' },
    { type: 'lists_setIndex',    label: 'set item in list' },
    { type: 'lists_repeat',      label: 'repeat item' },
  ]},
];

// Return a copy of `toolbox` with every block whose `type` appears in
// `disallowed` removed. Categories that end up with no blocks (and no
// `custom` flyout) are dropped entirely. Label entries are kept as-is.
// When `disallowed` is empty / nullish, returns the original reference
// unchanged so callers pay no cost in the common case.
export function filterToolbox(toolbox, disallowed) {
  if (!disallowed || disallowed.length === 0) return toolbox;
  const banned = new Set(disallowed);
  const filterCategory = (cat) => {
    if (!Array.isArray(cat.contents)) return cat;
    const kept = cat.contents.filter(item =>
      !(item?.kind === 'block' && banned.has(item.type))
    );
    // Drop a label that no longer heads any block — removing all the
    // sensors would otherwise leave a bare "Sensors" heading behind.
    const contents = kept.filter((item, i) => {
      if (item?.kind !== 'label') return true;
      for (let j = i + 1; j < kept.length; j++) {
        if (kept[j]?.kind === 'label') return false;
        if (kept[j]?.kind === 'block') return true;
      }
      return false;
    });
    const hasAnyBlock = contents.some(item => item?.kind === 'block');
    if (!hasAnyBlock && !cat.custom) return null;
    return { ...cat, contents };
  };
  const contents = (toolbox.contents || [])
    .map(item => item?.kind === 'category' ? filterCategory(item) : item)
    .filter(Boolean);
  return { ...toolbox, contents };
}
