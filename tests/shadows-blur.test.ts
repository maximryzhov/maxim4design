import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoxShadow, parseBlur } from '../src/extractor/effects-parser.ts';
import { applyEffects } from '../src/plugin/effects-applier.ts';
import type { FIRStyle } from '../src/types/fir.ts';

test('parseBoxShadow parses single, multiple and inset shadows', () => {
  // Simple drop shadow
  const shadow1 = parseBoxShadow('0px 4px 6px -1px rgba(0, 0, 0, 0.1)');
  assert.equal(shadow1.length, 1);
  assert.equal(shadow1[0].type, 'DROP_SHADOW');
  assert.equal(shadow1[0].offset.x, 0);
  assert.equal(shadow1[0].offset.y, 4);
  assert.equal(shadow1[0].radius, 6);
  assert.equal(shadow1[0].spread, -1);
  assert.deepEqual(shadow1[0].color, { r: 0, g: 0, b: 0, a: 0.1 });

  // Multiple comma-separated shadows
  const multiple = parseBoxShadow(
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
  );
  assert.equal(multiple.length, 2);
  assert.equal(multiple[0].radius, 15);
  assert.equal(multiple[1].radius, 6);

  // Inset shadow
  const inset = parseBoxShadow('inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)');
  assert.equal(inset.length, 1);
  assert.equal(inset[0].type, 'INNER_SHADOW');
  assert.equal(inset[0].offset.y, 2);
  assert.equal(inset[0].radius, 4);

  // Empty or none
  assert.deepEqual(parseBoxShadow('none'), []);
  assert.deepEqual(parseBoxShadow(''), []);
});

test('parseBlur extracts layer blur and backdrop blur', () => {
  const computed = {
    filter: 'blur(8px)',
    backdropFilter: 'blur(16px)',
  } as unknown as CSSStyleDeclaration;

  const result = parseBlur(computed);
  assert.equal(result.blur, 8);
  assert.equal(result.backgroundBlur, 16);
});

test('applyEffects applies native Figma DropShadow, InnerShadow and BackgroundBlur', () => {
  const mockNode: any = {
    effects: [],
  };

  const style: FIRStyle = {
    shadows: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.15 },
        offset: { x: 0, y: 8 },
        radius: 20,
        spread: -2,
        visible: true,
      },
      {
        type: 'INNER_SHADOW',
        color: { r: 1, g: 1, b: 1, a: 0.5 },
        offset: { x: 0, y: 1 },
        radius: 2,
        visible: true,
      },
    ],
    blur: 4,
    backgroundBlur: 24,
  };

  applyEffects(mockNode, style);

  assert.equal(mockNode.effects.length, 4);

  const dropShadow = mockNode.effects[0];
  assert.equal(dropShadow.type, 'DROP_SHADOW');
  assert.equal(dropShadow.offset.y, 8);
  assert.equal(dropShadow.radius, 20);
  assert.equal(dropShadow.spread, -2);

  const innerShadow = mockNode.effects[1];
  assert.equal(innerShadow.type, 'INNER_SHADOW');
  assert.equal(innerShadow.offset.y, 1);

  const layerBlur = mockNode.effects[2];
  assert.equal(layerBlur.type, 'LAYER_BLUR');
  assert.equal(layerBlur.radius, 4);

  const bgBlur = mockNode.effects[3];
  assert.equal(bgBlur.type, 'BACKGROUND_BLUR');
  assert.equal(bgBlur.radius, 24);
});
