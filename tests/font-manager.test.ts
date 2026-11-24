import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FontManager,
  mapWeightToFigmaStyle,
  cleanFontFamily,
  selectMissingFontAssets,
} from '../src/plugin/font-manager.ts';

function setupMockFigma(availableFonts: Set<string>) {
  let callCount = 0;
  const loadedKeys: string[] = [];

  (globalThis as any).figma = {
    loadFontAsync: async (font: { family: string; style: string }) => {
      callCount += 1;
      const key = `${font.family}::${font.style}`;
      if (!availableFonts.has(key)) {
        throw new Error(`Font not found: ${key}`);
      }
      loadedKeys.push(key);
    },
  };

  return {
    getCallCount: () => callCount,
    getLoadedKeys: () => loadedKeys,
  };
}

test('mapWeightToFigmaStyle maps weights and italics correctly', () => {
  assert.equal(mapWeightToFigmaStyle(100), 'Extra Light');
  assert.equal(mapWeightToFigmaStyle(300), 'Light');
  assert.equal(mapWeightToFigmaStyle(400), 'Regular');
  assert.equal(mapWeightToFigmaStyle(500), 'Medium');
  assert.equal(mapWeightToFigmaStyle(600), 'Semi Bold');
  assert.equal(mapWeightToFigmaStyle(700), 'Bold');
  assert.equal(mapWeightToFigmaStyle(800), 'Extra Bold');
  assert.equal(mapWeightToFigmaStyle(900), 'Black');

  assert.equal(mapWeightToFigmaStyle(400, true), 'Italic');
  assert.equal(mapWeightToFigmaStyle(700, true), 'Bold Italic');
});

test('cleanFontFamily strips quotes and sans-serif keywords', () => {
  assert.equal(cleanFontFamily('"SF Pro Display", sans-serif'), 'SF Pro Display');
  assert.equal(cleanFontFamily("'Roboto', Arial"), 'Roboto');
  assert.equal(cleanFontFamily('sans-serif'), 'Inter');
  assert.equal(cleanFontFamily(''), 'Inter');
});

test('FontManager loads requested font if available and caches result', async () => {
  const mock = setupMockFigma(new Set(['Roboto::Bold', 'Inter::Regular']));
  const manager = new FontManager();

  const font = await manager.loadFontSafely('Roboto', 700);
  assert.deepEqual(font, { family: 'Roboto', style: 'Bold' });
  assert.equal(mock.getCallCount(), 1);

  // Second call for same font should hit cache (0 additional Figma API calls)
  const cachedFont = await manager.loadFontSafely('Roboto', 700);
  assert.deepEqual(cachedFont, { family: 'Roboto', style: 'Bold' });
  assert.equal(mock.getCallCount(), 1);
});

test('FontManager falls back to Inter with same style if custom font is missing', async () => {
  const mock = setupMockFigma(new Set(['Inter::Semi Bold', 'Inter::Regular']));
  const manager = new FontManager();

  // Custom font "Geist" is not available, but Inter Semi Bold is
  const font = await manager.loadFontSafely('Geist', 600);
  assert.deepEqual(font, { family: 'Inter', style: 'Semi Bold' });
  // Called Geist (failed) + called Inter Semi Bold (succeeded)
  assert.equal(mock.getCallCount(), 2);
});

test('FontManager falls back to Inter Regular if both custom font and Inter style fail', async () => {
  const mock = setupMockFigma(new Set(['Inter::Regular']));
  const manager = new FontManager();

  // Both "CustomFancy" and "Inter CustomStyle" are not available
  const font = await manager.loadFontSafely('CustomFancy', 900);
  assert.deepEqual(font, { family: 'Inter', style: 'Regular' });
});

test('FontManager preloads batch of fonts', async () => {
  const mock = setupMockFigma(new Set(['Inter::Regular', 'Inter::Bold', 'Inter::Medium']));
  const manager = new FontManager();

  await manager.preloadFonts([
    { family: 'Inter', weight: 400 },
    { family: 'Inter', weight: 500 },
    { family: 'Inter', weight: 700 },
  ]);

  assert.equal(mock.getCallCount(), 3);
});

test('FontManager uses listAvailableFontsAsync for smart style matching within same family', async () => {
  const available = new Set(['Manrope::Regular', 'Manrope::SemiBold', 'Manrope::Bold', 'Inter::Regular']);
  (globalThis as any).figma = {
    listAvailableFontsAsync: async () =>
      Array.from(available).map((key) => {
        const [family, style] = key.split('::');
        return { fontName: { family, style } };
      }),
    loadFontAsync: async (font: { family: string; style: string }) => {
      const key = `${font.family}::${font.style}`;
      if (!available.has(key)) throw new Error(`Not found: ${key}`);
    },
  };

  const manager = new FontManager();
  await manager.initAvailableFonts();

  // Weight 650 maps to "Bold" (<=700), or weight 600 maps to "Semi Bold" -> should match "SemiBold" on Manrope!
  const semi = await manager.loadFontSafely('Manrope', 600);
  assert.deepEqual(semi, { family: 'Manrope', style: 'SemiBold' });

  // Weight 550 maps to "Semi Bold" -> matches "SemiBold" on Manrope without falling back to Inter
  const w550 = await manager.loadFontSafely('Manrope', 550);
  assert.deepEqual(w550, { family: 'Manrope', style: 'SemiBold' });

  assert.equal(manager.getWarnings().length, 0);
});

test('isFamilyAvailable reports families indexed from listAvailableFontsAsync', async () => {
  (globalThis as any).figma = {
    listAvailableFontsAsync: async () => [
      { fontName: { family: 'Manrope', style: 'Regular' } },
      { fontName: { family: 'Oswald', style: 'Bold' } },
    ],
    loadFontAsync: async () => {},
  };

  const manager = new FontManager();
  await manager.initAvailableFonts();

  assert.equal(manager.isFamilyAvailable('Manrope'), true);
  assert.equal(manager.isFamilyAvailable('"Oswald"'), true);
  assert.equal(manager.isFamilyAvailable('ContactBebas'), false);
});

test('selectMissingFontAssets returns only missing families with downloadable sources', () => {
  const fonts = [
    { family: 'ContactBebas', weight: '800', sourceUrl: 'data:font/ttf;base64,AA', format: 'truetype' },
    { family: 'ContactBebas', weight: '800', sourceUrl: 'data:font/ttf;base64,AA', format: 'truetype' },
    { family: 'Manrope', weight: '400', sourceUrl: 'data:font/ttf;base64,BB', format: 'truetype' },
    { family: 'ProcessMontserrat', weight: '700' },
    { family: 'ProcessMontserrat', weight: '700', sourceUrl: 'data:font/ttf;base64,CC', format: 'truetype' },
  ];

  const missing = selectMissingFontAssets(fonts, (family) => family === 'Manrope');

  assert.equal(missing.length, 2);
  assert.deepEqual(missing.map((f) => f.family), ['ContactBebas', 'ProcessMontserrat']);
  assert.ok(missing.every((f) => Boolean(f.sourceUrl)));
});
