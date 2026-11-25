import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTextNode } from '../src/plugin/text-renderer.ts';
import { fontManager } from '../src/plugin/font-manager.ts';
import type { FIRNode } from '../src/types/fir.ts';

class MockBadgeTextNode {
  type = 'TEXT';
  name = '';
  characters = '';
  fontName: any = null;
  fontSize = 16;
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  opacity = 1;
  visible = true;
  textAutoResize = 'NONE';
  textAlignHorizontal = 'LEFT';
  textAlignVertical = 'CENTER';
  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
  setRangeFontName() {}
  setRangeFontSize() {}
  setRangeFills() {}
}

function badgeNode(): FIRNode {
  return {
    id: 'faq-plus',
    name: 'span.faq-plus-text',
    type: 'TEXT',
    bounds: { x: 1334.34, y: 1887.84, width: 52.33, height: 52.33 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    textData: {
      characters: '+',
      isSingleLine: false,
      whiteSpace: 'normal',
      segments: [
        {
          start: 0,
          end: 1,
          fontFamily: 'Manrope',
          fontWeight: 400,
          fontSize: 25,
          color: { r: 1, g: 1, b: 1, a: 1 },
        },
      ],
    },
  };
}

function installMock() {
  fontManager.clearCache();
  (globalThis as any).figma = {
    loadFontAsync: async () => {},
    createText: () => new MockBadgeTextNode(),
  };
}

test('renderTextNode centers a single-glyph badge in its parent frame', async () => {
  installMock();
  const node = badgeNode();
  const parent = { width: 52.33, height: 52.33 } as any;

  const text = (await renderTextNode(node, parent)) as any;
  assert.equal(text.textAlignHorizontal, 'CENTER');
  assert.equal(text.textAlignVertical, 'CENTER');
  assert.equal(text.textAutoResize, 'NONE');
  assert.equal(text.width, 52.33);
  assert.equal(text.height, 52.33);
});

test('renderTextNode does not center a glyph when the text is smaller than its parent', async () => {
  installMock();
  const node = badgeNode();
  node.bounds = { x: 0, y: 0, width: 15, height: 25 };
  const parent = { width: 200, height: 90 } as any;

  const text = (await renderTextNode(node, parent)) as any;
  assert.equal(text.textAlignHorizontal, 'LEFT');
  assert.notEqual(text.textAutoResize, 'NONE');
});
