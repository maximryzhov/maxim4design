import type { FIRStyle, FIRGradient, RGBAColor } from '../types/fir.ts';
import { applyEffects } from './effects-applier.ts';

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
 * Figma's gradientTransform maps the unit gradient square to the node. Identity is
 * the vertical top→bottom gradient, which is what the majority of CSS page gradients
 * use. The other cardinal directions are expressed as rotations/flips.
 */
function gradientTransform(angle: number): Transform {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 0) return [[1, 0, 0], [0, -1, 1]];
  if (normalized === 90) return [[0, 1, 0], [-1, 0, 1]];
  if (normalized === 270) return [[0, -1, 1], [1, 0, 0]];
  // 180deg and arbitrary angles keep the vertical direction; most page overlays
  // are vertical, and a vertical fallback is still readable for the rest.
  return [[1, 0, 0], [0, 1, 0]];
}

function toFigmaGradient(gradient: FIRGradient): GradientPaint | undefined {
  if (!gradient.stops || gradient.stops.length < 2) return undefined;
  return {
    type: gradient.type === 'RADIAL' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR',
    gradientTransform: gradientTransform(gradient.angle),
    gradientStops: gradient.stops.map((stop) => ({
      position: Math.max(0, Math.min(1, stop.position)),
      color: {
        r: Math.min(1, Math.max(0, stop.color.r)),
        g: Math.min(1, Math.max(0, stop.color.g)),
        b: Math.min(1, Math.max(0, stop.color.b)),
        a: typeof stop.color.a === 'number' ? Math.min(1, Math.max(0, stop.color.a)) : 1,
      },
    })),
  };
}

/**
 * Applies styles (fills, corner radius, individual borders, clipsContent) to a Figma node.
 */
export function applyStyles(
  node: FrameNode | RectangleNode,
  style?: FIRStyle,
  clipsContent?: boolean
): void {
  // 1. Clips content
  if (clipsContent !== undefined && 'clipsContent' in node) {
    (node as FrameNode).clipsContent = clipsContent;
  }

  if (!style) {
    node.fills = [];
    return;
  }

  // 2. Background color and gradient fills (solid under gradient, like CSS)
  const fills: Paint[] = [];
  if (style.backgroundColor && style.backgroundColor.a > 0) {
    const { color, opacity } = toFigmaColor(style.backgroundColor);
    fills.push({ type: 'SOLID', color, opacity });
  }
  const gradient = style.backgroundGradient ? toFigmaGradient(style.backgroundGradient) : undefined;
  if (gradient) fills.push(gradient);
  node.fills = fills;

  // 3. Corner radius (all or independent)
  if (style.borderRadius) {
    const { topLeft, topRight, bottomRight, bottomLeft } = style.borderRadius;
    const isUniform =
      topLeft === topRight &&
      topRight === bottomRight &&
      bottomRight === bottomLeft;

    if (isUniform) {
      try {
        node.cornerRadius = topLeft;
      } catch {
        // ignore
      }
      node.topLeftRadius = topLeft;
      node.topRightRadius = topRight;
      node.bottomRightRadius = bottomRight;
      node.bottomLeftRadius = bottomLeft;
    } else {
      node.topLeftRadius = topLeft;
      node.topRightRadius = topRight;
      node.bottomRightRadius = bottomRight;
      node.bottomLeftRadius = bottomLeft;
    }
  }

  // 4. Borders / Strokes with independent weights
  if (style.borders) {
    const { top, right, bottom, left } = style.borders;
    const hasAnyBorder =
      top.width > 0 || right.width > 0 || bottom.width > 0 || left.width > 0;

    if (hasAnyBorder) {
      // Pick color from the first side with width > 0
      const activeBorder =
        top.width > 0
          ? top
          : bottom.width > 0
          ? bottom
          : left.width > 0
          ? left
          : right;

      const { color, opacity } = toFigmaColor(activeBorder.color);
      node.strokes = [{ type: 'SOLID', color, opacity }];

      // Apply individual stroke weights (Figma API)
      const target = node as unknown as {
        strokeTopWeight?: number;
        strokeRightWeight?: number;
        strokeBottomWeight?: number;
        strokeLeftWeight?: number;
        strokeWeight?: number;
        dashPattern?: readonly number[];
      };

      try {
        target.strokeTopWeight = top.width;
        target.strokeRightWeight = right.width;
        target.strokeBottomWeight = bottom.width;
        target.strokeLeftWeight = left.width;
      } catch {
        // Fallback for uniform stroke weight
        target.strokeWeight = Math.max(top.width, right.width, bottom.width, left.width);
      }

      if (activeBorder.style === 'dashed') {
        try {
          target.dashPattern = [4, 4];
        } catch {
          // ignore
        }
      } else if (activeBorder.style === 'dotted') {
        try {
          target.dashPattern = [1, 2];
        } catch {
          // ignore
        }
      }
    } else {
      node.strokes = [];
    }
  }

  // 5. Effects (Shadows & Blurs)
  applyEffects(node, style);
}
