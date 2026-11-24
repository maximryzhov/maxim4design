import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPageFonts } from '../src/extractor/font-extractor.ts';

test('extractPageFonts collects document.fonts and CSSFontFaceRule while skipping cross-origin sheets', () => {
  (globalThis as any).document = {
    fonts: [
      { family: '"Manrope"', weight: '500', style: 'normal', status: 'loaded' },
      { family: 'Oswald', weight: '700', style: 'normal', status: 'loaded' },
    ],
    styleSheets: [
      {
        // Cross-origin sheet throws SecurityError
        get cssRules() {
          throw new Error('SecurityError: Cannot access rules');
        },
      },
      {
        cssRules: [
          {
            type: 5, // CSSRule.FONT_FACE_RULE
            style: {
              getPropertyValue: (prop: string) => {
                if (prop === 'font-family') return '"ContactBebas"';
                if (prop === 'font-weight') return '800';
                if (prop === 'font-style') return 'normal';
                if (prop === 'src') return 'url("data:font/woff2;base64,AAAA") format("woff2")';
                return '';
              },
            },
          },
        ],
      },
    ],
  };

  const fonts = extractPageFonts();
  assert.equal(fonts.length, 3);

  const manrope = fonts.find((f) => f.family === 'Manrope');
  assert.ok(manrope);
  assert.equal(manrope.weight, '500');

  const bebas = fonts.find((f) => f.family === 'ContactBebas');
  assert.ok(bebas);
  assert.equal(bebas.weight, '800');
  assert.equal(bebas.format, 'woff2');
  assert.equal(bebas.sourceUrl, 'data:font/woff2;base64,AAAA');
});
