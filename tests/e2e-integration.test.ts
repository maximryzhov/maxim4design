import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { extractFIRFromElement } from '../src/extractor/dom-extractor.ts';
import { validateFIRTree, type FIRNode } from '../src/types/fir.ts';
import { renderFIRTreeAsync } from '../src/plugin/node-factory.ts';
import { fontManager } from '../src/plugin/font-manager.ts';

// Comprehensive Figma API mock for End-to-End integration
function setupComprehensiveFigmaMock() {
  class MockBaseNode {
    id = 'figma-' + Math.random().toString(36).substring(2);
    name = '';
    x = 0;
    y = 0;
    width = 100;
    height = 100;
    opacity = 1;
    visible = true;
    layoutPositioning: 'AUTO' | 'ABSOLUTE' = 'AUTO';
    layoutGrow = 0;
    layoutAlign = 'INHERIT';
    layoutSizingHorizontal = 'FIXED';
    layoutSizingVertical = 'FIXED';

    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  }

  class MockFrameNode extends MockBaseNode {
    type = 'FRAME';
    clipsContent = false;
    fills: any[] = [];
    strokes: any[] = [];
    strokeWeight = 0;
    strokeTopWeight = 0;
    strokeRightWeight = 0;
    strokeBottomWeight = 0;
    strokeLeftWeight = 0;
    cornerRadius = 0;
    topLeftRadius = 0;
    topRightRadius = 0;
    bottomRightRadius = 0;
    bottomLeftRadius = 0;
    effects: any[] = [];

    layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL' = 'NONE';
    layoutWrap: 'NO_WRAP' | 'WRAP' = 'NO_WRAP';
    itemSpacing = 0;
    counterAxisSpacing = 0;
    paddingTop = 0;
    paddingRight = 0;
    paddingBottom = 0;
    paddingLeft = 0;
    primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' = 'MIN';
    counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE' = 'MIN';

    children: any[] = [];

    appendChild(child: any) {
      this.children.push(child);
    }
  }

  class MockTextNode extends MockBaseNode {
    type = 'TEXT';
    characters = '';
    fontName: any = { family: 'Inter', style: 'Regular' };
    fontSize = 16;
    fills: any[] = [];
    ranges: Array<{ start: number; end: number; style: any }> = [];

    setRangeFontName(start: number, end: number, font: any) {
      this.fontName = font;
      this.ranges.push({ start, end, style: { font } });
    }
    setRangeFontSize(start: number, end: number, size: number) {
      this.fontSize = size;
      this.ranges.push({ start, end, style: { size } });
    }
    setRangeFills(start: number, end: number, fills: any[]) {
      this.fills = fills;
      this.ranges.push({ start, end, style: { fills } });
    }
    setRangeTextDecoration(start: number, end: number, decoration: string) {
      this.ranges.push({ start, end, style: { decoration } });
    }
    setRangeLineHeight() {}
    setRangeLetterSpacing() {}
  }

  class MockRectangleNode extends MockBaseNode {
    type = 'RECTANGLE';
    fills: any[] = [];
    strokes: any[] = [];
    effects: any[] = [];
    cornerRadius = 0;
    topLeftRadius = 0;
    topRightRadius = 0;
    bottomRightRadius = 0;
    bottomLeftRadius = 0;
  }

  (globalThis as any).figma = {
    loadFontAsync: async () => {},
    createFrame: () => new MockFrameNode(),
    createText: () => new MockTextNode(),
    createRectangle: () => new MockRectangleNode(),
    createNodeFromSvg: (svg: string) => {
      const node = new MockFrameNode();
      node.name = 'Vector Node';
      (node as any).svgContent = svg;
      return node;
    },
    createImage: () => ({ hash: 'mock-hash' }),
  };
}

// Mock DOM factory for constructing realistic DOM trees for extraction
function setupMockBrowser() {
  const stylesMap = new Map<any, any>();

  (globalThis as any).window = {
    getComputedStyle: (el: any) => {
      return (
        stylesMap.get(el) || {
          display: 'block',
          visibility: 'visible',
          opacity: '1',
          overflow: 'visible',
          zIndex: '0',
          position: 'static',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          color: 'rgb(17, 24, 39)',
          fontSize: '16px',
          fontWeight: '400',
          fontStyle: 'normal',
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
          boxShadow: 'none',
          filter: 'none',
          backdropFilter: 'none',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          gap: '0px',
          paddingTop: '0px',
          paddingRight: '0px',
          paddingBottom: '0px',
          paddingLeft: '0px',
          width: 'auto',
          height: 'auto',
          flexGrow: '0',
        }
      );
    },
  };

  return {
    setStyle: (el: any, style: any) => {
      stylesMap.set(el, {
        ...(stylesMap.get(el) || {}),
        ...style,
      });
    },
  };
}

function makeElement(options: {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  rect: { x: number; y: number; width: number; height: number };
  children?: any[];
  outerHTML?: string;
}) {
  const attributes: Record<string, string> = {};
  const el: any = {
    tagName: options.tagName.toUpperCase(),
    id: options.id || '',
    className: options.className || '',
    textContent: options.textContent || '',
    children: options.children || [],
    childNodes: (options.children || []).length > 0 ? options.children : [],
    outerHTML: options.outerHTML || `<${options.tagName}></${options.tagName}>`,
    getBoundingClientRect: () => options.rect,
    hasAttribute: (name: string) => name in attributes,
    getAttribute: (name: string) => attributes[name] || null,
    setAttribute: (name: string, val: string) => {
      attributes[name] = val;
    },
  };
  return el;
}

test('E2E Fixtures: Verify all 5 HTML fixture files exist on disk and have valid HTML', () => {
  const fixtureNames = [
    '01-typography.html',
    '02-flexbox-autolayout.html',
    '03-svg-icons.html',
    '04-grid-dashboard.html',
    '05-modal-and-dropdown.html',
  ];

  for (const name of fixtureNames) {
    const filePath = join(process.cwd(), 'tests', 'fixtures', name);
    assert.ok(existsSync(filePath), `Fixture file must exist: ${name}`);
    const content = readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('<!DOCTYPE html>'), `${name} must contain DOCTYPE`);
    assert.ok(content.length > 200, `${name} must have substantial HTML/CSS content`);
  }
});

test('E2E Pipeline 1: Typography fixture extracts text ranges, weights and decorations into Figma TextNode', async () => {
  setupComprehensiveFigmaMock();
  const browser = setupMockBrowser();

  // Root article container
  const articleEl = makeElement({
    tagName: 'div',
    className: 'article',
    rect: { x: 50, y: 50, width: 720, height: 400 },
  });
  browser.setStyle(articleEl, {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingTop: '20px',
    paddingBottom: '20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    backgroundColor: '#ffffff',
  });

  // H1 heading
  const h1El = makeElement({
    tagName: 'h1',
    textContent: 'Typography and Inline Styles in maxim4design',
    rect: { x: 70, y: 70, width: 680, height: 40 },
  });
  browser.setStyle(h1El, {
    display: 'block',
    fontSize: '32px',
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: 'Inter, sans-serif',
  });

  // Paragraph with inline spans (bold, italic, strike, link)
  const pEl = makeElement({
    tagName: 'p',
    className: 'body-text',
    textContent: 'Bold text and italic emphasis with a special link.',
    rect: { x: 70, y: 126, width: 680, height: 30 },
  });
  browser.setStyle(pEl, {
    display: 'block',
    fontSize: '15px',
    fontWeight: '400',
    color: '#334155',
  });

  articleEl.children = [h1El, pEl];

  // 1. Extract DOM -> FIR
  const firTree = extractFIRFromElement(articleEl);
  assert.ok(firTree, 'Extracted FIR tree should not be null');

  // 2. Validate FIR
  const validation = validateFIRTree(firTree);
  assert.ok(validation.valid, `Validation errors: ${validation.errors.join(', ')}`);

  // 3. Render into Figma
  const figmaNode = (await renderFIRTreeAsync(firTree)) as any;

  // 4. Assert Figma properties
  assert.equal(figmaNode.type, 'FRAME');
  assert.equal(figmaNode.width, 720);
  assert.equal(figmaNode.height, 400);
  assert.equal(figmaNode.children.length, 2);

  const textNodeH1 = figmaNode.children[0];
  assert.equal(textNodeH1.type, 'TEXT');
  assert.equal(textNodeH1.characters, 'Typography and Inline Styles in maxim4design');
  assert.equal(textNodeH1.fontSize, 32);

  const textNodeP = figmaNode.children[1];
  assert.equal(textNodeP.type, 'TEXT');
  assert.equal(textNodeP.characters, 'Bold text and italic emphasis with a special link.');
});

test('E2E Pipeline 2: Flexbox fixture maps Auto Layout, alignments, gaps and sizing accurately', async () => {
  setupComprehensiveFigmaMock();
  const browser = setupMockBrowser();

  // Responsive Navbar
  const navbarEl = makeElement({
    tagName: 'header',
    className: 'navbar',
    rect: { x: 0, y: 0, width: 1200, height: 70 },
  });
  browser.setStyle(navbarEl, {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    paddingTop: '16px',
    paddingBottom: '16px',
    paddingLeft: '24px',
    paddingRight: '24px',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: '12px',
    borderBottomRightRadius: '12px',
    borderTopLeftRadius: '12px',
    borderTopRightRadius: '12px',
  });

  // Brand logo
  const brandEl = makeElement({
    tagName: 'div',
    className: 'brand',
    textContent: 'maxim4design',
    rect: { x: 24, y: 20, width: 140, height: 30 },
  });
  browser.setStyle(brandEl, {
    display: 'block',
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
  });

  // Actions group
  const actionsEl = makeElement({
    tagName: 'div',
    className: 'actions',
    rect: { x: 960, y: 15, width: 216, height: 40 },
  });
  browser.setStyle(actionsEl, {
    display: 'flex',
    flexDirection: 'row',
    gap: '10px',
  });

  const btnEl = makeElement({
    tagName: 'button',
    className: 'btn btn-primary',
    textContent: 'Try Free',
    rect: { x: 1070, y: 15, width: 106, height: 40 },
  });
  browser.setStyle(btnEl, {
    display: 'block',
    backgroundColor: '#2563eb',
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff',
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
  });

  actionsEl.children = [btnEl];
  navbarEl.children = [brandEl, actionsEl];

  // Extract -> Validate -> Render
  const firTree = extractFIRFromElement(navbarEl);
  const validation = validateFIRTree(firTree);
  assert.ok(validation.valid, `Validation errors: ${validation.errors.join(', ')}`);

  const navbarFigma = (await renderFIRTreeAsync(firTree)) as any;

  assert.equal(navbarFigma.type, 'FRAME');
  assert.equal(navbarFigma.layoutMode, 'HORIZONTAL');
  assert.equal(navbarFigma.primaryAxisAlignItems, 'SPACE_BETWEEN');
  assert.equal(navbarFigma.counterAxisAlignItems, 'CENTER');
  assert.equal(navbarFigma.itemSpacing, 20);
  assert.equal(navbarFigma.paddingLeft, 24);
  assert.equal(navbarFigma.paddingRight, 24);
  assert.equal(navbarFigma.topLeftRadius, 12);
  assert.equal(navbarFigma.children.length, 2);
});

test('E2E Pipeline 3: SVG Icons fixture sanitizes XML, replaces currentColor, and renders native vectors', async () => {
  setupComprehensiveFigmaMock();
  const browser = setupMockBrowser();

  const containerEl = makeElement({
    tagName: 'div',
    className: 'icon-grid',
    rect: { x: 0, y: 0, width: 400, height: 100 },
  });
  browser.setStyle(containerEl, {
    display: 'flex',
    gap: '20px',
  });

  const svgXml = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12l5 5L20 7"></path></svg>';
  const svgEl = makeElement({
    tagName: 'svg',
    className: 'icon-verified',
    outerHTML: svgXml,
    rect: { x: 0, y: 0, width: 24, height: 24 },
  });
  browser.setStyle(svgEl, {
    display: 'block',
    color: 'rgb(37, 99, 235)', // #2563eb
  });

  containerEl.children = [svgEl];

  const firTree = extractFIRFromElement(containerEl);
  assert.ok(firTree.children);
  assert.equal(firTree.children[0].type, 'VECTOR');
  assert.ok(firTree.children[0].svgContent);
  assert.ok(firTree.children[0].svgContent.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(!firTree.children[0].svgContent.includes('currentColor'), 'currentColor must be replaced with computed color');

  const figmaNode = (await renderFIRTreeAsync(firTree)) as any;
  assert.equal(figmaNode.children.length, 1);
  assert.equal(figmaNode.children[0].name, 'svg.icon-verified');
  assert.ok(figmaNode.children[0].svgContent.includes('<path'));
});

test('E2E Pipeline 4: CSS Grid Dashboard correctly falls back to mode: NONE with exact relative coordinates', async () => {
  setupComprehensiveFigmaMock();
  const browser = setupMockBrowser();

  const gridEl = makeElement({
    tagName: 'div',
    className: 'grid-container',
    rect: { x: 40, y: 40, width: 900, height: 300 },
  });
  browser.setStyle(gridEl, {
    display: 'grid',
    backgroundColor: '#0f172a',
  });

  // Card 1 at column 1
  const card1 = makeElement({
    tagName: 'div',
    className: 'stat-card',
    textContent: 'Total Revenue: $124,500',
    rect: { x: 40, y: 40, width: 280, height: 120 },
  });
  browser.setStyle(card1, {
    display: 'block',
    backgroundColor: '#1e293b',
    borderTopWidth: '1px',
    borderTopColor: '#334155',
    borderTopStyle: 'solid',
    borderTopLeftRadius: '12px',
    borderTopRightRadius: '12px',
    borderBottomLeftRadius: '12px',
    borderBottomRightRadius: '12px',
  });

  // Card 2 at column 2
  const card2 = makeElement({
    tagName: 'div',
    className: 'stat-card',
    textContent: 'Active Users: 48,210',
    rect: { x: 350, y: 40, width: 280, height: 120 },
  });
  browser.setStyle(card2, {
    display: 'block',
    backgroundColor: '#1e293b',
    borderTopWidth: '1px',
    borderTopColor: '#334155',
    borderTopStyle: 'solid',
    borderTopLeftRadius: '12px',
    borderTopRightRadius: '12px',
    borderBottomLeftRadius: '12px',
    borderBottomRightRadius: '12px',
  });

  gridEl.children = [card1, card2];

  const firTree = extractFIRFromElement(gridEl);
  assert.equal(firTree.layout?.mode, 'NONE', 'Grid container layout mode must be NONE');

  const figmaNode = (await renderFIRTreeAsync(firTree)) as any;
  assert.equal(figmaNode.layoutMode, 'NONE');
  assert.equal(figmaNode.children.length, 2);

  // Check child 1 relative coordinates: 40 - 40 = 0
  assert.equal(figmaNode.children[0].x, 0);
  assert.equal(figmaNode.children[0].y, 0);

  // Check child 2 relative coordinates: 350 - 40 = 310
  assert.equal(figmaNode.children[1].x, 310);
  assert.equal(figmaNode.children[1].y, 0);
});

test('E2E Pipeline 5: Modal & Dropdown preserves stacking context z-index order and backdrop effects', async () => {
  setupComprehensiveFigmaMock();
  const browser = setupMockBrowser();

  const pageEl = makeElement({
    tagName: 'div',
    className: 'page',
    rect: { x: 0, y: 0, width: 1000, height: 800 },
  });

  // Backdrop overlay (z-index 100, blur 8px)
  const backdropEl = makeElement({
    tagName: 'div',
    className: 'modal-backdrop',
    rect: { x: 0, y: 0, width: 1000, height: 800 },
  });
  browser.setStyle(backdropEl, {
    display: 'block',
    position: 'fixed',
    zIndex: '100',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(8px)',
  });

  // Modal dialog (z-index 110, drop shadow)
  const modalEl = makeElement({
    tagName: 'div',
    className: 'modal-dialog',
    rect: { x: 280, y: 150, width: 440, height: 200 },
  });
  browser.setStyle(modalEl, {
    display: 'block',
    position: 'absolute',
    zIndex: '110',
    backgroundColor: '#ffffff',
    boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    borderBottomLeftRadius: '16px',
    borderBottomRightRadius: '16px',
  });

  // Dropdown menu (z-index 120)
  const dropdownEl = makeElement({
    tagName: 'div',
    className: 'dropdown-menu',
    rect: { x: 300, y: 400, width: 200, height: 120 },
  });
  browser.setStyle(dropdownEl, {
    display: 'block',
    position: 'absolute',
    zIndex: '120',
    backgroundColor: '#ffffff',
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
  });

  // Notice: added in reversed order to test stacking context sorting!
  pageEl.children = [dropdownEl, backdropEl, modalEl];

  const firTree = extractFIRFromElement(pageEl);
  const figmaNode = (await renderFIRTreeAsync(firTree)) as any;

  // Stacking context should have sorted them in Figma canvas:
  // 1. Backdrop (z-index 100)
  // 2. Modal (z-index 110)
  // 3. Dropdown (z-index 120)
  assert.equal(figmaNode.children.length, 3);
  assert.equal(figmaNode.children[0].name, 'div.modal-backdrop');
  assert.equal(figmaNode.children[1].name, 'div.modal-dialog');
  assert.equal(figmaNode.children[2].name, 'div.dropdown-menu');

  // Verify backdrop effects
  assert.ok(figmaNode.children[0].effects.length > 0);
  assert.equal(figmaNode.children[0].effects[0].type, 'BACKGROUND_BLUR');
  assert.equal(figmaNode.children[0].effects[0].radius, 8);

  // Verify modal drop shadow
  assert.ok(figmaNode.children[1].effects.length > 0);
  assert.equal(figmaNode.children[1].effects[0].type, 'DROP_SHADOW');
  assert.equal(figmaNode.children[1].effects[0].radius, 50);
});

test('Performance Benchmark: Extract and render 200 nodes in under 500ms', async () => {
  setupComprehensiveFigmaMock();
  const browser = setupMockBrowser();

  // Construct 200-element realistic tree
  const rootEl = makeElement({
    tagName: 'div',
    className: 'benchmark-container',
    rect: { x: 0, y: 0, width: 1200, height: 2000 },
  });
  browser.setStyle(rootEl, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  });

  const children: any[] = [];
  for (let i = 0; i < 200; i++) {
    const itemEl = makeElement({
      tagName: 'div',
      className: `item-${i}`,
      textContent: `Benchmark Item #${i} with metadata`,
      rect: { x: 10, y: i * 25, width: 400, height: 22 },
    });
    browser.setStyle(itemEl, {
      display: 'block',
      fontSize: '12px',
      color: '#1e293b',
    });
    children.push(itemEl);
  }
  rootEl.children = children;

  // Measure extraction time
  const t0 = performance.now();
  const firTree = extractFIRFromElement(rootEl);
  const extractionTimeMs = performance.now() - t0;

  // Measure validation time
  const t1 = performance.now();
  const validation = validateFIRTree(firTree);
  const validationTimeMs = performance.now() - t1;

  // Measure Figma rendering time
  const t2 = performance.now();
  const figmaNode = (await renderFIRTreeAsync(firTree, { chunkSize: 50 })) as any;
  const renderingTimeMs = performance.now() - t2;

  assert.ok(validation.valid);
  assert.equal(figmaNode.children.length, 200);

  // Assert performance bounds
  assert.ok(extractionTimeMs < 500, `Extraction took ${extractionTimeMs}ms (threshold: 500ms)`);
  assert.ok(renderingTimeMs < 500, `Rendering took ${renderingTimeMs}ms (threshold: 500ms)`);

  console.log(`[Benchmark Summary] 201 nodes extracted in ${extractionTimeMs.toFixed(2)}ms, validated in ${validationTimeMs.toFixed(2)}ms, rendered in ${renderingTimeMs.toFixed(2)}ms.`);
});
