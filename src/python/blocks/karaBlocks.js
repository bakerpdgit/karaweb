// Kara-specific Blockly block definitions: actions and sensors.

import * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';

const KARA_ACTION_COLOUR = '#e11d48'; // rose-600
const KARA_SENSOR_COLOUR = '#16a34a'; // green-600

const ACTIONS = [
  { type: 'kara_move',        method: 'move',        label: '🐞 move' },
  { type: 'kara_turn_left',   method: 'turn_left',   label: '🐞 turn left' },
  { type: 'kara_turn_right',  method: 'turn_right',  label: '🐞 turn right' },
  { type: 'kara_put_leaf',    method: 'put_leaf',    label: '🐞 put leaf' },
  { type: 'kara_remove_leaf', method: 'remove_leaf', label: '🐞 remove leaf' },
];

const SENSORS = [
  { type: 'kara_tree_front',     method: 'tree_front',     label: 'tree in front?' },
  { type: 'kara_tree_left',      method: 'tree_left',      label: 'tree on left?' },
  { type: 'kara_tree_right',     method: 'tree_right',     label: 'tree on right?' },
  { type: 'kara_mushroom_front', method: 'mushroom_front', label: 'mushroom in front?' },
  { type: 'kara_on_leaf',        method: 'on_leaf',        label: 'on leaf?' },
];

export function registerKaraBlocks() {
  for (const { type, method, label } of ACTIONS) {
    if (Blockly.Blocks[type]) continue;
    Blockly.Blocks[type] = {
      init() {
        this.appendDummyInput().appendField(label);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(KARA_ACTION_COLOUR);
        this.setTooltip(`kara.${method}()`);
      },
    };
    pythonGenerator.forBlock[type] = function () {
      return `kara.${method}()\n`;
    };
  }

  for (const { type, method, label } of SENSORS) {
    if (Blockly.Blocks[type]) continue;
    Blockly.Blocks[type] = {
      init() {
        this.appendDummyInput().appendField(label);
        this.setOutput(true, 'Boolean');
        this.setColour(KARA_SENSOR_COLOUR);
        this.setTooltip(`kara.${method}()`);
      },
    };
    pythonGenerator.forBlock[type] = function () {
      return [`kara.${method}()`, Order.FUNCTION_CALL];
    };
  }

  // Read-only init block: shows "kara = Ladybird(x, y, direction)".
  if (!Blockly.Blocks['kara_init']) {
    Blockly.Blocks['kara_init'] = {
      init() {
        this.appendDummyInput()
          .appendField('kara = Ladybird(')
          .appendField(new Blockly.FieldLabelSerializable('0'), 'X')
          .appendField(',')
          .appendField(new Blockly.FieldLabelSerializable('0'), 'Y')
          .appendField(', "')
          .appendField(new Blockly.FieldLabelSerializable('right'), 'DIR')
          .appendField('")');
        this.setColour('#1e293b');
        this.setTooltip('Kara is created automatically from the world grid.');
      },
    };
    pythonGenerator.forBlock['kara_init'] = function (block) {
      const x = block.getFieldValue('X');
      const y = block.getFieldValue('Y');
      const dir = block.getFieldValue('DIR');
      return `kara = Ladybird(${x}, ${y}, "${dir}")\n`;
    };
  }
}

export const KARA_ACTION_TYPES = ACTIONS.map(a => a.type);
export const KARA_SENSOR_TYPES = SENSORS.map(s => s.type);
