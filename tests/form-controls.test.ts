import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFormControlTextData,
} from '../src/extractor/text-builder.ts';
import { extractFIRFromElement } from '../src/extractor/dom-extractor.ts';

const STYLE: Record<string, string> = {
  display: 'inline-block',
  visibility: 'visible',
  opacity: '1',
  overflow: 'visible',
  zIndex: '0',
  position: 'static',
  backgroundColor: 'rgb(245, 245, 244)',
  backgroundImage: 'none',
  color: 'rgb(23, 51, 0)',
  fontSize: '16.2109px',
  fontWeight: '500',
  fontFamily: 'Montserrat, sans-serif',
  fontStyle: 'normal',
  lineHeight: '20px',
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
  borderTopLeftRadius: '8px',
  borderTopRightRadius: '8px',
  borderBottomRightRadius: '8px',
  borderBottomLeftRadius: '8px',
  paddingTop: '12px',
  paddingRight: '12px',
  paddingBottom: '12px',
  paddingLeft: '12px',
  clip: 'auto',
};

function mockElement(tag: string, options: Record<string, any> = {}) {
  return {
    tagName: tag.toUpperCase(),
    id: options.id || '',
    className: options.className || '',
    textContent: options.textContent || '',
    children: [],
    childNodes: [],
    getBoundingClientRect: () => options.rect || { x: 0, y: 0, width: 598, height: 43 },
    ...options,
  };
}

function installMocks() {
  (globalThis as any).window = {
    getComputedStyle: () => STYLE,
  };
  (globalThis as any).document = {
    createRange: () => ({
      selectNodeContents() {},
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    }),
  };
}

test('extractFormControlTextData returns input placeholder', () => {
  installMocks();
  const input = mockElement('input', { type: 'text', value: '', placeholder: 'Ваше имя' });
  const data = extractFormControlTextData(input as any, 'input');
  assert.ok(data);
  assert.equal(data!.characters, 'Ваше имя');
  assert.equal(data!.isSingleLine, true);
  assert.equal(data!.segments[0].fontFamily, 'Montserrat');
});

test('extractFormControlTextData prefers input value over placeholder', () => {
  installMocks();
  const input = mockElement('input', { type: 'tel', value: '+7 917', placeholder: '+7 (___)' });
  const data = extractFormControlTextData(input as any, 'input');
  assert.equal(data!.characters, '+7 917');
});

test('extractFormControlTextData reads selected option for select', () => {
  installMocks();
  const select = mockElement('select', {
    selectedOptions: [{ textContent: 'Искусственные фитостены' }],
  });
  const data = extractFormControlTextData(select as any, 'select');
  assert.equal(data!.characters, 'Искусственные фитостены');
});

test('extractFormControlTextData supports multiline textarea placeholder', () => {
  installMocks();
  const textarea = mockElement('textarea', {
    value: '',
    placeholder: 'Расскажите, какое пространство хотите преобразить.',
  });
  const data = extractFormControlTextData(textarea as any, 'textarea');
  assert.equal(data!.isSingleLine, false);
  assert.equal(data!.whiteSpace, 'normal');
});

test('extractFIRFromElement renders input as FRAME with inner TEXT', () => {
  installMocks();
  const input = mockElement('input', {
    id: 'lead-name',
    type: 'text',
    value: '',
    placeholder: 'Ваше имя',
    rect: { x: 100, y: 200, width: 598, height: 43 },
  });

  const fir = extractFIRFromElement(input as any);
  assert.equal(fir.type, 'FRAME');
  assert.equal(fir.bounds.width, 598);
  assert.equal(fir.children?.length, 1);
  const text = fir.children![0];
  assert.equal(text.type, 'TEXT');
  assert.equal(text.textData?.characters, 'Ваше имя');
  assert.equal(text.bounds.x, 112); // 100 + paddingLeft
  assert.equal(text.bounds.width, 574); // 598 - 12 - 12
});

test('extractFIRFromElement renders checked checkbox with check vector', () => {
  installMocks();
  const checkbox = mockElement('input', {
    type: 'checkbox',
    checked: true,
    rect: { x: 10, y: 20, width: 16, height: 16 },
  });

  const fir = extractFIRFromElement(checkbox as any);
  assert.equal(fir.type, 'FRAME');
  assert.equal(fir.children?.length, 1);
  assert.equal(fir.children![0].type, 'VECTOR');
  assert.ok(fir.children![0].svgContent?.includes('path'));
});

test('extractFIRFromElement preserves a select chevron as a VECTOR child', () => {
  installMocks();
  const svg =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%23193800' stroke-width='1.5'/%3E%3C/svg%3E";
  (globalThis as any).window.getComputedStyle = () => ({
    ...STYLE,
    backgroundImage: `url("${svg}")`,
    backgroundSize: '12px 8px',
    backgroundPosition: 'right 17px center',
  });

  const select = mockElement('select', {
    id: 'lead-service',
    selectedOptions: [{ textContent: 'Искусственные фитостены' }],
    rect: { x: 100, y: 200, width: 598, height: 43 },
  });

  const fir = extractFIRFromElement(select as any);
  assert.equal(fir.type, 'FRAME');
  assert.equal(fir.children?.length, 2);

  const arrow = fir.children!.find((child) => child.name.includes('-arrow'));
  assert.ok(arrow);
  assert.equal(arrow!.type, 'VECTOR');
  assert.ok(arrow!.svgContent?.includes('<svg'));
  assert.deepEqual(arrow!.bounds, { x: 669, y: 217.5, width: 12, height: 8 });

  const text = fir.children!.find((child) => child.type === 'TEXT');
  assert.ok(text);
  assert.equal(text!.bounds.width, 574 - 12 - 6);
});
