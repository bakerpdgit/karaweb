// Pre-run syntax-style validation for Blockly workspaces.
//
// Walks the serialized state (the JSON Blockly produces via
// `Blockly.serialization.workspaces.save`) and reports blocks whose
// required inputs are empty — for example a `while` block with no
// condition or a `logic_compare` with no operands.
//
// Returns an array of issues:
//   [{ blockId, blockType, inputName, message }]
//
// `message` is a teacher / student-friendly sentence describing the
// problem so it can be shown verbatim in an alert banner.

// Rule table: for each block type, which inputs MUST be connected
// to a non-shadow block (or have a valid shadow default).
//
// Shadow defaults count as valid: e.g. math_arithmetic A & B have
// math_number shadows that emit "0" — Python compiles fine. Only
// inputs that lack BOTH a shadow AND a real block are flagged.
const REQUIRED_INPUTS = {
  controls_whileUntil: [
    { input: 'BOOL', desc: 'condition (a true/false test)' },
  ],
  logic_compare: [
    { input: 'A', desc: 'left value' },
    { input: 'B', desc: 'right value' },
  ],
  logic_operation: [
    { input: 'A', desc: 'left value' },
    { input: 'B', desc: 'right value' },
  ],
  logic_negate: [
    { input: 'BOOL', desc: 'value to negate' },
  ],
  math_arithmetic: [
    { input: 'A', desc: 'left number' },
    { input: 'B', desc: 'right number' },
  ],
  math_modulo: [
    { input: 'DIVIDEND', desc: 'dividend' },
    { input: 'DIVISOR',  desc: 'divisor'  },
  ],
  variables_set: [
    { input: 'VALUE', desc: 'value to assign' },
  ],
};

// Friendly name for each block type when we describe a problem.
const BLOCK_LABEL = {
  controls_whileUntil: 'while / until loop',
  controls_if:         'if statement',
  logic_compare:       'compare (=, <, …)',
  logic_operation:     'and / or',
  logic_negate:        'not',
  math_arithmetic:     'arithmetic (+, −, …)',
  math_modulo:         'modulo (remainder)',
  variables_set:       'set-variable',
};

function isInputFilled(slot) {
  if (!slot) return false;
  // A real connected block wins; otherwise a shadow placeholder
  // counts as "filled" (provides a default value).
  return !!(slot.block || slot.shadow);
}

function describeBlock(type) {
  return BLOCK_LABEL[type] || type;
}

function walkBlock(block, issues) {
  if (!block || typeof block !== 'object') return;

  // 1. Check the type-specific required-input rules.
  const required = REQUIRED_INPUTS[block.type];
  if (required) {
    for (const { input, desc } of required) {
      if (!isInputFilled(block.inputs?.[input])) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          inputName: input,
          message: `${describeBlock(block.type)} is missing its ${desc}.`,
        });
      }
    }
  }

  // 2. controls_if is variable-arity. Every IF<n> branch needs a
  //    condition; DO<n> bodies and ELSE are allowed to be empty (a
  //    branch with nothing in it is valid even if unusual).
  if (block.type === 'controls_if') {
    const extra = block.extraState || {};
    const elseIfCount = Number(extra.elseIfCount) || 0;
    for (let i = 0; i <= elseIfCount; i++) {
      const slotName = `IF${i}`;
      if (!isInputFilled(block.inputs?.[slotName])) {
        issues.push({
          blockId: block.id,
          blockType: block.type,
          inputName: slotName,
          message: `if statement is missing the condition for branch ${i + 1}.`,
        });
      }
    }
  }

  // 3. Recurse into every nested block (inputs + next-chain).
  if (block.inputs) {
    for (const slot of Object.values(block.inputs)) {
      if (slot?.block) walkBlock(slot.block, issues);
      // Shadow blocks are placeholders, not user blocks — skip walking.
    }
  }
  if (block.next?.block) walkBlock(block.next.block, issues);
}

/**
 * Walk a serialized Blockly workspace state. Returns [] when everything's
 * fine. Returns an issue list otherwise (in workspace order).
 */
export function validateBlocksState(state) {
  if (!state || !state.blocks || !Array.isArray(state.blocks.blocks)) {
    return [];
  }
  const issues = [];
  for (const root of state.blocks.blocks) {
    walkBlock(root, issues);
  }
  return issues;
}

/**
 * Build a single-line human-readable summary string from an issue
 * list — short enough to fit the existing error banner. The full
 * details appear as warning bubbles on the individual blocks.
 */
export function summariseIssues(issues, maxItems = 2) {
  if (!issues || issues.length === 0) return '';
  const heads = issues.slice(0, maxItems).map(i => i.message);
  const tail = issues.length > maxItems
    ? ` (and ${issues.length - maxItems} more — hover the ⚠ bubbles on the highlighted blocks for details)`
    : ' (hover the ⚠ bubble on the highlighted block for details)';
  return `Cannot run yet — ${heads.join(' ')}${tail}`;
}
