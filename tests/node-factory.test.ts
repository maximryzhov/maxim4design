import test from 'node:test';
import assert from 'node:assert/strict';
import { safeLoadFont, renderFIRNode } from '../src/plugin/node-factory.ts';
import type { FIRNode } from '../src/types/fir.ts';

// Setup Figma API mock
function setupFigmaMock() {
  const loadedFonts: string[] = [];

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
    topLeftRadius = 0;
    topRightRadius = 0;
    bottomRightRadius = 0;
    bottomLeftRadius = 0;
    children: any[] = [];

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
    lineHeight: any = null;
    letterSpacing: any = null;

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
    topLeftRadius = 0;
    topRightRadius = 0;
    bottomRightRadius = 0;
    bottomLeftRadius = 0;
  }

  (globalThis as any).figma = {
    loadFontAsync: async (font: { family: string; style: string }) => {
      if (font.family === 'NonExistentFont') {
        throw new Error('Font not found');
      }
      loadedFonts.push(`${font.family}-${font.style}`);
    },
    createFrame: () => new MockFrameNode(),
    createText: () => new MockTextNode(),
    createRectangle: () => new MockRectangleNode(),
  };

  return { loadedFonts };
}

test('safeLoadFont loads font or falls back to Inter Regular', async () => {
  setupFigmaMock();

  const font1 = await safeLoadFont('Inter', 'Bold');
  assert.deepEqual(font1, { family: 'Inter', style: 'Bold' });

  const font2 = await safeLoadFont('NonExistentFont', 'Black');
  assert.deepEqual(font2, { family: 'Inter', style: 'Regular' });
});

test('renderFIRNode creates native nodes with correct relative coordinates and fills', async () => {
  setupFigmaMock();

  const tree: FIRNode = {
    id: 'parent-card',
    name: 'card',
    type: 'FRAME',
    bounds: { x: 100, y: 150, width: 400, height: 250 },
    visible: true,
    opacity: 0.95,
    clipsContent: true,
    zIndex: 0,
    style: {
      backgroundColor: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
      borderRadius: { topLeft: 12, topRight: 12, bottomRight: 12, bottomLeft: 12 },
    },
    children: [
      {
        id: 'child-title',
        name: 'title',
        type: 'TEXT',
        bounds: { x: 120, y: 170, width: 360, height: 30 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 1,
        textData: {
          characters: 'Hello Figma',
          segments: [
            {
              start: 0,
              end: 11,
              fontFamily: 'Inter',
              fontWeight: 700,
              fontSize: 20,
              color: { r: 1, g: 1, b: 1, a: 1 },
            },
          ],
        },
      },
    ],
  };

  const sceneNode = (await renderFIRNode(tree)) as any;

  assert.equal(sceneNode.name, 'card');
  assert.equal(sceneNode.x, 100);
  assert.equal(sceneNode.y, 150);
  assert.equal(sceneNode.width, 400);
  assert.equal(sceneNode.height, 250);
  assert.equal(sceneNode.clipsContent, true);
  assert.equal(sceneNode.opacity, 0.95);
  assert.equal(sceneNode.fills[0].color.r, 0.1);
  assert.equal(sceneNode.topLeftRadius, 12);

  // Check child relative coordinates: 120 - 100 = 20, 170 - 150 = 20
  assert.equal(sceneNode.children.length, 1);
  const child = sceneNode.children[0];
  assert.equal(child.type, 'TEXT');
  assert.equal(child.name, 'title');
  assert.equal(child.x, 20);
  assert.equal(child.y, 20);
  assert.equal(child.characters, 'Hello Figma');
  assert.equal(child.fontSize, 20);
  assert.equal(child.fills[0].color.r, 1);
});
