export const DEFAULT_FALLBACK_FONT: FontName = { family: 'Inter', style: 'Regular' };

/**
 * Maps numeric CSS font-weight (100..900) and italic flag to Figma style names.
 */
export function mapWeightToFigmaStyle(weight: number, isItalic = false): string {
  let baseStyle: string;

  if (weight <= 200) {
    baseStyle = 'Extra Light';
  } else if (weight <= 300) {
    baseStyle = 'Light';
  } else if (weight <= 400) {
    baseStyle = 'Regular';
  } else if (weight <= 500) {
    baseStyle = 'Medium';
  } else if (weight <= 600) {
    baseStyle = 'Semi Bold';
  } else if (weight <= 700) {
    baseStyle = 'Bold';
  } else if (weight <= 800) {
    baseStyle = 'Extra Bold';
  } else {
    baseStyle = 'Black';
  }

  if (isItalic) {
    return baseStyle === 'Regular' ? 'Italic' : `${baseStyle} Italic`;
  }

  return baseStyle;
}

/**
 * Normalizes CSS font-family (strips quotes, fallbacks like sans-serif, serif).
 */
export function cleanFontFamily(rawFamily: string): string {
  if (!rawFamily) return 'Inter';
  const first = rawFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  if (!first || first.toLowerCase() === 'sans-serif' || first.toLowerCase() === 'serif' || first.toLowerCase() === 'monospace') {
    return 'Inter';
  }
  return first;
}

export class FontManager {
  private loadedFonts = new Set<string>();

  private getFontKey(font: FontName): string {
    return `${font.family}::${font.style}`;
  }

  /**
   * Safe font loader with a 3-step fallback strategy:
   * 1. Try requested font { family, style }
   * 2. Try Inter with the same style { family: 'Inter', style } (preserves visual weight/slant)
   * 3. Fallback to default { family: 'Inter', style: 'Regular' }
   */
  async loadFontSafely(family: string, weight = 400, isItalic = false): Promise<FontName> {
    const cleanedFamily = cleanFontFamily(family);
    const style = mapWeightToFigmaStyle(weight, isItalic);
    const requestedFont: FontName = { family: cleanedFamily, style };

    // 1. Try requested font
    if (this.isLoaded(requestedFont)) {
      return requestedFont;
    }

    try {
      await figma.loadFontAsync(requestedFont);
      this.markLoaded(requestedFont);
      return requestedFont;
    } catch {
      console.warn(
        `[FontManager] Font ${requestedFont.family} (${requestedFont.style}) not found in Figma. Trying Inter with same weight...`
      );
    }

    // 2. Try Inter with same style
    const interSameStyle: FontName = { family: 'Inter', style };
    if (this.isLoaded(interSameStyle)) {
      return interSameStyle;
    }

    try {
      await figma.loadFontAsync(interSameStyle);
      this.markLoaded(interSameStyle);
      return interSameStyle;
    } catch {
      console.warn(
        `[FontManager] Inter (${interSameStyle.style}) failed to load. Falling back to Inter Regular.`
      );
    }

    // 3. Fallback to Inter Regular
    if (!this.isLoaded(DEFAULT_FALLBACK_FONT)) {
      try {
        await figma.loadFontAsync(DEFAULT_FALLBACK_FONT);
        this.markLoaded(DEFAULT_FALLBACK_FONT);
      } catch (err) {
        console.error('[FontManager] Fatal: Inter Regular failed to load:', err);
      }
    }

    return DEFAULT_FALLBACK_FONT;
  }

  /**
   * Preloads an array of fonts in batch.
   */
  async preloadFonts(fonts: Array<{ family: string; weight?: number; isItalic?: boolean }>): Promise<void> {
    await Promise.all(
      fonts.map((f) => this.loadFontSafely(f.family, f.weight ?? 400, f.isItalic ?? false))
    );
  }

  isLoaded(font: FontName): boolean {
    return this.loadedFonts.has(this.getFontKey(font));
  }

  private markLoaded(font: FontName): void {
    this.loadedFonts.add(this.getFontKey(font));
  }

  clearCache(): void {
    this.loadedFonts.clear();
  }
}

export const fontManager = new FontManager();
