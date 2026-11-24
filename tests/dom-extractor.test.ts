import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCssColor, extractFIRFromElement } from '../src/extractor/dom-extractor.ts';
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
  assert.equal(buttonNode.type, 'TEXT');
  assert.equal(buttonNode.style?.backgroundColor?.b, 1);
  assert.equal(buttonNode.style?.borderRadius?.topLeft, 6);

  const validation = validateFIRTree(fir);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});
