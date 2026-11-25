import type { FIRNode, FIRBounds, RGBAColor, TextSegment } from '../types/fir.ts';
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

const wordWidthCache = new Map<string, number>();

async function measureTextWidth(font: FontName, fontSize: number, text: string): Promise<number> {
  const key = `${font.family}::${font.style}::${fontSize}::${text}`;
  const cached = wordWidthCache.get(key);
  if (cached !== undefined) return cached;

  let probe: TextNode | null = null;
  try {
    await figma.loadFontAsync(font);
    probe = figma.createText();
    probe.fontName = font;
    probe.fontSize = fontSize;
    probe.characters = text;
    probe.textAutoResize = 'WIDTH_AND_HEIGHT';
    const measured = probe.width;
    wordWidthCache.set(key, measured);
    return measured;
  } catch {
    return 0;
  } finally {
    try {
      probe?.remove();
    } catch {
      // Probe may already be gone / mocked
    }
  }
}

function applyFontScale(textNode: TextNode, segments: TextSegment[], scale: number): void {
  if (scale >= 0.999 || scale <= 0) return;
  const length = textNode.characters.length;

  for (const seg of segments) {
    const start = Math.max(0, Math.min(length, seg.start));
    const end = Math.max(start, Math.min(length, seg.end));
    if (start >= end) continue;

    try {
      textNode.setRangeFontSize(start, end, Math.max(8, seg.fontSize * scale));
    } catch {
      // Ignore mock/range errors
    }

    if (seg.lineHeightPx && seg.lineHeightPx > 0) {
      try {
        textNode.setRangeLineHeight(start, end, {
          value: Math.max(8, seg.lineHeightPx * scale),
          unit: 'PIXELS',
        });
      } catch {
        // Ignore
      }
    }

    if (seg.letterSpacingPx) {
      try {
        textNode.setRangeLetterSpacing(start, end, {
          value: seg.letterSpacingPx * scale,
          unit: 'PIXELS',
        });
      } catch {
        // Ignore
      }
    }
  }
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
    if (firstSeg.lineHeightPx && firstSeg.lineHeightPx > 0) {
      try {
        textNode.lineHeight = { value: firstSeg.lineHeightPx, unit: 'PIXELS' };
      } catch {
        // Ignore in mocks
      }
    }
    if (firstSeg.color) {
      const { color, opacity } = toFigmaColor(firstSeg.color);
      textNode.fills = [{ type: 'SOLID', color, opacity }];
    }
  }

  const textAlign = textData?.textAlign;
  if (textAlign) {
    try {
      textNode.textAlignHorizontal = textAlign;
    } catch {
      // Ignore in mocks / unsupported values
    }
  }

  // Small single-glyph badges (e.g. FAQ "+" in a 52x52/37x37 circle) are extracted
  // with text bounds equal to the parent frame. Center the glyph both axes.
  const isBadgeGlyph =
    Boolean(parentFrame) &&
    characters.trim().length > 0 &&
    characters.trim().length <= 2 &&
    Math.abs(width - (parentFrame as FrameNode).width) <= 1 &&
    Math.abs(height - (parentFrame as FrameNode).height) <= 1;

  if (isBadgeGlyph) {
    try {
      textNode.textAlignHorizontal = 'CENTER';
    } catch {
      // Ignore
    }
    try {
      textNode.textAlignVertical = 'CENTER';
    } catch {
      // Ignore
    }
    textNode.textAutoResize = 'NONE';
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

  // Fit oversized lines before auto-resize: fallback/alias fonts are wider than the
  // source font and used to split words or overflow their fixed boxes.
  const firstFontSize = firstSeg?.fontSize ?? 0;
  if (firstFontSize >= 24 && characters.trim() && segments.length > 0) {
    const longestLine = characters
      .split('\n')
      .map((line) => line.trim())
      .reduce((longest, line) => (line.length > longest.length ? line : longest), '');
    if (longestLine.length > 1) {
      const measured = await measureTextWidth(baseFont, firstFontSize, longestLine);
      const available = Math.max(1, width);
      if (measured > 0 && measured > available * 1.02) {
        applyFontScale(textNode, segments, Math.max(0.55, available / measured));
      }
    }
  }

  // Apply textAutoResize after all range fonts/sizes are set to avoid mid-word wrapping on fallback fonts
  if (isBadgeGlyph) {
    // Keep the badge box fixed; alignment handles both axes.
    textNode.textAutoResize = 'NONE';
  } else if (textData?.whiteSpace === 'nowrap' || textData?.isSingleLine) {
    // Right/center aligned single-line text needs the original box width, otherwise
    // WIDTH_AND_HEIGHT collapses it to the text and alignment becomes meaningless.
    const preserveBox =
      textAlign === 'CENTER' || textAlign === 'RIGHT' || textAlign === 'JUSTIFIED';
    textNode.textAutoResize = preserveBox ? 'NONE' : 'WIDTH_AND_HEIGHT';
  } else {
    textNode.textAutoResize = 'HEIGHT';

    // Second pass: if the reflowed text is taller than the source box, shrink it to fit.
    if (textNode.height > height * 1.12) {
      applyFontScale(textNode, segments, Math.max(0.7, (height * 1.12) / textNode.height));
      textNode.textAutoResize = 'HEIGHT';
    }
  }

  return textNode;
}
