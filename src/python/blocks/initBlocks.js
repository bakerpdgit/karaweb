// Build a serialised Blockly workspace state representing the auto-generated
// initialisation code: `kara = Ladybird(x, y, "direction")`.
//
// This is shown in a small read-only Blockly workspace above the user's
// editor, and is regenerated whenever the world's kara start position changes.

export function buildInitBlocklyState(world) {
  const { x, y, direction } = world.kara;
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'kara_init',
          id: 'kara_init',
          x: 10,
          y: 10,
          fields: { X: String(x), Y: String(y), DIR: String(direction) },
        },
      ],
    },
  };
}
