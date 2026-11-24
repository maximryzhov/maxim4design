import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeSvgElement } from '../src/extractor/svg-serializer.ts';
import { renderVectorNode } from '../src/plugin/vector-renderer.ts';
import type { FIRNode } from '../src/types/fir.ts';

test('serializeSvgElement replaces currentColor and adds xmlns', () => {
  (globalThis as any).window = {
    getComputedStyle: () => ({
      color: 'rgb(24, 160, 251)',
    }),
  };

  const mockSvg: any = {
    tagName: 'SVG',
    outerHTML: '<svg width="24" height="24"><path fill="currentColor" d="M0 0h24v24H0z"/></svg>',
    hasAttribute: (attr: string) => attr === 'width' || attr === 'height',
    getAttribute: (attr: string) => (attr === 'width' ? '24' : '24'),
    getBoundingClientRect: () => ({ width: 24, height: 24 }),
  };

  const result = serializeSvgElement(mockSvg);

  assert.ok(result.includes('fill="rgb(24, 160, 251)"'));
  assert.ok(result.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(!result.includes('currentColor'));
});

test('renderVectorNode creates node from SVG or falls back to placeholder on error', async () => {
  let createdSvgString = '';

  class MockSvgFrameNode {
    type = 'FRAME';
    name = '';
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    opacity = 1;
    visible = true;

    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  }

  class MockPlaceholderRect {
    type = 'RECTANGLE';
    name = '';
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    opacity = 1;
    visible = true;
    fills: any[] = [];
    strokes: any[] = [];
    dashPattern: any[] = [];

    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  }

  (globalThis as any).figma = {
    createNodeFromSvg: (svg: string) => {
      if (svg.includes('broken')) {
        throw new Error('Invalid SVG xml');
      }
      createdSvgString = svg;
      return new MockSvgFrameNode();
    },
    createRectangle: () => new MockPlaceholderRect(),
  };

  const validNode: FIRNode = {
    id: 'icon-1',
    name: 'icon.heart',
    type: 'VECTOR',
    bounds: { x: 10, y: 15, width: 24, height: 24 },
    visible: true,
    opacity: 0.9,
    clipsContent: false,
    zIndex: 0,
    svgContent: '<svg width="24" height="24"><path d="M12 21..."/></svg>',
  };

  const resultNode = (await renderVectorNode(validNode)) as any;
  assert.equal(resultNode.type, 'FRAME');
  assert.equal(resultNode.name, 'icon.heart');
  assert.equal(resultNode.width, 24);
  assert.equal(resultNode.x, 10);
  assert.equal(resultNode.opacity, 0.9);
  assert.equal(createdSvgString, validNode.svgContent);

  // Test error fallback
  const brokenNode: FIRNode = {
    id: 'icon-broken',
    name: 'icon.broken',
    type: 'VECTOR',
    bounds: { x: 40, y: 50, width: 32, height: 32 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    svgContent: '<svg>broken-syntax',
  };

  const fallbackNode = (await renderVectorNode(brokenNode)) as any;
  assert.equal(fallbackNode.type, 'RECTANGLE');
  assert.ok(fallbackNode.name.includes('Fallback'));
  assert.equal(fallbackNode.width, 32);
});
