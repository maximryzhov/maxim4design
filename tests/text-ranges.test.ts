import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWhitespace,
  isInlineElement,
  extractTextData,
} from '../src/extractor/text-builder.ts';
import { renderTextNode } from '../src/plugin/text-renderer.ts';
import type { FIRNode } from '../src/types/fir.ts';

test('normalizeWhitespace handles normal vs pre whitespace collapsing', () => {
  const raw = '   Hello \n\t  world!   \n Multiple   spaces   ';
  assert.equal(normalizeWhitespace(raw, 'normal'), ' Hello world! Multiple spaces ');
  assert.equal(normalizeWhitespace(raw, 'pre'), raw);
});

test('isInlineElement identifies inline HTML tags', () => {
  assert.equal(isInlineElement({ tagName: 'SPAN' } as Element), true);
  assert.equal(isInlineElement({ tagName: 'B' } as Element), true);
  assert.equal(isInlineElement({ tagName: 'A' } as Element), true);
  assert.equal(isInlineElement({ tagName: 'STRONG' } as Element), true);
  assert.equal(isInlineElement({ tagName: 'DIV' } as Element), false);
  assert.equal(isInlineElement({ tagName: 'SECTION' } as Element), false);
});

// Setup mock DOM for extractTextData test
function setupTextMockDOM() {
  const styles = new Map<any, any>();

  (globalThis as any).window = {
    getComputedStyle: (el: any) => {
      return (
        styles.get(el) || {
          display: 'block',
          visibility: 'visible',
          color: 'rgb(0, 0, 0)',
          fontSize: '16px',
          fontWeight: '400',
          fontFamily: 'Inter',
          lineHeight: '24px',
          letterSpacing: '0px',
          textDecorationLine: 'none',
          whiteSpace: 'normal',
        }
      );
    },
  };

  return {
    setStyle: (el: any, s: any) => styles.set(el, s),
  };
}

test('extractTextData merges inline formatted children into single characters with segments', () => {
  const mockDOM = setupTextMockDOM();

  const textNode1 = { nodeType: 3, textContent: 'Text with ' };
  const boldEl = {
    nodeType: 1,
    tagName: 'B',
    childNodes: [{ nodeType: 3, textContent: 'bold' }],
  };
  mockDOM.setStyle(boldEl, {
    display: 'inline',
    visibility: 'visible',
    color: 'rgb(0, 0, 0)',
    fontSize: '16px',
    fontWeight: '700',
    fontFamily: 'Inter',
    lineHeight: '24px',
    letterSpacing: '0px',
    textDecorationLine: 'none',
    whiteSpace: 'normal',
  });

  const textNode2 = { nodeType: 3, textContent: ' and a ' };
  const linkEl = {
    nodeType: 1,
    tagName: 'A',
    childNodes: [{ nodeType: 3, textContent: 'link' }],
  };
  mockDOM.setStyle(linkEl, {
    display: 'inline',
    visibility: 'visible',
    color: 'rgb(0, 102, 204)',
    fontSize: '16px',
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: '24px',
    letterSpacing: '0px',
    textDecorationLine: 'underline',
    whiteSpace: 'normal',
  });

  const paragraphEl: any = {
    nodeType: 1,
    tagName: 'P',
    childNodes: [textNode1, boldEl, textNode2, linkEl],
  };
  mockDOM.setStyle(paragraphEl, {
    display: 'block',
    visibility: 'visible',
    color: 'rgb(33, 33, 33)',
    fontSize: '16px',
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: '24px',
    letterSpacing: '0px',
    textDecorationLine: 'none',
    whiteSpace: 'normal',
  });

  const textData = extractTextData(paragraphEl);

  assert.equal(textData.characters, 'Text with bold and a link');
  assert.equal(textData.segments.length, 4);

  // Segment 1: "Text with "
  assert.equal(textData.segments[0].start, 0);
  assert.equal(textData.segments[0].end, 10);
  assert.equal(textData.segments[0].fontWeight, 400);

  // Segment 2: "bold"
  assert.equal(textData.segments[1].start, 10);
  assert.equal(textData.segments[1].end, 14);
  assert.equal(textData.segments[1].fontWeight, 700);

  // Segment 3: " and a "
  assert.equal(textData.segments[2].start, 14);
  assert.equal(textData.segments[2].end, 21);

  // Segment 4: "link"
  assert.equal(textData.segments[3].start, 21);
  assert.equal(textData.segments[3].end, 25);
  assert.equal(textData.segments[3].textDecoration, 'UNDERLINE');
});

test('renderTextNode applies range formatting to native TextNode', async () => {
  const rangeCalls: string[] = [];

  class MockRangeTextNode {
    type = 'TEXT';
    name = '';
    characters = '';
    fontName: any = null;
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    opacity = 1;
    visible = true;
    textAutoResize: string = 'NONE';

    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    setRangeFontName(start: number, end: number, font: any) {
      rangeCalls.push(`font:[${start},${end}]=${font.family}:${font.style}`);
    }
    setRangeFontSize(start: number, end: number, size: number) {
      rangeCalls.push(`size:[${start},${end}]=${size}`);
    }
    setRangeFills(start: number, end: number, fills: any[]) {
      rangeCalls.push(`fills:[${start},${end}]`);
    }
    setRangeTextDecoration(start: number, end: number, dec: string) {
      rangeCalls.push(`dec:[${start},${end}]=${dec}`);
    }
  }

  (globalThis as any).figma = {
    loadFontAsync: async () => {},
    createText: () => new MockRangeTextNode(),
  };

  const node: FIRNode = {
    id: 'p-1',
    name: 'p',
    type: 'TEXT',
    bounds: { x: 10, y: 20, width: 300, height: 40 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    textData: {
      characters: 'Hello bold world',
      segments: [
        {
          start: 0,
          end: 6,
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: 16,
          color: { r: 0, g: 0, b: 0, a: 1 },
        },
        {
          start: 6,
          end: 10,
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: 16,
          color: { r: 0, g: 0, b: 0, a: 1 },
          textDecoration: 'UNDERLINE',
        },
        {
          start: 10,
          end: 16,
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: 16,
          color: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    },
  };

  const textNode = (await renderTextNode(node)) as any;

  assert.equal(textNode.characters, 'Hello bold world');
  assert.ok(rangeCalls.some((c) => c.includes('font:[6,10]=Inter:Bold')));
  assert.ok(rangeCalls.some((c) => c.includes('dec:[6,10]=UNDERLINE')));
  assert.equal(textNode.textAutoResize, 'HEIGHT');
});

test('extractTextData detects whiteSpace nowrap and single-line height', () => {
  (globalThis as any).window = {
    getComputedStyle: (el: any) => el._style,
  };

  const nowrapEl: any = {
    tagName: 'A',
    childNodes: [{ nodeType: 3, textContent: '+7 917 772-35-56' }],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 150, height: 22 }),
    _style: {
      whiteSpace: 'nowrap',
      fontFamily: 'Manrope, sans-serif',
      fontWeight: '700',
      fontSize: '19px',
      color: '#111827',
      lineHeight: '22px',
      letterSpacing: '0px',
    },
  };

  const data = extractTextData(nowrapEl);
  assert.equal(data.whiteSpace, 'nowrap');
  assert.equal(data.isSingleLine, true);

  const multilineEl: any = {
    tagName: 'P',
    childNodes: [{ nodeType: 3, textContent: 'Long paragraph text spanning multiple lines.' }],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 300, height: 80 }),
    _style: {
      whiteSpace: 'normal',
      fontFamily: 'Inter',
      fontWeight: '400',
      fontSize: '15px',
      color: '#334155',
      lineHeight: '22px',
      letterSpacing: '0px',
    },
  };

  const multiData = extractTextData(multilineEl);
  assert.equal(multiData.whiteSpace, 'normal');
  assert.equal(multiData.isSingleLine, false);
});

test('renderTextNode sets textAutoResize WIDTH_AND_HEIGHT for single-line / nowrap text', async () => {
  class MockAutoResizeTextNode {
    type = 'TEXT';
    name = '';
    characters = '';
    fontName: any = null;
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    opacity = 1;
    visible = true;
    textAutoResize = 'NONE';
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
    createText: () => new MockAutoResizeTextNode(),
  };

  const singleLineNode: FIRNode = {
    id: 'h-1',
    name: 'span.hero-heading-first',
    type: 'TEXT',
    bounds: { x: 0, y: 0, width: 400, height: 110 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 1,
    textData: {
      characters: 'ФИТОСТЕНЫ',
      whiteSpace: 'nowrap',
      isSingleLine: true,
      segments: [
        {
          start: 0,
          end: 9,
          fontFamily: 'Oswald',
          fontWeight: 900,
          fontSize: 110,
          color: { r: 0.1, g: 0.22, b: 0, a: 1 },
        },
      ],
    },
  };

  const rendered = (await renderTextNode(singleLineNode)) as any;
  assert.equal(rendered.textAutoResize, 'WIDTH_AND_HEIGHT');
});

test('extractTextData converts BR elements to newlines and preserves spaces between inline spans', () => {
  (globalThis as any).window = {
    getComputedStyle: (el: any) =>
      el._style || {
        display: 'inline',
        visibility: 'visible',
        whiteSpace: 'normal',
        fontFamily: 'Inter',
        fontWeight: '700',
        fontSize: '40px',
        color: '#193800',
        lineHeight: '40px',
        letterSpacing: '0px',
      },
  };

  const headingEl: any = {
    tagName: 'H2',
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 500, height: 120 }),
    childNodes: [
      { nodeType: 1, tagName: 'SPAN', childNodes: [{ nodeType: 3, textContent: 'ОТ ИДЕИ' }] },
      { nodeType: 3, textContent: '\n' },
      { nodeType: 1, tagName: 'SPAN', childNodes: [{ nodeType: 3, textContent: 'ДО ЗЕЛЁНОЙ' }] },
      { nodeType: 1, tagName: 'BR' },
      { nodeType: 3, textContent: 'СТЕНЫ' },
    ],
  };

  const data = extractTextData(headingEl);
  assert.equal(data.characters, 'ОТ ИДЕИ ДО ЗЕЛЁНОЙ\nСТЕНЫ');
  assert.ok(data.characters.includes('\n'));
  assert.ok(data.characters.includes('ОТ ИДЕИ ДО ЗЕЛЁНОЙ'));
});
