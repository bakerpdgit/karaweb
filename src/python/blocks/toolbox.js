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
