import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeElementLayout } from '../src/extractor/layout-analyzer.ts';
import { applyChildPositioning } from '../src/plugin/layout-engine.ts';
import type { FIRLayout } from '../src/types/fir.ts';

test('analyzeElementLayout creates mode: NONE fallback for CSS Grid', () => {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    paddingTop: '24px',
    paddingRight: '16px',
    paddingBottom: '24px',
    paddingLeft: '16px',
    position: 'relative',
  } as unknown as CSSStyleDeclaration;

  const layout = analyzeElementLayout(gridStyle);
  assert.ok(layout);
  assert.equal(layout.mode, 'NONE');
  assert.deepEqual(layout.padding, { top: 24, right: 16, bottom: 24, left: 16 });
  assert.equal(layout.isAbsolute, false);
});

test('analyzeElementLayout detects position: absolute and fixed', () => {
  const absoluteBadge = {
    display: 'inline-flex',
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    flexDirection: 'row',
  } as unknown as CSSStyleDeclaration;

  const layout = analyzeElementLayout(absoluteBadge);
  assert.ok(layout);
  assert.equal(layout.isAbsolute, true);
  assert.equal(layout.mode, 'HORIZONTAL');
});

test('applyChildPositioning sets layoutPositioning = ABSOLUTE in Figma', () => {
  const mockChild: any = {
    layoutPositioning: 'AUTO',
    x: 0,
    y: 0,
  };

  const layout: FIRLayout = {
    mode: 'NONE',
    wrap: false,
    itemSpacing: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    primaryAlign: 'MIN',
    counterAlign: 'MIN',
    isAbsolute: true,
  };

  applyChildPositioning(mockChild, layout, 120, 45);

  assert.equal(mockChild.layoutPositioning, 'ABSOLUTE');
  assert.equal(mockChild.x, 120);
  assert.equal(mockChild.y, 45);
});
