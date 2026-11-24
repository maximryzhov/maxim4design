import type { FIRNode, FIRBounds, RGBAColor } from '../types/fir.ts';
import { fontManager } from './font-manager.ts';

function toFigmaColor(color: RGBAColor): { color: RGB; opacity: number } {
  return {
    color: {
      r: Math.min(1, Math.max(0, color.r)),
      g: Math.min(1, Math.max(0, color.g)),
      b: Math.min(1, Math.max(0, color.b)),
    },
    opacity: typeof color.a === 'number' ? Math.min(1, Math.max(0, color.a)) : 1,
  };
}

/**
 * Renders a FIR TEXT node into a native Figma TextNode with full inline ranges support.
 */
export async function renderTextNode(
  node: FIRNode,
  parentFrame?: FrameNode,
  parentBounds?: FIRBounds
): Promise<TextNode> {
  const relX = parentBounds ? node.bounds.x - parentBounds.x : node.bounds.x;
  const relY = parentBounds ? node.bounds.y - parentBounds.y : node.bounds.y;
  const width = Math.max(1, node.bounds.width);
  const height = Math.max(1, node.bounds.height);

  const textNode = figma.createText();
  textNode.name = node.name || 'Text';

  const textData = node.textData;
  const characters = textData?.characters || '';
  const segments = textData?.segments || [];

  // Base font: from first segment or default Inter
  const firstSeg = segments[0];
  const isBaseItalic =
    firstSeg?.fontStyle === 'italic' ||
    (firstSeg?.fontFamily ? firstSeg.fontFamily.toLowerCase().includes('italic') : false);
  const baseFont = await fontManager.loadFontSafely(
    firstSeg?.fontFamily || 'Inter',
    firstSeg?.fontWeight ?? 400,
    isBaseItalic
  );

  textNode.fontName = baseFont;
  textNode.characters = characters;

  if (firstSeg) {
    if (firstSeg.fontSize) {
      textNode.fontSize = firstSeg.fontSize;
    }
    if (firstSeg.color) {
      const { color, opacity } = toFigmaColor(firstSeg.color);
      textNode.fills = [{ type: 'SOLID', color, opacity }];
    }
  }

  textNode.x = relX;
  textNode.y = relY;
  textNode.resize(width, height);
  textNode.opacity = node.opacity;
  textNode.visible = node.visible;

  if (characters.length === 0 || segments.length === 0) {
    return textNode;
  }

  // Preload and apply each range segment
  for (const seg of segments) {
    const start = Math.max(0, Math.min(characters.length, seg.start));
    const end = Math.max(start, Math.min(characters.length, seg.end));

    if (start >= end) continue;

    const isItalic =
      seg.fontStyle === 'italic' ||
      (seg.fontFamily ? seg.fontFamily.toLowerCase().includes('italic') : false);
    const segFont = await fontManager.loadFontSafely(
      seg.fontFamily || 'Inter',
      seg.fontWeight ?? 400,
      isItalic
    );

    try {
      textNode.setRangeFontName(start, end, segFont);
    } catch (err) {
      console.warn(`[TextRenderer] Failed to setRangeFontName for [${start}, ${end}]:`, err);
    }

    if (seg.fontSize) {
      try {
        textNode.setRangeFontSize(start, end, seg.fontSize);
      } catch (err) {
        console.warn(`[TextRenderer] Failed to setRangeFontSize for [${start}, ${end}]:`, err);
      }
    }

    if (seg.color) {
      try {
        const { color, opacity } = toFigmaColor(seg.color);
        textNode.setRangeFills(start, end, [{ type: 'SOLID', color, opacity }]);
      } catch (err) {
        console.warn(`[TextRenderer] Failed to setRangeFills for [${start}, ${end}]:`, err);
      }
    }

    if (seg.textDecoration && seg.textDecoration !== 'NONE') {
      try {
        textNode.setRangeTextDecoration(start, end, seg.textDecoration);
      } catch (err) {
        console.warn(`[TextRenderer] Failed to setRangeTextDecoration for [${start}, ${end}]:`, err);
      }
    }

    if (seg.lineHeightPx && seg.lineHeightPx > 0) {
      try {
        textNode.setRangeLineHeight(start, end, {
          value: seg.lineHeightPx,
          unit: 'PIXELS',
        });
      } catch (err) {
        console.warn(`[TextRenderer] Failed to setRangeLineHeight for [${start}, ${end}]:`, err);
      }
    }

    if (seg.letterSpacingPx) {
      try {
        textNode.setRangeLetterSpacing(start, end, {
          value: seg.letterSpacingPx,
          unit: 'PIXELS',
        });
      } catch (err) {
        console.warn(`[TextRenderer] Failed to setRangeLetterSpacing for [${start}, ${end}]:`, err);
      }
    }
  }

  return textNode;
}
