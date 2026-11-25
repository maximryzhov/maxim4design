import type {
  FIRStyle,
  FIRBorderRadius,
  FIRBorders,
  FIRGradient,
  FIRGradientStop,
  BorderSideStyle,
  RGBAColor,
} from '../types/fir.ts';
import { parseCssColor } from './dom-extractor.ts';
import { parseBoxShadow, parseBlur } from './effects-parser.ts';

export function parseBorderSide(
  widthStr: string,
  colorStr: string,
  styleStr: string
): BorderSideStyle {
  const width = Math.max(0, parseFloat(widthStr) || 0);
  const color = parseCssColor(colorStr) || { r: 0, g: 0, b: 0, a: 1 };
  let style: 'solid' | 'dashed' | 'dotted' | 'none' = 'none';

  if (styleStr === 'solid' || styleStr === 'dashed' || styleStr === 'dotted') {
    style = styleStr;
  }

  return { width, color, style };
}

export function parseBorders(computed: CSSStyleDeclaration): FIRBorders | undefined {
  const top = parseBorderSide(
    computed.borderTopWidth,
    computed.borderTopColor,
    computed.borderTopStyle
  );
  const right = parseBorderSide(
    computed.borderRightWidth,
    computed.borderRightColor,
    computed.borderRightStyle
  );
  const bottom = parseBorderSide(
    computed.borderBottomWidth,
    computed.borderBottomColor,
    computed.borderBottomStyle
  );
  const left = parseBorderSide(
    computed.borderLeftWidth,
    computed.borderLeftColor,
    computed.borderLeftStyle
  );

  if (top.width === 0 && right.width === 0 && bottom.width === 0 && left.width === 0) {
    return undefined;
  }

  return { top, right, bottom, left };
}

export function parseBorderRadius(computed: CSSStyleDeclaration): FIRBorderRadius | undefined {
  const tl = Math.max(0, parseFloat(computed.borderTopLeftRadius) || 0);
  const tr = Math.max(0, parseFloat(computed.borderTopRightRadius) || 0);
  const br = Math.max(0, parseFloat(computed.borderBottomRightRadius) || 0);
  const bl = Math.max(0, parseFloat(computed.borderBottomLeftRadius) || 0);

  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return undefined;
  }

  return {
    topLeft: tl,
    topRight: tr,
    bottomRight: br,
    bottomLeft: bl,
  };
}

function splitGradientParts(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
}

function findGradient(backgroundImage: string): { type: 'LINEAR' | 'RADIAL'; body: string } | undefined {
  if (!backgroundImage || backgroundImage === 'none') return undefined;
  const match = backgroundImage.match(/(linear|radial)-gradient\(/i);
  if (!match || match.index === undefined) return undefined;
  const type = match[1].toLowerCase() === 'radial' ? 'RADIAL' : 'LINEAR';
  const openIndex = match.index + match[0].length - 1;
  let depth = 0;
  for (let i = openIndex; i < backgroundImage.length; i++) {
    if (backgroundImage[i] === '(') depth++;
    else if (backgroundImage[i] === ')') {
      depth--;
      if (depth === 0) {
        return { type, body: backgroundImage.slice(openIndex + 1, i) };
      }
    }
  }
  return undefined;
}

function parseCssAngle(value: string): number | undefined {
  const token = value.trim().toLowerCase();
  const directionMap: Record<string, number> = {
    'to top': 0,
    'to top right': 45,
    'to right top': 45,
    'to right': 90,
    'to bottom right': 135,
    'to right bottom': 135,
    'to bottom': 180,
    'to bottom left': 225,
    'to left bottom': 225,
    'to left': 270,
    'to top left': 315,
    'to left top': 315,
  };
  if (token in directionMap) return directionMap[token];
  const number = parseFloat(token);
  if (!Number.isFinite(number)) return undefined;
  if (token.endsWith('turn')) return number * 360;
  if (token.endsWith('rad')) return (number * 180) / Math.PI;
  if (token.endsWith('grad')) return number * 0.9;
  return number;
}

/**
 * Parses the first CSS linear/radial gradient from `background-image` into FIR.
 * CSS angles: 0 = to top, 90 = to right, 180 = to bottom.
 */
export function parseCssGradient(backgroundImage: string): FIRGradient | undefined {
  const found = findGradient(backgroundImage);
  if (!found) return undefined;

  const parts = splitGradientParts(found.body);
  if (parts.length < 2) return undefined;

  let angle = 180;
  if (found.type === 'LINEAR') {
    const firstTrimmed = parts[0].trim();
    const parsedAngle = parseCssAngle(firstTrimmed);
    // Only a direction/angle token may occupy the first slot; a color token means
    // the CSS default angle (180deg / to bottom).
    if (parsedAngle !== undefined && (/\d|^to\s/i.test(firstTrimmed))) {
      angle = ((parsedAngle % 360) + 360) % 360;
      parts.shift();
    }
  } else {
    parts.shift(); // radial shape/size/position token is not translated yet
  }

  const stops: Array<FIRGradientStop & { explicit: boolean }> = [];
  for (const rawPart of parts) {
    let part = rawPart.trim();
    if (!part) continue;
    let position: number | undefined;
    const positionMatch = part.match(/(?:^|\s)(-?\d+(?:\.\d+)?)%\s*$/);
    if (positionMatch) {
      position = Math.max(0, Math.min(1, parseFloat(positionMatch[1]) / 100));
      part = part.slice(0, positionMatch.index).trim();
    }
    const color = parseCssColor(part);
    if (!color) continue;
    stops.push({ position: position ?? 0, color, explicit: position !== undefined });
  }

  if (stops.length < 2) return undefined;

  // CSS positions are optional. Pin the ends and distribute runs evenly.
  if (!stops[0].explicit) stops[0].position = 0;
  if (!stops[stops.length - 1].explicit) stops[stops.length - 1].position = 1;
  let lastExplicit = 0;
  for (let i = 1; i < stops.length; i++) {
    if (!stops[i].explicit) continue;
    const from = stops[lastExplicit].position;
    const to = stops[i].position;
    const gap = i - lastExplicit;
    for (let j = 1; j < gap; j++) {
      stops[lastExplicit + j].position = from + ((to - from) * j) / gap;
    }
    lastExplicit = i;
  }

  return {
    type: found.type,
    angle,
    stops: stops.map(({ position, color }) => ({
      position: Math.max(0, Math.min(1, position)),
      color,
    })),
  };
}

export function extractElementStyles(computed: CSSStyleDeclaration): FIRStyle {
  const style: FIRStyle = {};

  const bgColor = parseCssColor(computed.backgroundColor);
  if (bgColor && bgColor.a > 0) {
    style.backgroundColor = bgColor;
  }

  const gradient = parseCssGradient(computed.backgroundImage || '');
  if (gradient) {
    style.backgroundGradient = gradient;
  }

  const borderRadius = parseBorderRadius(computed);
  if (borderRadius) {
    style.borderRadius = borderRadius;
  }

  const borders = parseBorders(computed);
  if (borders) {
    style.borders = borders;
  }

  const shadows = parseBoxShadow(computed.boxShadow);
  if (shadows.length > 0) {
    style.shadows = shadows;
  }

  const { blur, backgroundBlur } = parseBlur(computed);
  if (blur) {
    style.blur = blur;
  }
  if (backgroundBlur) {
    style.backgroundBlur = backgroundBlur;
  }

  const opacity = parseFloat(computed.opacity);
  if (!isNaN(opacity) && opacity < 1) {
    style.opacity = opacity;
  }

  return style;
}
