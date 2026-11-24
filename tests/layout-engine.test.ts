import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAutoLayout, applyChildSizing, applyChildPositioning } from '../src/plugin/layout-engine.ts';
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

test('applyAutoLayout sets primaryAxisSizingMode FIXED for SPACE_BETWEEN containers', () => {
  const mockHeader: any = {
    layoutMode: 'NONE',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
  };

  applyAutoLayout(mockHeader, {
    mode: 'HORIZONTAL',
    wrap: false,
    itemSpacing: 20,
    padding: { top: 0, right: 35, bottom: 0, left: 35 },
    primaryAlign: 'SPACE_BETWEEN',
    counterAlign: 'CENTER',
    sizingHorizontal: 'HUG', // Even if HUG, SPACE_BETWEEN needs FIXED width
    sizingVertical: 'FIXED',
  });

  assert.equal(mockHeader.layoutMode, 'HORIZONTAL');
  assert.equal(mockHeader.primaryAxisSizingMode, 'FIXED');
  assert.equal(mockHeader.counterAxisSizingMode, 'FIXED');
  assert.equal(mockHeader.primaryAxisAlignItems, 'SPACE_BETWEEN');
  assert.equal(mockHeader.counterAxisAlignItems, 'CENTER');
});

test('applyChildPositioning sets ABSOLUTE and preserves exact relative coordinates', () => {
  const mockChild: any = {
    x: 0,
    y: 0,
    layoutPositioning: 'AUTO',
  };

  applyChildPositioning(
    mockChild,
    {
      mode: 'NONE',
      wrap: false,
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      primaryAlign: 'MIN',
      counterAlign: 'MIN',
      isAbsolute: true,
    },
    690,
    291
  );

  assert.equal(mockChild.layoutPositioning, 'ABSOLUTE');
  assert.equal(mockChild.x, 690);
  assert.equal(mockChild.y, 291);
});
