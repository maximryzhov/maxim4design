import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBorderRadius,
  parseBorders,
  extractElementStyles,
} from '../src/extractor/style-extractor.ts';
import { applyStyles } from '../src/plugin/style-applier.ts';
import type { FIRStyle } from '../src/types/fir.ts';

test('parseBorderRadius handles uniform and non-uniform values', () => {
  const uniformComputed = {
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    borderBottomRightRadius: '8px',
    borderBottomLeftRadius: '8px',
  } as unknown as CSSStyleDeclaration;

  assert.deepEqual(parseBorderRadius(uniformComputed), {
    topLeft: 8,
    topRight: 8,
    bottomRight: 8,
    bottomLeft: 8,
  });

  const asymmetricComputed = {
    borderTopLeftRadius: '12px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '6px',
    borderBottomLeftRadius: '4px',
  } as unknown as CSSStyleDeclaration;

  assert.deepEqual(parseBorderRadius(asymmetricComputed), {
    topLeft: 12,
    topRight: 0,
    bottomRight: 6,
    bottomLeft: 4,
  });

  const zeroComputed = {
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
  } as unknown as CSSStyleDeclaration;

  assert.equal(parseBorderRadius(zeroComputed), undefined);
});

test('parseBorders parses four independent sides with colors and styles', () => {
  const borderComputed = {
    borderTopWidth: '0px',
    borderTopColor: 'rgb(0, 0, 0)',
    borderTopStyle: 'none',
    borderRightWidth: '0px',
    borderRightColor: 'rgb(0, 0, 0)',
    borderRightStyle: 'none',
    borderBottomWidth: '2px',
    borderBottomColor: 'rgb(24, 160, 251)',
    borderBottomStyle: 'solid',
    borderLeftWidth: '0px',
    borderLeftColor: 'rgb(0, 0, 0)',
    borderLeftStyle: 'none',
  } as unknown as CSSStyleDeclaration;

  const borders = parseBorders(borderComputed);
  assert.ok(borders);
  assert.equal(borders.bottom.width, 2);
  assert.deepEqual(borders.bottom.color, { r: 0.0941, g: 0.6275, b: 0.9843, a: 1 });
  assert.equal(borders.bottom.style, 'solid');
  assert.equal(borders.top.width, 0);
});

test('applyStyles applies uniform and independent corner radii and strokes', () => {
  const mockNode: any = {
    fills: [],
    strokes: [],
    cornerRadius: 0,
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomRightRadius: 0,
    bottomLeftRadius: 0,
    strokeTopWeight: 0,
    strokeRightWeight: 0,
    strokeBottomWeight: 0,
    strokeLeftWeight: 0,
    clipsContent: false,
    dashPattern: [],
  };

  const style: FIRStyle = {
    backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
    borderRadius: {
      topLeft: 16,
      topRight: 16,
      bottomRight: 0,
      bottomLeft: 0,
    },
    borders: {
      top: { width: 0, color: { r: 0, g: 0, b: 0, a: 1 }, style: 'none' },
      right: { width: 0, color: { r: 0, g: 0, b: 0, a: 1 }, style: 'none' },
      bottom: { width: 3, color: { r: 1, g: 0, b: 0, a: 1 }, style: 'dashed' },
      left: { width: 0, color: { r: 0, g: 0, b: 0, a: 1 }, style: 'none' },
    },
  };

  applyStyles(mockNode, style, true);

  assert.equal(mockNode.clipsContent, true);
  assert.equal(mockNode.fills.length, 1);
  assert.equal(mockNode.topLeftRadius, 16);
  assert.equal(mockNode.bottomRightRadius, 0);

  assert.equal(mockNode.strokes.length, 1);
  assert.equal(mockNode.strokeBottomWeight, 3);
  assert.equal(mockNode.strokeTopWeight, 0);
  assert.deepEqual(mockNode.dashPattern, [4, 4]);
});
