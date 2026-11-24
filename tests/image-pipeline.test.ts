import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBackgroundImageUrl,
  mapObjectFitToScaleMode,
  resolveImageUrlToBase64,
  resolveTreeImagesAsync,
  computeTargetImageDimension,
} from '../src/extractor/image-loader.ts';
import {
  base64ToUint8Array,
  createImagePaint,
  renderImageNode,
} from '../src/plugin/image-renderer.ts';
import type { FIRNode } from '../src/types/fir.ts';

test('extractBackgroundImageUrl extracts clean URLs', () => {
  assert.equal(
    extractBackgroundImageUrl('url("https://cdn.example.com/banner.jpg")'),
    'https://cdn.example.com/banner.jpg'
  );
  assert.equal(
    extractBackgroundImageUrl("url('assets/bg.png')"),
    'assets/bg.png'
  );
  assert.equal(extractBackgroundImageUrl('url(hero.webp)'), 'hero.webp');
  assert.equal(extractBackgroundImageUrl('none'), undefined);
  assert.equal(extractBackgroundImageUrl(''), undefined);
});

test('mapObjectFitToScaleMode maps CSS object-fit values to Figma scaleMode', () => {
  assert.equal(mapObjectFitToScaleMode('contain'), 'FIT');
  assert.equal(mapObjectFitToScaleMode('cover'), 'FILL');
  assert.equal(mapObjectFitToScaleMode('none'), 'CROP');
  assert.equal(mapObjectFitToScaleMode(''), 'FILL');
});

test('base64ToUint8Array decodes base64 strings and data URLs', () => {
  // "Hello" in base64 is "SGVsbG8="
  const bytes1 = base64ToUint8Array('SGVsbG8=');
  assert.equal(new TextDecoder().decode(bytes1), 'Hello');

  const bytes2 = base64ToUint8Array('data:image/png;base64,SGVsbG8=');
  assert.equal(new TextDecoder().decode(bytes2), 'Hello');
});

test('renderImageNode creates native Rectangle with ImagePaint or fallback', async () => {
  class MockImageRectangle {
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
    cornerRadius = 0;

    resize(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  }

  (globalThis as any).figma = {
    createRectangle: () => new MockImageRectangle(),
    createImage: (bytes: Uint8Array) => {
      if (bytes.length === 0) throw new Error('Empty image bytes');
      return { hash: 'mock-image-hash-' + bytes.length };
    },
  };

  const validImageNode: FIRNode = {
    id: 'avatar-1',
    name: 'img.avatar',
    type: 'IMAGE',
    bounds: { x: 50, y: 50, width: 80, height: 80 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 1,
    imageData: {
      base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      scaleMode: 'FIT',
    },
    style: {
      borderRadius: { topLeft: 40, topRight: 40, bottomRight: 40, bottomLeft: 40 },
    },
  };

  const rectNode = (await renderImageNode(validImageNode)) as any;
  assert.equal(rectNode.type, 'RECTANGLE');
  assert.equal(rectNode.name, 'img.avatar');
  assert.equal(rectNode.width, 80);
  assert.equal(rectNode.fills.length, 1);
  assert.equal(rectNode.fills[0].type, 'IMAGE');
  assert.equal(rectNode.fills[0].scaleMode, 'FIT');
  assert.ok(rectNode.fills[0].imageHash.includes('mock-image-hash'));

  // Test broken image fallback
  const brokenImageNode: FIRNode = {
    id: 'broken-img',
    name: 'img.broken',
    type: 'IMAGE',
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    imageData: {
      base64: '',
      scaleMode: 'FILL',
    },
  };

  const placeholderNode = (await renderImageNode(brokenImageNode)) as any;
  assert.equal(placeholderNode.type, 'RECTANGLE');
  assert.ok(placeholderNode.name.includes('Placeholder'));
  assert.equal(placeholderNode.fills[0].type, 'SOLID');
});

test('resolveImageUrlToBase64 and resolveTreeImagesAsync handle data URIs and offline HTTP URLs gracefully', async () => {
  const validPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const resolvedData = await resolveImageUrlToBase64(validPng);
  assert.equal(resolvedData, validPng);

  // HTTP URL when fetch/Image is unavailable or fails returns undefined cleanly
  const resolvedHttp = await resolveImageUrlToBase64('https://example.com/missing.png');
  assert.equal(resolvedHttp, undefined);

  const tree: FIRNode = {
    id: 'root',
    name: 'div',
    type: 'FRAME',
    bounds: { x: 0, y: 0, width: 200, height: 200 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    children: [
      {
        id: 'img-1',
        name: 'img.local',
        type: 'IMAGE',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 0,
        imageData: { base64: validPng, scaleMode: 'FILL' },
      },
    ],
  };

  const out = await resolveTreeImagesAsync(tree);
  assert.equal(out.children?.[0].imageData?.base64, validPng);

  // Test external proxy fallback (Chrome Extension background worker simulation)
  const corsTree: FIRNode = {
    id: 'root-cors',
    name: 'div',
    type: 'FRAME',
    bounds: { x: 0, y: 0, width: 200, height: 200 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex: 0,
    children: [
      {
        id: 'img-cors',
        name: 'img#hero-card-image',
        type: 'IMAGE',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        visible: true,
        opacity: 1,
        clipsContent: false,
        zIndex: 0,
        imageData: { base64: 'https://alfa-green.ru/photo.jpg', scaleMode: 'FILL' },
      },
    ],
  };

  const proxiedOut = await resolveTreeImagesAsync(corsTree, 2048, async (url) => {
    assert.equal(url, 'https://alfa-green.ru/photo.jpg');
    return validPng;
  });
  assert.equal(proxiedOut.children?.[0].imageData?.base64, validPng);
});

test('computeTargetImageDimension scales bounds proportionally within [900, maxDimension]', () => {
  assert.equal(computeTargetImageDimension(200, 150, 2048), 900);
  assert.equal(computeTargetImageDimension(800, 600, 2048), 1200);
  assert.equal(computeTargetImageDimension(1800, 1200, 2048), 2048);
  assert.equal(computeTargetImageDimension(0, 0, 2048), 2048);
});
