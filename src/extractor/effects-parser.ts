import type { ShadowEffect, RGBAColor } from '../types/fir.ts';
import { parseCssColor } from './dom-extractor.ts';

/**
 * Splits a comma-separated CSS value string while respecting parentheses.
 */
function splitCssValues(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += char;
    } else if (char === ',' && parenDepth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Parses a CSS box-shadow string into an array of ShadowEffect objects.
 */
export function parseBoxShadow(boxShadowStr?: string): ShadowEffect[] {
  if (!boxShadowStr || boxShadowStr.trim() === '' || boxShadowStr.trim() === 'none') {
    return [];
  }

  const rawShadows = splitCssValues(boxShadowStr);
  const effects: ShadowEffect[] = [];

  for (const raw of rawShadows) {
    let s = raw.trim();
    if (!s || s === 'none') continue;

    // Check inset
    const isInset = /\binset\b/i.test(s);
    s = s.replace(/\binset\b/gi, '').trim();

    // Extract color: match rgba(...), rgb(...), #hex
    let color: RGBAColor = { r: 0, g: 0, b: 0, a: 0.25 };
    const colorMatch = s.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/);
    if (colorMatch) {
      const parsed = parseCssColor(colorMatch[0]);
      if (parsed) {
        color = parsed;
      }
      s = s.replace(colorMatch[0], '').trim();
    }

    // Remaining tokens are length dimensions: x, y, blur, spread
    const lengths = s
      .split(/\s+/)
      .map((val) => parseFloat(val))
      .filter((val) => !isNaN(val));

    const x = lengths[0] || 0;
    const y = lengths[1] || 0;
    const radius = Math.max(0, lengths[2] || 0);
    const spread = lengths[3] || 0;

    effects.push({
      type: isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color,
      offset: { x, y },
      radius,
      spread,
      visible: true,
    });
  }

  return effects;
}

/**
 * Parses layer blur and backdrop-filter (glassmorphism) blur in pixels.
 */
export function parseBlur(
  computed: CSSStyleDeclaration
): { blur?: number; backgroundBlur?: number } {
  let blur: number | undefined;
  let backgroundBlur: number | undefined;

  // Layer filter blur(Xpx)
  const filter = computed.filter || '';
  const filterMatch = filter.match(/blur\(\s*([\d.]+)px\s*\)/i);
  if (filterMatch) {
    const val = parseFloat(filterMatch[1]);
    if (!isNaN(val) && val > 0) {
      blur = val;
    }
  }

  // Backdrop-filter blur(Xpx)
  const backdropFilter =
    computed.backdropFilter ||
    (computed as unknown as Record<string, string>)['webkitBackdropFilter'] ||
    '';
  const backdropMatch = backdropFilter.match(/blur\(\s*([\d.]+)px\s*\)/i);
  if (backdropMatch) {
    const val = parseFloat(backdropMatch[1]);
    if (!isNaN(val) && val > 0) {
      backgroundBlur = val;
    }
  }

  return { blur, backgroundBlur };
}
