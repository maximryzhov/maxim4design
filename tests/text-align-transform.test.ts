import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTextData } from '../src/extractor/text-builder.ts';
import { renderTextNode } from '../src/plugin/text-renderer.ts';
import { fontManager } from '../src/plugin/font-manager.ts';
import type { FIRNode } from '../src/types/fir.ts';

const STYLE = {
  display: 'block',
  visibility: 'visible',
  color: 'rgb(29, 53, 22)',
  fontSize: '12px',
  fontWeight: '800',
  fontFamily: 'Manrope',
  lineHeight: '18.6px',
  letterSpacing: '0px',
  textDecorationLine: 'none',
  whiteSpace: 'nowrap',
  textAlign: 'right',
  textTransform: 'uppercase',
};

test('extractTextData preserves text-align and applies text-transform', () => {
  const style = { ...STYLE };
  (globalThis as any).window = {
    getComputedStyle: () => style,
  };

  const paragraph: any = {
    nodeType: 1,
    tagName: 'A',
    textContent: 'Услуги',
    childNodes: [{ nodeType: 3, textContent: 'Услуги' }],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 48, height: 19 }),
  };

  const data = extractTextData(paragraph);
  assert.equal(data.characters, 'УСЛУГИ');
  assert.equal(data.textTransform, 'uppercase');
  assert.equal(data.textAlign, 'RIGHT');
});

test('renderTextNode applies alignment and keeps box for right-aligned nowrap text', async () => {
  fontManager.clearCache();

  class MockTextNode {
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
    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    setRangeFontName() {}
    setRangeFontSize() {}
    setRangeFills() {}
  }

  (globalThis as any).figma = {
    loadFontAsync: async () => {},
    createText: () => new MockTextNode(),
  };

  const node: FIRNode = {
    id: 'hero-line',
    name: 'span.hero-heading-first',
    type: 'TEXT',
    bounds: { x: 720, y: 20, width: 675, height: 90 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    textData: {
      characters: 'ФИТОСТЕНЫ',
      isSingleLine: true,
      whiteSpace: 'nowrap',
      textAlign: 'RIGHT',
      textTransform: 'none',
      segments: [
        {
          start: 0,
          end: 9,
          fontFamily: 'Inter',
          fontWeight: 800,
          fontSize: 103.5,
          color: { r: 0.1, g: 0.22, b: 0, a: 1 },
        },
      ],
    },
  };

  const textNode = (await renderTextNode(node)) as any;
  assert.equal(textNode.textAlignHorizontal, 'RIGHT');
  assert.equal(textNode.textAutoResize, 'NONE');
  assert.equal(textNode.width, 675);
});
