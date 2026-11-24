import type { FIRNode, FIRBounds, TextSegment } from '../types/fir.ts';
import { extractElementStyles } from './style-extractor.ts';
import { parseCssColor } from './dom-extractor.ts';

/**
 * Extracts a CSS pseudo-element (::before or ::after) if it is rendered and visible.
 */
export function extractPseudoElement(
  element: HTMLElement,
  pseudo: '::before' | '::after',
  parentBounds: FIRBounds
): FIRNode | undefined {
  if (typeof window === 'undefined' || !window.getComputedStyle) {
    return undefined;
  }

  const computed = window.getComputedStyle(element, pseudo);
  if (!computed) return undefined;

  const display = computed.display;
  if (display === 'none') return undefined;

  const rawContent = computed.content;
  const isNoneContent =
    !rawContent ||
    rawContent === 'none' ||
    rawContent === 'normal' ||
    rawContent === '""' ||
    rawContent === "''";

  const w = parseFloat(computed.width) || 0;
  const h = parseFloat(computed.height) || 0;
  const style = extractElementStyles(computed);
  const hasVisualDecoration =
    (w > 0 && h > 0) &&
    (Boolean(style.backgroundColor) || Boolean(style.borders) || Boolean(style.shadows));

  if (isNoneContent && !hasVisualDecoration) {
    return undefined;
  }

  // Clean quotes from content string
  const cleanContent = rawContent ? rawContent.replace(/^['"]|['"]$/g, '') : '';
  const pseudoName = pseudo.replace(/^::/, '');
  const id = `${element.id || 'el'}-${pseudoName}`;
  const name = `::${pseudoName}`;

  // Calculate pseudo element bounds
  let posX = parentBounds.x;
  let posY = parentBounds.y;
  let width = w > 0 ? w : parentBounds.width;
  let height = h > 0 ? h : parentBounds.height;

  if (computed.position === 'absolute') {
    const top = parseFloat(computed.top);
    const left = parseFloat(computed.left);
    const right = parseFloat(computed.right);
    const bottom = parseFloat(computed.bottom);

    if (!isNaN(left)) {
      posX = parentBounds.x + left;
    } else if (!isNaN(right)) {
      posX = parentBounds.x + parentBounds.width - width - right;
    }

    if (!isNaN(top)) {
      posY = parentBounds.y + top;
    } else if (!isNaN(bottom)) {
      posY = parentBounds.y + parentBounds.height - height - bottom;
    }
  }

  const bounds: FIRBounds = {
    x: Math.round(posX * 100) / 100,
    y: Math.round(posY * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
  };

  const opacity = parseFloat(computed.opacity) || 1;
  const zIndex = parseInt(computed.zIndex, 10) || 0;

  // If pseudo-element has text content (e.g. icon font glyph or label)
  if (cleanContent.trim() !== '') {
    const textColor = parseCssColor(computed.color) || { r: 0, g: 0, b: 0, a: 1 };
    const fontSize = parseFloat(computed.fontSize) || 16;
    const fontWeight =
      parseInt(computed.fontWeight, 10) || (computed.fontWeight === 'bold' ? 700 : 400);

    const segment: TextSegment = {
      start: 0,
      end: cleanContent.length,
      fontFamily: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim() || 'Inter',
      fontWeight,
      fontSize,
      color: textColor,
    };

    return {
      id,
      name,
      type: 'TEXT',
      bounds,
      visible: true,
      opacity,
      clipsContent: false,
      zIndex,
      style: Object.keys(style).length > 0 ? style : undefined,
      textData: {
        characters: cleanContent,
        segments: [segment],
      },
    };
  }

  // Pure decorative rectangle/frame
  return {
    id,
    name,
    type: 'RECTANGLE',
    bounds,
    visible: true,
    opacity,
    clipsContent: false,
    zIndex,
    style: Object.keys(style).length > 0 ? style : undefined,
  };
}
