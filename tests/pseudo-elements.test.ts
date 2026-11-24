import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPseudoElement } from '../src/extractor/pseudo-extractor.ts';
import { extractFIRFromElement } from '../src/extractor/dom-extractor.ts';
import type { FIRBounds } from '../src/types/fir.ts';

test('extractPseudoElement returns undefined when content is none or empty without dimensions', () => {
  (globalThis as any).window = {
    getComputedStyle: () => ({
      content: 'none',
      width: '0px',
      height: '0px',
      display: 'inline',
    }),
  };

  const parentBounds: FIRBounds = { x: 0, y: 0, width: 100, height: 50 };
  const result = extractPseudoElement({} as HTMLElement, '::before', parentBounds);
  assert.equal(result, undefined);
});

test('extractPseudoElement extracts icon character as TEXT node', () => {
  (globalThis as any).window = {
    getComputedStyle: () => ({
      content: '"\\f005"', // star icon glyph
      color: 'rgb(255, 204, 0)',
      fontSize: '18px',
      fontWeight: '900',
      fontFamily: '"Font Awesome 5 Free"',
      display: 'inline-block',
      width: '18px',
      height: '18px',
    }),
  };

  const parentBounds: FIRBounds = { x: 20, y: 30, width: 24, height: 24 };
  const result = extractPseudoElement({ id: 'btn-star' } as HTMLElement, '::before', parentBounds);

  assert.ok(result);
  assert.equal(result.type, 'TEXT');
  assert.equal(result.name, '::before');
  assert.equal(result.textData?.characters, '\\f005');
  assert.equal(result.textData?.segments[0].fontSize, 18);
  assert.deepEqual(result.textData?.segments[0].color, { r: 1, g: 0.8, b: 0, a: 1 });
});

test('extractPseudoElement extracts decorative divider as RECTANGLE node', () => {
  (globalThis as any).window = {
    getComputedStyle: () => ({
      content: '""',
      display: 'block',
      position: 'absolute',
      width: '100px',
      height: '2px',
      top: '48px',
      left: '0px',
      backgroundColor: 'rgb(24, 160, 251)',
    }),
  };

  const parentBounds: FIRBounds = { x: 10, y: 20, width: 100, height: 50 };
  const result = extractPseudoElement({ id: 'header' } as HTMLElement, '::after', parentBounds);

  assert.ok(result);
  assert.equal(result.type, 'RECTANGLE');
  assert.equal(result.name, '::after');
  assert.equal(result.bounds.y, 68); // 20 + 48
  assert.equal(result.bounds.height, 2);
  assert.ok(result.style?.backgroundColor);
});
