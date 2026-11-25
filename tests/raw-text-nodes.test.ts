import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTextNodeData } from '../src/extractor/text-builder.ts';
import { extractFIRFromElement } from '../src/extractor/dom-extractor.ts';

const STYLE: Record<string, string> = {
  display: 'block',
  visibility: 'visible',
  opacity: '1',
  overflow: 'visible',
  zIndex: '0',
  position: 'static',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  backgroundImage: 'none',
  color: 'rgb(29, 53, 22)',
  fontSize: '15px',
  fontWeight: '500',
  fontFamily: 'Manrope, sans-serif',
  fontStyle: 'normal',
  lineHeight: '23.25px',
  letterSpacing: '0px',
  whiteSpace: 'normal',
  textDecoration: 'none',
  borderTopWidth: '0px',
  borderRightWidth: '0px',
  borderBottomWidth: '0px',
  borderLeftWidth: '0px',
  borderTopColor: 'rgb(0, 0, 0)',
  borderRightColor: 'rgb(0, 0, 0)',
  borderBottomColor: 'rgb(0, 0, 0)',
  borderLeftColor: 'rgb(0, 0, 0)',
  borderTopStyle: 'none',
  borderRightStyle: 'none',
  borderBottomStyle: 'none',
  borderLeftStyle: 'none',
  borderTopLeftRadius: '0px',
  borderTopRightRadius: '0px',
  borderBottomRightRadius: '0px',
  borderBottomLeftRadius: '0px',
  paddingTop: '0px',
  paddingRight: '0px',
  paddingBottom: '0px',
  paddingLeft: '0px',
};

function installDomMocks() {
  (globalThis as any).window = {
    getComputedStyle: () => STYLE,
  };
  (globalThis as any).document = {
    createRange: () => ({
      selectNodeContents() {},
      getBoundingClientRect: () => ({ x: 10, y: 10, width: 120, height: 20 }),
    }),
  };
}

function mockElement(tag: string, options: {
  text?: string;
  children?: any[];
  childNodes?: any[];
  id?: string;
  className?: string;
} = {}) {
  return {
    tagName: tag.toUpperCase(),
    id: options.id || '',
    className: options.className || '',
    textContent: options.text || '',
    children: options.children || [],
    childNodes: options.childNodes,
    getBoundingClientRect: () => ({ x: 10, y: 10, width: 300, height: 40 }),
  };
}

test('extractTextNodeData builds a segment for a raw text node', () => {
  installDomMocks();
  const parent = mockElement('summary', { text: 'Всегда зелёные' });
  const textNode = { nodeType: 3, textContent: '  Всегда зелёные  ' };

  const data = extractTextNodeData(textNode as any, parent as any);
  assert.ok(data);
  assert.equal(data!.characters, 'Всегда зелёные');
  assert.equal(data!.segments.length, 1);
  assert.equal(data!.segments[0].fontFamily, 'Manrope');
  assert.equal(data!.segments[0].fontSize, 15);
  assert.equal(data!.segments[0].color.g, 0.2078);
});

test('extractFIRFromElement keeps raw text nodes next to element children', () => {
  installDomMocks();

  const plusSpan = mockElement('span', { text: '+', className: 'faq-plus' });
  const textNode = { nodeType: 3, textContent: 'Всегда зелёные' };
  const summary = mockElement('summary', {
    text: 'Всегда зелёные+',
    children: [plusSpan],
    childNodes: [textNode, plusSpan],
  });

  const fir = extractFIRFromElement(summary as any);
  const texts = (fir.children || []).filter((c) => c.type === 'TEXT');
  assert.equal(texts.length, 2);
  assert.equal(texts[0].textData?.characters, 'Всегда зелёные');
  assert.equal(texts[1].textData?.characters, '+');
});
