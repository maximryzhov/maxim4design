import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCssColor, extractFIRFromElement, disableTransitionsForExtraction } from '../src/extractor/dom-extractor.ts';
import { isFIRNode, validateFIRTree } from '../src/types/fir.ts';

test('parseCssColor handles various CSS color formats', () => {
  // transparent
  assert.deepEqual(parseCssColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.deepEqual(parseCssColor('rgba(0, 0, 0, 0)'), { r: 0, g: 0, b: 0, a: 0 });

  // 3-digit hex
  assert.deepEqual(parseCssColor('#fff'), { r: 1, g: 1, b: 1, a: 1 });
  assert.deepEqual(parseCssColor('#000'), { r: 0, g: 0, b: 0, a: 1 });

  // 6-digit hex
  assert.deepEqual(parseCssColor('#ff0000'), { r: 1, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseCssColor('#00ff00'), { r: 0, g: 1, b: 0, a: 1 });

  // 8-digit hex (with alpha)
  assert.deepEqual(parseCssColor('#00000080'), { r: 0, g: 0, b: 0, a: 0.502 });

  // rgb
  assert.deepEqual(parseCssColor('rgb(255, 255, 255)'), { r: 1, g: 1, b: 1, a: 1 });
  assert.deepEqual(parseCssColor('rgb(0, 128, 255)'), { r: 0, g: 0.502, b: 1, a: 1 });

  // rgba
  assert.deepEqual(parseCssColor('rgba(255, 0, 0, 0.5)'), { r: 1, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseCssColor('rgba(0, 0, 0, 1)'), { r: 0, g: 0, b: 0, a: 1 });

  // invalid
  assert.equal(parseCssColor('not-a-color'), undefined);
});

// Setup a mock DOM environment for Node.js
function setupMockDOM() {
  const elements = new Map<any, any>();

  (globalThis as any).window = {
    getComputedStyle: (el: any) => {
      return (
        elements.get(el) || {
          display: 'block',
          visibility: 'visible',
          opacity: '1',
          overflow: 'visible',
          zIndex: '0',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          color: 'rgb(0, 0, 0)',
          fontSize: '16px',
          fontWeight: '400',
          fontFamily: 'Inter, sans-serif',
          lineHeight: '24px',
          letterSpacing: '0px',
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
        }
      );
    },
  };

  return {
    setComputedStyle: (el: any, style: any) => {
      elements.set(el, style);
    },
  };
}

function createMockElement(options: {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  rect?: { x: number; y: number; width: number; height: number };
  children?: any[];
  outerHTML?: string;
  src?: string;
}) {
  const el: any = {
    tagName: options.tagName.toUpperCase(),
    id: options.id || '',
    className: options.className || '',
    textContent: options.textContent || '',
    children: options.children || [],
    outerHTML: options.outerHTML || `<${options.tagName}></${options.tagName}>`,
    src: options.src || '',
    getBoundingClientRect: () => options.rect || { x: 0, y: 0, width: 100, height: 100 },
  };
  return el;
}

test('extractFIRFromElement extracts valid FIRNode tree', () => {
  const mockDOM = setupMockDOM();

  const titleEl = createMockElement({
    tagName: 'h1',
    id: 'header-title',
    textContent: 'Welcome to maxim4design',
    rect: { x: 10, y: 10, width: 300, height: 40 },
  });
  mockDOM.setComputedStyle(titleEl, {
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    overflow: 'visible',
    zIndex: '1',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: 'rgb(33, 33, 33)',
    fontSize: '24px',
    fontWeight: '700',
    fontFamily: 'Inter',
    lineHeight: '32px',
    letterSpacing: '0px',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
  });

  const buttonEl = createMockElement({
    tagName: 'button',
    className: 'btn btn-primary',
    textContent: 'Click me',
    rect: { x: 10, y: 60, width: 120, height: 44 },
  });
  mockDOM.setComputedStyle(buttonEl, {
    display: 'inline-block',
    visibility: 'visible',
    opacity: '1',
    overflow: 'hidden',
    zIndex: '2',
    backgroundColor: 'rgb(0, 102, 255)',
    color: 'rgb(255, 255, 255)',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'Inter',
    lineHeight: '20px',
    letterSpacing: '0.5px',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopColor: 'rgb(0, 80, 200)',
    borderRightColor: 'rgb(0, 80, 200)',
    borderBottomColor: 'rgb(0, 80, 200)',
    borderLeftColor: 'rgb(0, 80, 200)',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
    borderBottomLeftRadius: '6px',
  });

  const rootEl = createMockElement({
    tagName: 'div',
    id: 'app-container',
    rect: { x: 0, y: 0, width: 800, height: 600 },
    children: [titleEl, buttonEl],
  });
  mockDOM.setComputedStyle(rootEl, {
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    overflow: 'hidden',
    zIndex: '0',
    backgroundColor: 'rgb(255, 255, 255)',
    color: 'rgb(0, 0, 0)',
    fontSize: '16px',
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: '24px',
    letterSpacing: '0px',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
  });

  const fir = extractFIRFromElement(rootEl as any);

  assert.equal(isFIRNode(fir), true);
  assert.equal(fir.id, 'app-container');
  assert.equal(fir.type, 'FRAME');
  assert.equal(fir.children?.length, 2);

  const titleNode = fir.children![0];
  assert.equal(titleNode.type, 'TEXT');
  assert.equal(titleNode.textData?.characters, 'Welcome to maxim4design');
  assert.equal(titleNode.textData?.segments[0].fontSize, 24);

  const buttonNode = fir.children![1];
  assert.equal(buttonNode.type, 'FRAME');
  assert.equal(buttonNode.style?.backgroundColor?.b, 1);
  assert.equal(buttonNode.style?.borderRadius?.topLeft, 6);
  assert.equal(buttonNode.children?.[0].type, 'TEXT');

  const validation = validateFIRTree(fir);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});

test('extractFIRFromElement infers itemSpacing from child margins when flex gap is 0', () => {
  const mockDOM = setupMockDOM();

  const item1 = createMockElement({
    tagName: 'span',
    textContent: '01',
    rect: { x: 0, y: 0, width: 30, height: 24 },
  });
  const item2 = createMockElement({
    tagName: 'strong',
    textContent: 'Рестораны и кафе',
    rect: { x: 46, y: 0, width: 160, height: 24 }, // 16px margin-left/right gap
  });

  const row = createMockElement({
    tagName: 'div',
    className: 'audience-row',
    rect: { x: 0, y: 0, width: 400, height: 40 },
    children: [item1, item2],
  });

  mockDOM.setComputedStyle(row, {
    display: 'flex',
    flexDirection: 'row',
    gap: '0px',
    visibility: 'visible',
    opacity: '1',
    overflow: 'visible',
    zIndex: '0',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderTopStyle: 'none',
    borderRightStyle: 'none',
    borderBottomStyle: 'none',
    borderLeftStyle: 'none',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
  });
  mockDOM.setComputedStyle(item1, {
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    color: '#000',
    fontSize: '14px',
    fontFamily: 'Inter',
    fontWeight: '400',
  });
  mockDOM.setComputedStyle(item2, {
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    color: '#000',
    fontSize: '16px',
    fontFamily: 'Inter',
    fontWeight: '700',
  });

  const fir = extractFIRFromElement(row as any);
  assert.equal(fir.layout?.mode, 'HORIZONTAL');
  assert.equal(fir.layout?.itemSpacing, 16);
});

test('extractFIRFromElement skips answer content of a closed details element', () => {
  setupMockDOM();

  const summaryEl = createMockElement({
    tagName: 'summary',
    textContent: 'Нужно ли ухаживать за фитостеной?',
    rect: { x: 0, y: 0, width: 600, height: 93 },
  });
  const answerEl = createMockElement({
    tagName: 'p',
    textContent: 'Поливать и подкармливать растения не нужно.',
    rect: { x: 0, y: 93, width: 600, height: 44 },
  });

  const detailsEl = createMockElement({
    tagName: 'details',
    rect: { x: 0, y: 0, width: 600, height: 93 },
    children: [summaryEl, answerEl],
  }) as any;
  detailsEl.open = false;

  const rootEl = createMockElement({
    tagName: 'div',
    rect: { x: 0, y: 0, width: 600, height: 93 },
    children: [detailsEl],
  });

  const fir = extractFIRFromElement(rootEl as any);
  const serialized = JSON.stringify(fir);
  assert.ok(serialized.includes('Нужно ли ухаживать за фитостеной?'));
  assert.ok(!serialized.includes('Поливать и подкармливать растения не нужно.'));

  // The details frame itself stays in the tree, but its answer is not a child.
  const detailsFir = fir.children?.[0];
  assert.ok(detailsFir);
  const detailsText = JSON.stringify(detailsFir);
  assert.ok(!detailsText.includes('Поливать и подкармливать растения не нужно.'));
});

test('extractFIRFromElement keeps answer content of an open details element', () => {
  setupMockDOM();

  const summaryEl = createMockElement({
    tagName: 'summary',
    textContent: 'Вопрос',
    rect: { x: 0, y: 0, width: 600, height: 93 },
  });
  const answerEl = createMockElement({
    tagName: 'p',
    textContent: 'Ответ',
    rect: { x: 0, y: 93, width: 600, height: 44 },
  });

  const detailsEl = createMockElement({
    tagName: 'details',
    rect: { x: 0, y: 0, width: 600, height: 137 },
    children: [summaryEl, answerEl],
  }) as any;
  detailsEl.open = true;

  const rootEl = createMockElement({
    tagName: 'div',
    rect: { x: 0, y: 0, width: 600, height: 137 },
    children: [detailsEl],
  });

  const fir = extractFIRFromElement(rootEl as any);
  const serialized = JSON.stringify(fir);
  assert.ok(serialized.includes('Вопрос'));
  assert.ok(serialized.includes('Ответ'));
});

test('disableTransitionsForExtraction injects and removes a transition-disable style', () => {
  const origDocument = (globalThis as any).document;
  const children: any[] = [];
  const style: any = {
    attributes: {} as Record<string, string>,
    textContent: '',
    parentNode: null as any,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    remove() {
      const index = children.indexOf(this);
      if (index >= 0) children.splice(index, 1);
    },
  };
  const head = {
    appendChild(node: any) {
      children.push(node);
      style.parentNode = { removeChild: () => style.remove() };
      return node;
    },
  };
  (globalThis as any).document = {
    head,
    createElement: () => style,
  };

  try {
    const restore = disableTransitionsForExtraction();
    assert.equal(children.length, 1);
    assert.equal(style.attributes['data-maxim4design-extraction'], 'transitions-off');
    assert.match(style.textContent, /transition:none!important/);
    restore();
    assert.equal(children.length, 0);
  } finally {
    (globalThis as any).document = origDocument;
  }
});

