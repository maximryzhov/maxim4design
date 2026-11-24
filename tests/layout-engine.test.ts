import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAutoLayout, applyChildSizing } from '../src/plugin/layout-engine.ts';
import { parseLayout } from '../src/extractor/dom-extractor.ts';
import type { FIRLayout } from '../src/types/fir.ts';

test('parseLayout correctly extracts flexbox properties from CSSStyleDeclaration', () => {
  const flexStyle = {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '16px',
    paddingTop: '10px',
    paddingRight: '20px',
    paddingBottom: '10px',
    paddingLeft: '20px',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexGrow: '1',
    width: '100%',
    height: 'auto',
  } as unknown as CSSStyleDeclaration;

  const layout = parseLayout(flexStyle);
  assert.ok(layout);
  assert.equal(layout.mode, 'HORIZONTAL');
  assert.equal(layout.wrap, true);
  assert.equal(layout.itemSpacing, 16);
  assert.deepEqual(layout.padding, { top: 10, right: 20, bottom: 10, left: 20 });
  assert.equal(layout.primaryAlign, 'SPACE_BETWEEN');
  assert.equal(layout.counterAlign, 'CENTER');
  assert.equal(layout.sizingHorizontal, 'FILL');
  assert.equal(layout.sizingVertical, 'HUG');
});

test('parseLayout returns undefined for non-flex display', () => {
  const blockStyle = {
    display: 'block',
  } as unknown as CSSStyleDeclaration;

  assert.equal(parseLayout(blockStyle), undefined);
});

test('applyAutoLayout applies flex properties to FrameNode', () => {
  const mockFrame: any = {
    layoutMode: 'NONE',
    layoutWrap: 'NO_WRAP',
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
  };

  const layout: FIRLayout = {
    mode: 'VERTICAL',
    wrap: false,
    itemSpacing: 24,
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    primaryAlign: 'CENTER',
    counterAlign: 'MAX',
  };

  applyAutoLayout(mockFrame, layout);

  assert.equal(mockFrame.layoutMode, 'VERTICAL');
  assert.equal(mockFrame.layoutWrap, 'NO_WRAP');
  assert.equal(mockFrame.itemSpacing, 24);
  assert.equal(mockFrame.paddingTop, 16);
  assert.equal(mockFrame.primaryAxisAlignItems, 'CENTER');
  assert.equal(mockFrame.counterAxisAlignItems, 'MAX');
});

test('applyChildSizing applies FILL, HUG, FIXED sizing', () => {
  const mockChild: any = {
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
  };

  applyChildSizing(mockChild, { horizontal: 'FILL', vertical: 'HUG' });

  assert.equal(mockChild.layoutSizingHorizontal, 'FILL');
  assert.equal(mockChild.layoutSizingVertical, 'HUG');
});
