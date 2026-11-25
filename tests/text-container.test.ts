import test from 'node:test';
import assert from 'node:assert/strict';
import { isTextContainer } from '../src/extractor/text-builder.ts';

type MockEl = {
  tagName: string;
  children: MockEl[];
  textContent: string;
  id: string;
  className: string;
};

const styles = new Map<MockEl, Record<string, string>>();

const DEFAULT_STYLE = {
  display: 'block',
  position: 'static',
  visibility: 'visible',
  opacity: '1',
  overflow: 'visible',
};

function el(tag: string, display: string, children: MockEl[] = [], text = ''): MockEl {
  const node: MockEl = {
    tagName: tag.toUpperCase(),
    children,
    textContent: text,
    id: '',
    className: '',
  };
  styles.set(node, { ...DEFAULT_STYLE, display });
  return node;
}

(globalThis as any).window = {
  getComputedStyle: (node: MockEl) => styles.get(node) || DEFAULT_STYLE,
};

test('isTextContainer does not flatten block-level flex links with images', () => {
  const image = el('img', 'block');
  const wrapper = el('div', 'block', [image]);
  const card = el('a', 'flex', [wrapper], 'Фитостены Описание');

  assert.equal(isTextContainer(card), false);
});

test('isTextContainer keeps true inline links as text', () => {
  const link = el('a', 'inline', [], 'Подробнее');
  assert.equal(isTextContainer(link), true);
});

test('isTextContainer does not flatten flex links whose children are inline spans', () => {
  const badge = el('span', 'inline', [], '01');
  const title = el('span', 'inline', [], 'Рестораны и кафе');
  const row = el('a', 'grid', [badge, title], '01Рестораны и кафе');

  assert.equal(isTextContainer(row), false);
});

test('isTextContainer keeps inline paragraph children text', () => {
  const bold = el('b', 'inline', [], 'жирный');
  const paragraph = el('p', 'block', [bold], 'жирный текст');
  assert.equal(isTextContainer(paragraph), true);
});

test('isTextContainer keeps block span with text only', () => {
  const span = el('span', 'block', [], 'КАК ЖИВЫЕ');
  assert.equal(isTextContainer(span), true);
});

test('isTextContainer treats inline link with image as structural', () => {
  const image = el('img', 'inline');
  const link = el('a', 'inline', [image], '');
  assert.equal(isTextContainer(link), false);
});
