import type { FIRFontAsset } from '../types/fir.ts';

function cleanFamilyName(raw: string): string {
  return raw.replace(/^['"]|['"]$/g, '').trim();
}

/**
 * Extracts all url(...) entries from a CSS @font-face src declaration,
 * preferring woff2/ttf/otf or data:font/* URIs.
 */
function extractFirstFontSrc(srcCss: string): { sourceUrl?: string; format?: string } {
  if (!srcCss) return {};
  const matches = Array.from(srcCss.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/gi));
  if (matches.length === 0) return {};

  // Prefer data: URI or ttf/otf/woff2
  let chosen = matches[0];
  for (const m of matches) {
    const url = (m[1] || '').trim();
    const fmt = (m[2] || '').toLowerCase();
    if (url.startsWith('data:font/') || fmt === 'woff2' || fmt === 'truetype') {
      chosen = m;
      break;
    }
  }

  const sourceUrl = chosen[1].trim();
  let format = chosen[2] ? chosen[2].toLowerCase() : undefined;
  if (!format) {
    if (sourceUrl.startsWith('data:font/woff2') || sourceUrl.includes('.woff2')) format = 'woff2';
    else if (sourceUrl.startsWith('data:font/woff') || sourceUrl.includes('.woff')) format = 'woff';
    else if (sourceUrl.startsWith('data:font/ttf') || sourceUrl.includes('.ttf')) format = 'ttf';
    else if (sourceUrl.startsWith('data:font/otf') || sourceUrl.includes('.otf')) format = 'otf';
  }
  return { sourceUrl, format };
}

/**
 * Extracts @font-face rules and loaded document.fonts metadata from the current browser page.
 * Safely skips cross-origin stylesheets that throw SecurityError on cssRules access.
 */
export function extractPageFonts(): FIRFontAsset[] {
  if (typeof document === 'undefined') return [];

  const collected = new Map<string, FIRFontAsset>();

  const addAsset = (asset: FIRFontAsset) => {
    if (!asset.family) return;
    const key = `${asset.family.toLowerCase()}::${asset.weight || '400'}::${asset.style || 'normal'}`;
    const existing = collected.get(key);
    if (!existing) {
      collected.set(key, asset);
    } else if (!existing.sourceUrl && asset.sourceUrl) {
      collected.set(key, { ...existing, sourceUrl: asset.sourceUrl, format: asset.format });
    }
  };

  // 1. CSS Font Loading API (document.fonts)
  try {
    const fontSet = (document as unknown as { fonts?: Iterable<any> }).fonts;
    if (fontSet) {
      for (const ff of fontSet) {
        if (ff && ff.family) {
          addAsset({
            family: cleanFamilyName(String(ff.family)),
            weight: ff.weight ? String(ff.weight) : '400',
            style: ff.style ? String(ff.style) : 'normal',
          });
        }
      }
    }
  } catch {
    // Ignore environments without document.fonts
  }

  // 2. CSSFontFaceRule traversal across document.styleSheets
  try {
    const sheets = document.styleSheets;
    if (sheets) {
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        let rules: CSSRuleList | undefined;
        try {
          rules = sheet.cssRules;
        } catch {
          // Cross-origin stylesheet — skip safely
          continue;
        }
        if (!rules) continue;
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j] as any;
          const isFontFace =
            rule &&
            (rule.type === 5 || rule.constructor?.name === 'CSSFontFaceRule') &&
            rule.style;
          if (!isFontFace) continue;

          const rawFamily = rule.style.getPropertyValue('font-family') || '';
          const family = cleanFamilyName(rawFamily);
          if (!family) continue;

          const weight = (rule.style.getPropertyValue('font-weight') || '400').trim();
          const style = (rule.style.getPropertyValue('font-style') || 'normal').trim();
          const srcCss = rule.style.getPropertyValue('src') || '';
          const { sourceUrl, format } = extractFirstFontSrc(srcCss);

          addAsset({ family, weight, style, sourceUrl, format });
        }
      }
    }
  } catch {
    // Ignore
  }

  return Array.from(collected.values());
}
