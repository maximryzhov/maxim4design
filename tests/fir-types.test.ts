import test from 'node:test';
import assert from 'node:assert/strict';
import type { FIRNode } from '../src/types/fir.ts';
import {
  isFIRNode,
  isRGBAColor,
  isFIRBounds,
  validateFIRTree,
} from '../src/types/fir.ts';

test('isRGBAColor validates color objects', () => {
  assert.equal(isRGBAColor({ r: 0.5, g: 0.2, b: 1, a: 1 }), true);
  assert.equal(isRGBAColor({ r: 1.5, g: 0, b: 0, a: 1 }), false);
  assert.equal(isRGBAColor({ r: 0, g: 0, b: 0 }), false);
  assert.equal(isRGBAColor('rgba(0,0,0,1)'), false);
  assert.equal(isRGBAColor(null), false);
});

test('isFIRBounds validates bounding box', () => {
  assert.equal(isFIRBounds({ x: 0, y: 10, width: 100, height: 200 }), true);
  assert.equal(isFIRBounds({ x: 0, y: 10, width: 100 }), false);
  assert.equal(isFIRBounds(null), false);
});

test('isFIRNode and validateFIRTree validate valid tree hierarchy', () => {
  const tree: FIRNode = {
    id: 'root-1',
    name: 'div.container',
    type: 'FRAME',
    bounds: { x: 0, y: 0, width: 800, height: 600 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    layout: {
      mode: 'VERTICAL',
      wrap: false,
      itemSpacing: 12,
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      primaryAlign: 'MIN',
      counterAlign: 'MIN',
      sizingHorizontal: 'FIXED',
      sizingVertical: 'HUG',
    },
    style: {
      backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
      borderRadius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 8 },
      borders: {
        top: { width: 1, color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, style: 'solid' },
        right: { width: 1, color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, style: 'solid' },
        bottom: { width: 1, color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, style: 'solid' },
        left: { width: 1, color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, style: 'solid' },
      },
      shadows: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.1 },
          offset: { x: 0, y: 4 },
          radius: 12,
        },
      ],
      blur: 0,
    },
    children: [
      {
        id: 'child-text',
        name: 'h1.title',
        type: 'TEXT',
        bounds: { x: 16, y: 16, width: 200, height: 32 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 1,
        textData: {
          characters: 'Hello World',
          segments: [
            {
              start: 0,
              end: 11,
              fontFamily: 'Inter',
              fontWeight: 700,
              fontSize: 24,
              color: { r: 0, g: 0, b: 0, a: 1 },
            },
          ],
        },
      },
      {
        id: 'child-vector',
        name: 'svg.icon',
        type: 'VECTOR',
        bounds: { x: 16, y: 56, width: 24, height: 24 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 2,
        svgContent: '<svg width="24" height="24"><circle cx="12" cy="12" r="10"/></svg>',
      },
      {
        id: 'child-image',
        name: 'img.avatar',
        type: 'IMAGE',
        bounds: { x: 16, y: 88, width: 48, height: 48 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 3,
        imageData: {
          base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          scaleMode: 'FILL',
        },
      },
    ],
  };

  assert.equal(isFIRNode(tree), true);
  const result = validateFIRTree(tree);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateFIRTree detects invalid nodes and missing required fields', () => {
  const invalidTree = {
    id: '',
    name: 'invalid',
    type: 'INVALID_TYPE',
    bounds: { x: 0, y: 0 },
    visible: 'yes',
    opacity: 2,
    clipsContent: true,
    zIndex: 'top',
    children: [
      {
        id: 'bad-text',
        name: 'text',
        type: 'TEXT',
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 0,
        // missing textData
      },
    ],
  };

  assert.equal(isFIRNode(invalidTree), false);
  const result = validateFIRTree(invalidTree);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 6);
});
