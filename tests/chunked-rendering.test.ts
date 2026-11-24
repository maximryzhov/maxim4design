import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  countFIRNodes,
  collectFontsFromTree,
  renderFIRTreeAsync,
} from '../src/plugin/node-factory.ts';
import { FontManager } from '../src/plugin/font-manager.ts';
import type { FIRNode } from '../src/types/fir.ts';

// Setup Mock Figma environment for chunked rendering tests
function setupMockFigma() {
  class MockBaseNode {
    id = 'mock-' + Math.random().toString(36).substring(2);
    name = '';
    x = 0;
    y = 0;
    width = 100;
    height = 100;
    opacity = 1;
    visible = true;
    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  }

  class MockFrameNode extends MockBaseNode {
    type = 'FRAME';
    clipsContent = false;
    fills: any[] = [];
    children: any[] = [];
    layoutMode = 'NONE';
    itemSpacing = 0;

    appendChild(child: any) {
      this.children.push(child);
    }
  }

  class MockTextNode extends MockBaseNode {
    type = 'TEXT';
    fontName: any = { family: 'Inter', style: 'Regular' };
    characters = '';
    fontSize = 16;
    fills: any[] = [];
    setRangeFontName(start: number, end: number, font: any) {
      this.fontName = font;
    }
    setRangeFontSize(start: number, end: number, size: number) {
      this.fontSize = size;
    }
    setRangeFills(start: number, end: number, fills: any[]) {
      this.fills = fills;
    }
    setRangeTextDecoration() {}
    setRangeLineHeight() {}
    setRangeLetterSpacing() {}
  }

  class MockRectangleNode extends MockBaseNode {
    type = 'RECTANGLE';
    fills: any[] = [];
  }

  (globalThis as any).figma = {
    loadFontAsync: async () => {},
    createFrame: () => new MockFrameNode(),
    createText: () => new MockTextNode(),
    createRectangle: () => new MockRectangleNode(),
  };
}

test('countFIRNodes counts nodes correctly and respects includeHidden flag', () => {
  const tree: FIRNode = {
    id: 'root',
    name: 'div.root',
    type: 'FRAME',
    bounds: { x: 0, y: 0, width: 500, height: 500 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    children: [
      {
        id: 'child1',
        name: 'div.visible',
        type: 'FRAME',
        bounds: { x: 0, y: 0, width: 200, height: 50 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 0,
        children: [
          {
            id: 'child1-1',
            name: 'span.text',
            type: 'TEXT',
            bounds: { x: 0, y: 0, width: 100, height: 20 },
            visible: true,
            opacity: 1,
            clipsContent: false,
            zIndex: 0,
          },
        ],
      },
      {
        id: 'child2',
        name: 'div.hidden',
        type: 'FRAME',
        bounds: { x: 0, y: 60, width: 200, height: 50 },
        visible: false,
        opacity: 0,
        clipsContent: false,
        zIndex: 0,
        children: [
          {
            id: 'child2-1',
            name: 'span.hidden-text',
            type: 'TEXT',
            bounds: { x: 0, y: 0, width: 100, height: 20 },
            visible: false,
            opacity: 0,
            clipsContent: false,
            zIndex: 0,
          },
        ],
      },
    ],
  };

  // With hidden: root (1) + child1 (1) + child1-1 (1) + child2 (1) + child2-1 (1) = 5
  assert.equal(countFIRNodes(tree, true), 5);

  // Without hidden: root (1) + child1 (1) + child1-1 (1) = 3
  assert.equal(countFIRNodes(tree, false), 3);
});

test('collectFontsFromTree collects all unique font combinations', () => {
  const tree: FIRNode = {
    id: 'root',
    name: 'root',
    type: 'FRAME',
    bounds: { x: 0, y: 0, width: 300, height: 300 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    children: [
      {
        id: 't1',
        name: 'text1',
        type: 'TEXT',
        bounds: { x: 0, y: 0, width: 200, height: 20 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 0,
        textData: {
          characters: 'Bold and Regular',
          segments: [
            { start: 0, end: 4, fontFamily: 'Roboto', fontWeight: 700 },
            { start: 5, end: 16, fontFamily: 'Roboto', fontWeight: 400 },
          ],
        },
      },
      {
        id: 't2',
        name: 'text2',
        type: 'TEXT',
        bounds: { x: 0, y: 30, width: 200, height: 20 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 0,
        textData: {
          characters: 'Italic text',
          segments: [
            { start: 0, end: 11, fontFamily: 'Open Sans', fontWeight: 400, fontStyle: 'italic' },
            // Duplicate Roboto 700 should be deduped
            { start: 0, end: 11, fontFamily: 'Roboto', fontWeight: 700 },
          ],
        },
      },
    ],
  };

  const fonts = collectFontsFromTree(tree);
  assert.equal(fonts.length, 3);
  assert.ok(fonts.some((f) => f.family === 'Roboto' && f.weight === 700 && !f.isItalic));
  assert.ok(fonts.some((f) => f.family === 'Roboto' && f.weight === 400 && !f.isItalic));
  assert.ok(fonts.some((f) => f.family === 'Open Sans' && f.weight === 400 && f.isItalic));
});

test('FontManager records fallback warnings for missing fonts', async () => {
  let callCount = 0;
  (globalThis as any).figma = {
    loadFontAsync: async (f: { family: string; style: string }) => {
      callCount++;
      if (f.family === 'MissingCustomFont') {
        throw new Error('Not found');
      }
    },
  };

  const fm = new FontManager();
  fm.clearWarnings();

  const font = await fm.loadFontSafely('MissingCustomFont', 700);
  assert.equal(font.family, 'Inter');
  assert.equal(font.style, 'Bold');

  const warnings = fm.getWarnings();
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('MissingCustomFont'));
  assert.ok(warnings[0].includes('Inter (Bold)'));

  fm.clearWarnings();
  assert.equal(fm.getWarnings().length, 0);
});

test('renderFIRTreeAsync renders with chunking and triggers onProgress callback', async () => {
  setupMockFigma();

  // Create a large synthetic tree (120 nodes) to test chunking
  const children: FIRNode[] = [];
  for (let i = 0; i < 120; i++) {
    children.push({
      id: `child-${i}`,
      name: `item-${i}`,
      type: 'RECTANGLE',
      bounds: { x: 10, y: i * 20, width: 100, height: 18 },
      visible: true,
      opacity: 1,
      clipsContent: false,
      zIndex: 0,
    });
  }

  const largeTree: FIRNode = {
    id: 'container',
    name: 'div.list',
    type: 'FRAME',
    bounds: { x: 0, y: 0, width: 300, height: 2500 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    children,
  };

  const progressReports: Array<{ current: number; total: number; nodeName: string }> = [];

  const rootSceneNode = (await renderFIRTreeAsync(largeTree, {
    chunkSize: 40,
    onProgress: (current, total, nodeName) => {
      progressReports.push({ current, total, nodeName });
    },
  })) as any;

  assert.equal(rootSceneNode.name, 'div.list');
  assert.equal(rootSceneNode.children.length, 120);

  // Progress callback should have fired multiple times during chunking (121 total nodes / 40 chunk size)
  assert.ok(progressReports.length >= 2, `Expected >= 2 reports, got ${progressReports.length}`);
  assert.equal(progressReports[0].total, 121);
});

test('renderFIRTreeAsync respects useAutoLayout: false setting', async () => {
  setupMockFigma();

  const flexTree: FIRNode = {
    id: 'flex-box',
    name: 'div.flex',
    type: 'FRAME',
    bounds: { x: 0, y: 0, width: 400, height: 200 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    layout: {
      mode: 'HORIZONTAL',
      wrap: false,
      itemSpacing: 10,
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
      primaryAlign: 'MIN',
      counterAlign: 'MIN',
      sizingHorizontal: 'FIXED',
      sizingVertical: 'FIXED',
    },
    children: [
      {
        id: 'box-1',
        name: 'item1',
        type: 'RECTANGLE',
        bounds: { x: 10, y: 10, width: 80, height: 80 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 0,
      },
    ],
  };

  // With useAutoLayout: false, layoutMode should remain NONE
  const manualNode = (await renderFIRTreeAsync(flexTree, {
    useAutoLayout: false,
  })) as any;

  assert.equal(manualNode.layoutMode, 'NONE');
});

test('Plugin UI HTML contains necessary components and handlers', () => {
  const uiPath = join(process.cwd(), 'src/plugin/ui.html');
  const html = readFileSync(uiPath, 'utf-8');

  // One-click clipboard button
  assert.ok(html.includes('id="pasteBtn"'), 'Must have pasteBtn element');
  assert.ok(html.includes('navigator.clipboard.readText()'), 'Must use navigator.clipboard.readText()');

  // Import options
  assert.ok(html.includes('id="autoLayoutToggle"'), 'Must have autoLayoutToggle');
  assert.ok(html.includes('id="hiddenNodesToggle"'), 'Must have hiddenNodesToggle');

  // Progress bar
  assert.ok(html.includes('id="progressSection"'), 'Must have progressSection');
  assert.ok(html.includes('id="progressFill"'), 'Must have progressFill');
  assert.ok(html.includes('id="progressPercent"'), 'Must have progressPercent');

  // Warnings and retry
  assert.ok(html.includes('id="warningsCard"'), 'Must have warningsCard');
  assert.ok(html.includes('id="retryBtn"'), 'Must have retryBtn');
});
