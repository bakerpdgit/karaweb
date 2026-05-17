// Blocks (Blockly JSON) and Python solutions for each example, so loading an
// example also populates a working solution in the current mode.
//
// Blockly states are structurally minimal — they describe the block tree using
// the same shape Blockly.serialization.workspaces.save produces.

// ── Example 1: Left-Turn Pathfinder ──────────────────────────────────────────
// While Kara doesn't see a leaf: if tree front turn left, else move.
// When on leaf: remove leaf.
//
// Pseudocode equivalent:
//   while not kara.on_leaf():
//       if kara.tree_front():
//           kara.turn_left()
//       else:
//           kara.move()
//   kara.remove_leaf()
export const EX1_PYTHON = `while not kara.on_leaf():
    if kara.tree_front():
        kara.turn_left()
    else:
        kara.move()
kara.remove_leaf()
`;

export const EX1_BLOCKS = {
  blocks: { languageVersion: 0, blocks: [{
    type: 'controls_whileUntil',
    id: 'ex1_while',
    x: 30, y: 30,
    fields: { MODE: 'WHILE' },
    inputs: {
      BOOL: { block: { type: 'logic_negate', id: 'ex1_neg', inputs: {
        BOOL: { block: { type: 'kara_on_leaf', id: 'ex1_onleaf' } },
      }}},
      DO: { block: {
        type: 'controls_if',
        id: 'ex1_if',
        extraState: { hasElse: true },
        inputs: {
          IF0: { block: { type: 'kara_tree_front', id: 'ex1_tf' } },
          DO0: { block: { type: 'kara_turn_left', id: 'ex1_tl' } },
          ELSE: { block: { type: 'kara_move', id: 'ex1_mv' } },
        },
      }},
    },
    next: { block: { type: 'kara_remove_leaf', id: 'ex1_rl' } },
  }]},
};

// ── Example 2: Row Harvester ─────────────────────────────────────────────────
// Pattern: while moving forward, if on leaf remove leaf. If mushroom in front
// then either turn around (two turn_lefts) or stop (we've already turned).
// In Python we keep a `direction` flag instead of explicit states.
export const EX2_PYTHON = `done = False
turned = False
while not done:
    if kara.on_leaf():
        kara.remove_leaf()
    elif kara.mushroom_front():
        if turned:
            done = True
        else:
            kara.turn_left()
            kara.turn_left()
            turned = True
    else:
        kara.move()
`;

export const EX2_BLOCKS = {
  blocks: { languageVersion: 0, blocks: [
    // done = False
    { type: 'variables_set', id: 'ex2_v1', x: 20, y: 20,
      fields: { VAR: { id: 'var_done', name: 'done' } },
      inputs: { VALUE: { block: { type: 'logic_boolean', id: 'ex2_v1b', fields: { BOOL: 'FALSE' } } } },
      next: { block: {
        // turned = False
        type: 'variables_set', id: 'ex2_v2',
        fields: { VAR: { id: 'var_turned', name: 'turned' } },
        inputs: { VALUE: { block: { type: 'logic_boolean', id: 'ex2_v2b', fields: { BOOL: 'FALSE' } } } },
        next: { block: {
          // while not done
          type: 'controls_whileUntil',
          id: 'ex2_w',
          fields: { MODE: 'WHILE' },
          inputs: {
            BOOL: { block: { type: 'logic_negate', id: 'ex2_wn', inputs: {
              BOOL: { block: { type: 'variables_get', id: 'ex2_wg',
                fields: { VAR: { id: 'var_done', name: 'done' } } } },
            }}},
            DO: { block: {
              type: 'controls_if',
              id: 'ex2_if',
              extraState: { elseIfCount: 1, hasElse: true },
              inputs: {
                IF0: { block: { type: 'kara_on_leaf', id: 'ex2_if_c0' } },
                DO0: { block: { type: 'kara_remove_leaf', id: 'ex2_if_d0' } },
                IF1: { block: { type: 'kara_mushroom_front', id: 'ex2_if_c1' } },
                DO1: { block: {
                  type: 'controls_if',
                  id: 'ex2_innif',
                  extraState: { hasElse: true },
                  inputs: {
                    IF0: { block: { type: 'variables_get', id: 'ex2_innif_g',
                      fields: { VAR: { id: 'var_turned', name: 'turned' } } } },
                    DO0: { block: { type: 'variables_set', id: 'ex2_setdone',
                      fields: { VAR: { id: 'var_done', name: 'done' } },
                      inputs: { VALUE: { block: { type: 'logic_boolean', id: 'ex2_truedone', fields: { BOOL: 'TRUE' } } } },
                    }},
                    ELSE: { block: { type: 'kara_turn_left', id: 'ex2_tl1', next: { block: {
                      type: 'kara_turn_left', id: 'ex2_tl2', next: { block: {
                        type: 'variables_set', id: 'ex2_setturn',
                        fields: { VAR: { id: 'var_turned', name: 'turned' } },
                        inputs: { VALUE: { block: { type: 'logic_boolean', id: 'ex2_trueturn', fields: { BOOL: 'TRUE' } } } },
                      }},
                    }}}},
                  },
                }},
                ELSE: { block: { type: 'kara_move', id: 'ex2_if_e' } },
              },
            }},
          },
        }},
      }},
    },
  ]},
};

// ── Example 3: Forest Circler ────────────────────────────────────────────────
// Right-hand rule. If no tree on the right, turn right and try to step. Else
// if blocked ahead, turn left. Else move.
export const EX3_PYTHON = `while True:
    if not kara.tree_right():
        kara.turn_right()
        if not kara.tree_front():
            kara.move()
    elif kara.tree_front():
        kara.turn_left()
    else:
        kara.move()
`;

export const EX3_BLOCKS = {
  blocks: { languageVersion: 0, blocks: [{
    type: 'controls_whileUntil',
    id: 'ex3_w',
    x: 20, y: 20,
    fields: { MODE: 'WHILE' },
    inputs: {
      BOOL: { block: { type: 'logic_boolean', id: 'ex3_true', fields: { BOOL: 'TRUE' } } },
      DO: { block: {
        type: 'controls_if',
        id: 'ex3_if',
        extraState: { elseIfCount: 1, hasElse: true },
        inputs: {
          IF0: { block: { type: 'logic_negate', id: 'ex3_n', inputs: {
            BOOL: { block: { type: 'kara_tree_right', id: 'ex3_tr' } },
          }}},
          DO0: { block: { type: 'kara_turn_right', id: 'ex3_tr1', next: { block: {
            type: 'controls_if', id: 'ex3_innif',
            inputs: {
              IF0: { block: { type: 'logic_negate', id: 'ex3_innn', inputs: {
                BOOL: { block: { type: 'kara_tree_front', id: 'ex3_inntf' } },
              }}},
              DO0: { block: { type: 'kara_move', id: 'ex3_innmv' } },
            },
          }}}},
          IF1: { block: { type: 'kara_tree_front', id: 'ex3_tf' } },
          DO1: { block: { type: 'kara_turn_left', id: 'ex3_tl' } },
          ELSE: { block: { type: 'kara_move', id: 'ex3_mv' } },
        },
      }},
    },
  }]},
};

// ── Example 4: Mushroom Pusher ───────────────────────────────────────────────
export const EX4_PYTHON = `while not kara.on_leaf():
    kara.move()
kara.remove_leaf()
`;

export const EX4_BLOCKS = {
  blocks: { languageVersion: 0, blocks: [{
    type: 'controls_whileUntil',
    id: 'ex4_w',
    x: 20, y: 20,
    fields: { MODE: 'WHILE' },
    inputs: {
      BOOL: { block: { type: 'logic_negate', id: 'ex4_n', inputs: {
        BOOL: { block: { type: 'kara_on_leaf', id: 'ex4_ol' } },
      }}},
      DO: { block: { type: 'kara_move', id: 'ex4_mv' } },
    },
    next: { block: { type: 'kara_remove_leaf', id: 'ex4_rl' } },
  }]},
};
