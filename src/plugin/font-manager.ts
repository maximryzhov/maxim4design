import type { FIRFontAsset } from '../types/fir.ts';

export const DEFAULT_FALLBACK_FONT: FontName = { family: 'Inter', style: 'Regular' };

/**
 * Custom/brand families map to the closest family available in Figma.
 * Values are tried in order before falling back to Inter.
 */
export const FONT_ALIASES: Record<string, string[]> = {
  contactbebas: ['Oswald'],
  contactbebasexpanded: ['Oswald'],
  processmontserrat: ['Montserrat'],
};

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

const STYLE_WEIGHT_HINTS: Array<[string, number]> = [
  ['thin', 100],
  ['hairline', 100],
  ['extralight', 200],
  ['ultralight', 200],
  ['light', 300],
  ['regular', 400],
  ['normal', 400],
  ['book', 400],
  ['medium', 500],
  ['semibold', 600],
  ['demibold', 600],
  ['extrabold', 800],
  ['ultrabold', 800],
  ['bold', 700],
  ['black', 900],
  ['heavy', 900],
];

function inferStyleWeight(styleName: string): number {
  const norm = styleName.toLowerCase().replace(/\s+/g, '');
  for (const [token, w] of STYLE_WEIGHT_HINTS) {
    if (norm.includes(token)) return w;
  }
  return 400;
}

export class FontManager {
  private loadedFonts = new Set<string>();
  private warnings: string[] = [];
  private availableFontsMap = new Map<string, { canonicalFamily: string; styles: Set<string> }>();
  private availableFontsInitialized = false;

  private getFontKey(font: FontName): string {
    return `${font.family}::${font.style}`;
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  clearWarnings(): void {
    this.warnings = [];
  }

  /**
   * Queries Figma's available fonts via listAvailableFontsAsync() once to enable
   * smart style matching within the same family before falling back to Inter.
   */
  async initAvailableFonts(): Promise<void> {
    if (this.availableFontsInitialized) return;
    this.availableFontsInitialized = true;

    try {
      const figmaGlobal = (globalThis as any).figma;
      if (!figmaGlobal || typeof figmaGlobal.listAvailableFontsAsync !== 'function') {
        return;
      }
      const list: Array<{ fontName: FontName }> = await figmaGlobal.listAvailableFontsAsync();
      for (const item of list) {
        if (!item?.fontName?.family || !item.fontName.style) continue;
        const key = item.fontName.family.toLowerCase();
        let entry = this.availableFontsMap.get(key);
        if (!entry) {
          entry = { canonicalFamily: item.fontName.family, styles: new Set<string>() };
          this.availableFontsMap.set(key, entry);
        }
        entry.styles.add(item.fontName.style);
      }
    } catch (err) {
      console.warn('[FontManager] listAvailableFontsAsync failed:', err);
    }
  }

  /**
   * Returns true when the family (case/quote-insensitive) exists in the editor's font index.
   * Must be called after initAvailableFonts().
   */
  isFamilyAvailable(family: string): boolean {
    return this.availableFontsMap.has(cleanFontFamily(family).toLowerCase());
  }

  private findBestStyleInFamily(
    familyLower: string,
    targetStyle: string,
    targetWeight: number,
    isItalic: boolean
  ): FontName | undefined {
    const entry = this.availableFontsMap.get(familyLower);
    if (!entry || entry.styles.size === 0) return undefined;

    if (entry.styles.has(targetStyle)) {
      return { family: entry.canonicalFamily, style: targetStyle };
    }

    // Check space/case-insensitive match (e.g. "SemiBold" vs "Semi Bold")
    const targetNorm = targetStyle.toLowerCase().replace(/\s+/g, '');
    for (const s of entry.styles) {
      if (s.toLowerCase().replace(/\s+/g, '') === targetNorm) {
        return { family: entry.canonicalFamily, style: s };
      }
    }

    // Pick closest style by italic match + weight distance
    let bestStyle: string | undefined;
    let bestScore = Infinity;
    for (const s of entry.styles) {
      const sItalic = s.toLowerCase().includes('italic');
      const italicPenalty = sItalic === isItalic ? 0 : 1000;
      const weightDiff = Math.abs(inferStyleWeight(s) - targetWeight);
      const score = italicPenalty + weightDiff;
      if (score < bestScore) {
        bestScore = score;
        bestStyle = s;
      }
    }

    return bestStyle ? { family: entry.canonicalFamily, style: bestStyle } : undefined;
  }

  /**
   * Safe font loader with a smart family-aware fallback strategy:
   * 1. Try exact or closest style in requested family (via listAvailableFontsAsync index)
   * 2. Try requested font { family, style } directly
   * 3. Try Inter with the same style { family: 'Inter', style }
   * 4. Fallback to default { family: 'Inter', style: 'Regular' }
   */
  async loadFontSafely(family: string, weight = 400, isItalic = false): Promise<FontName> {
    const cleanedFamily = cleanFontFamily(family);
    const style = mapWeightToFigmaStyle(weight, isItalic);
    const requestedFont: FontName = { family: cleanedFamily, style };

    // 1. Try requested font cache
    if (this.isLoaded(requestedFont)) {
      return requestedFont;
    }

    // 1b. If availableFontsMap is populated, resolve canonical family & closest style
    const matchedFromIndex = this.findBestStyleInFamily(
      cleanedFamily.toLowerCase(),
      style,
      weight,
      isItalic
    );
    if (matchedFromIndex) {
      if (this.isLoaded(matchedFromIndex)) {
        return matchedFromIndex;
      }
      try {
        await figma.loadFontAsync(matchedFromIndex);
        this.markLoaded(matchedFromIndex);
        return matchedFromIndex;
      } catch {
        // Fall through to standard flow
      }
    }

    // 2. Try requested font directly
    try {
      await figma.loadFontAsync(requestedFont);
      this.markLoaded(requestedFont);
      return requestedFont;
    } catch {
      console.warn(
        `[FontManager] Font ${requestedFont.family} (${requestedFont.style}) not found in Figma. Trying Inter with same weight...`
      );
    }

    // 1c. Custom brand families: try a closest available alias (Oswald, Montserrat, ...)
    const aliases = FONT_ALIASES[cleanedFamily.toLowerCase()];
    if (aliases) {
      for (const aliasFamily of aliases) {
        const aliasFont = this.findBestStyleInFamily(
          aliasFamily.toLowerCase(),
          style,
          weight,
          isItalic
        );
        if (!aliasFont) continue;
        try {
          await figma.loadFontAsync(aliasFont);
          this.markLoaded(aliasFont);
          this.recordWarning(
            `Шрифт "${requestedFont.family} (${requestedFont.style})" заменен на "${aliasFont.family} (${aliasFont.style})" (alias)`
          );
          return aliasFont;
        } catch {
          // Try next alias
        }
      }
    }

    // 2. Try Inter with same style
    const interSameStyle: FontName = { family: 'Inter', style };
    if (this.isLoaded(interSameStyle)) {
      this.recordWarning(`Шрифт "${requestedFont.family} (${requestedFont.style})" заменен на "Inter (${interSameStyle.style})"`);
      return interSameStyle;
    }

    try {
      await figma.loadFontAsync(interSameStyle);
      this.markLoaded(interSameStyle);
      this.recordWarning(`Шрифт "${requestedFont.family} (${requestedFont.style})" заменен на "Inter (${interSameStyle.style})"`);
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

    this.recordWarning(`Шрифт "${requestedFont.family} (${requestedFont.style})" заменен на "Inter (Regular)"`);
    return DEFAULT_FALLBACK_FONT;
  }

  private recordWarning(msg: string): void {
    if (!this.warnings.includes(msg)) {
      this.warnings.push(msg);
    }
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
    this.warnings = [];
    this.availableFontsMap.clear();
    this.availableFontsInitialized = false;
  }
}

export const fontManager = new FontManager();

/**
 * Picks downloadable @font-face assets whose family is not available in the editor.
 * Used by the plugin UI to offer a "Download missing fonts" flow (like html.to.design).
 */
export function selectMissingFontAssets(
  fonts: FIRFontAsset[] | undefined,
  isFamilyAvailable: (family: string) => boolean
): FIRFontAsset[] {
  const seen = new Set<string>();
  const missing: FIRFontAsset[] = [];

  for (const font of fonts || []) {
    if (!font || !font.family || !font.sourceUrl) continue;
    if (isFamilyAvailable(font.family)) continue;

    const key = `${font.family.toLowerCase()}::${font.weight || '400'}::${font.style || 'normal'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    missing.push(font);
  }

  return missing;
}
