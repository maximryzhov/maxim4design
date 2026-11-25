import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCssGradient } from '../src/extractor/style-extractor.ts';
import { extractPseudoElement } from '../src/extractor/pseudo-extractor.ts';
import { applyStyles } from '../src/plugin/style-applier.ts';
import type { FIRStyle } from '../src/types/fir.ts';

const BASE_STYLE: Record<string, string> = {
  display: 'block',
  visibility: 'visible',
  opacity: '1',
  overflow: 'visible',
  zIndex: '0',
  position: 'absolute',
  content: '""',
  width: 'auto',
  height: 'auto',
  top: '0px',
  right: '0px',
  bottom: '0px',
  left: '0px',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  backgroundImage: 'none',
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
  borderTopStyle: 'none',
  borderRightStyle: 'none',
  borderBottomStyle: 'none',
  borderLeftStyle: 'none',
  borderTopColor: 'rgba(0, 0, 0, 0)',
  borderRightColor: 'rgba(0, 0, 0, 0)',
  borderBottomColor: 'rgba(0, 0, 0, 0)',
  borderLeftColor: 'rgba(0, 0, 0, 0)',
  borderTopLeftRadius: '0px',
  borderTopRightRadius: '0px',
  borderBottomRightRadius: '0px',
  borderBottomLeftRadius: '0px',
  boxShadow: 'none',
  filter: 'none',
  backdropFilter: 'none',
};

test('parseCssGradient parses vertical overlays, angles and stops', () => {
  const overlay = parseCssGradient(
    'linear-gradient(180deg, rgba(12,19,10,.38), transparent 39%, transparent 47%, rgba(9,18,10,.79))'
  );
  assert.ok(overlay);
  assert.equal(overlay!.type, 'LINEAR');
  assert.equal(overlay!.angle, 180);
  assert.equal(overlay!.stops.length, 4);
  assert.deepEqual(
    overlay!.stops.map((s) => s.position),
    [0, 0.39, 0.47, 1]
  );
  assert.equal(overlay!.stops[1].color.a, 0);

  const defaultAngle = parseCssGradient('linear-gradient(transparent, #171b17a8)');
  assert.ok(defaultAngle);
  assert.equal(defaultAngle!.angle, 180);
  assert.equal(defaultAngle!.stops.length, 2);
  assert.equal(defaultAngle!.stops[0].color.a, 0);
  assert.equal(defaultAngle!.stops[1].color.a, 0.6588);

  const horizontal = parseCssGradient('linear-gradient(90deg, #fff, #000)');
  assert.ok(horizontal);
  assert.equal(horizontal!.angle, 90);

  const radial = parseCssGradient('radial-gradient(circle, #fff, #000)');
  assert.ok(radial);
  assert.equal(radial!.type, 'RADIAL');

  assert.equal(parseCssGradient('url("https://example.com/bg.png")'), undefined);
});

test('applyStyles emits a native gradient fill', () => {
  const node: any = {
    fills: [],
    strokes: [],
    effects: [],
    clipsContent: false,
    cornerRadius: 0,
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomRightRadius: 0,
    bottomLeftRadius: 0,
  };
  const style: FIRStyle = {
    backgroundGradient: {
      type: 'LINEAR',
      angle: 180,
      stops: [
        { position: 0, color: { r: 0.1, g: 0.2, b: 0.1, a: 0.4 } },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 0.8 } },
      ],
    },
  };
  applyStyles(node, style, false);
  assert.equal(node.fills.length, 1);
  assert.equal(node.fills[0].type, 'GRADIENT_LINEAR');
  assert.deepEqual(node.fills[0].gradientTransform, [[1, 0, 0], [0, 1, 0]]);
  assert.equal(node.fills[0].gradientStops.length, 2);
  assert.equal(node.fills[0].gradientStops[1].position, 1);
  assert.equal(node.fills[0].gradientStops[1].color.a, 0.8);
});

test('extractPseudoElement keeps a gradient-only overlay and derives inset bounds', () => {
  const origWindow = (globalThis as any).window;
  const parentBounds = { x: 100, y: 200, width: 400, height: 300 };
  (globalThis as any).window = {
    getComputedStyle: () => ({
      ...BASE_STYLE,
      width: 'auto',
      height: 'auto',
      top: '132px',
      backgroundImage: 'linear-gradient(transparent, rgba(23,27,23,0.66))',
    }),
  };
  try {
    const node = extractPseudoElement({} as HTMLElement, '::before', parentBounds);
    assert.ok(node);
    assert.equal(node!.type, 'RECTANGLE');
    assert.equal(node!.bounds.x, 100);
    assert.equal(node!.bounds.y, 332);
    assert.equal(node!.bounds.width, 400);
    assert.equal(node!.bounds.height, 168);
    assert.equal(node!.style?.backgroundGradient?.type, 'LINEAR');
    assert.equal(node!.style?.backgroundGradient?.stops.length, 2);
  } finally {
    (globalThis as any).window = origWindow;
  }
});
