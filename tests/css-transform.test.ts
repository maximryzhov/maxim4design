import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFIRFromElement } from '../src/extractor/dom-extractor.ts';
import { isMirroredX } from '../src/extractor/image-loader.ts';
import { renderImageNode } from '../src/plugin/image-renderer.ts';
import type { FIRNode } from '../src/types/fir.ts';

const STYLE: Record<string, string> = {
  display: 'block',
  visibility: 'visible',
  opacity: '1',
  overflow: 'visible',
  zIndex: '0',
  position: 'absolute',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  backgroundImage: 'none',
  color: 'rgb(0, 0, 0)',
  fontSize: '16px',
  fontWeight: '400',
  fontFamily: 'Inter',
  fontStyle: 'normal',
  lineHeight: '24px',
  letterSpacing: '0px',
  whiteSpace: 'normal',
  textDecoration: 'none',
  objectFit: 'cover',
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
  paddingTop: '0px',
  paddingRight: '0px',
  paddingBottom: '0px',
  paddingLeft: '0px',
  transform: 'none',
};

function installMock(transform: string) {
  (globalThis as any).window = {
    getComputedStyle: () => ({ ...STYLE, transform }),
  };
}

function imageElement(transform: string) {
  return {
    tagName: 'IMG',
    id: 'contact-plant',
    className: 'contact-plant',
    src: 'https://example.com/plant.jpg',
    currentSrc: 'https://example.com/plant.jpg',
    children: [],
    childNodes: [],
    getBoundingClientRect: () => ({ x: 181, y: 7735, width: 1207, height: 1207 }),
  };
}

test('extractor reads scaleX(-1) from CSS matrix', () => {
  installMock('matrix(-1, 0, 0, 1, 0, 0)');
  const fir = extractFIRFromElement(imageElement('matrix(-1, 0, 0, 1, 0, 0)') as any);
  assert.ok(fir.transform);
  assert.equal(fir.transform!.scaleX, -1);
  assert.equal(fir.transform!.scaleY, 1);
  assert.equal(fir.transform!.rotation, 0);
  assert.equal(fir.imageData?.flipX, true);
});

test('extractor reads rotation from CSS matrix', () => {
  installMock('matrix(0.866, 0.5, -0.5, 0.866, 0, 0)');
  const fir = extractFIRFromElement(
    imageElement('matrix(0.866, 0.5, -0.5, 0.866, 0, 0)') as any
  );
  assert.ok(fir.transform);
  assert.ok(Math.abs(fir.transform!.rotation - 30) < 1);
});

test('isMirroredX detects only negative X scale', () => {
  assert.equal(isMirroredX('matrix(-1, 0, 0, 1, 0, 0)'), true);
  assert.equal(isMirroredX('matrix(1, 0, 0, -1, 0, 0)'), false);
  assert.equal(isMirroredX('matrix(0.866, 0.5, -0.5, 0.866, 0, 0)'), false);
  assert.equal(isMirroredX('none'), false);
  assert.equal(isMirroredX(undefined), false);
});

test('renderImageNode mirrors an image in place for scaleX(-1)', async () => {
  class MockRect {
    type = 'RECTANGLE';
    name = '';
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    opacity = 1;
    visible = true;
    fills: any[] = [];
    strokes: any[] = [];
    relativeTransform: any = [[1, 0, 0], [0, 1, 0]];
    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  }

  const rects: MockRect[] = [];
  (globalThis as any).figma = {
    createRectangle: () => {
      const rect = new MockRect();
      rects.push(rect);
      return rect;
    },
    createImage: () => ({ hash: 'image-hash' }),
  };

  const node: FIRNode = {
    id: 'contact-plant',
    name: 'img.contact-plant',
    type: 'IMAGE',
    bounds: { x: 100, y: 200, width: 300, height: 150 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    imageData: { base64: 'data:image/png;base64,AAAA', scaleMode: 'FILL' },
    transform: { scaleX: -1, scaleY: 1, rotation: 0, translateX: 0, translateY: 0 },
  };

  const rect = (await renderImageNode(node)) as any;
  assert.equal(rect.fills[0].type, 'IMAGE');
  assert.equal(rect.fills[0].scaleMode, 'FILL');
  // Node box stays in place; mirroring is baked into the extracted bitmap.
  assert.equal(rect.relativeTransform[0][0], 1);
  assert.equal(rect.x, 100);
});
