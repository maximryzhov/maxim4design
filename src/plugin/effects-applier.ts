import type { FIRStyle, RGBAColor } from '../types/fir.ts';

function toEffectColor(color: RGBAColor): RGBA {
  return {
    r: Math.min(1, Math.max(0, color.r)),
    g: Math.min(1, Math.max(0, color.g)),
    b: Math.min(1, Math.max(0, color.b)),
    a: typeof color.a === 'number' ? Math.min(1, Math.max(0, color.a)) : 1,
  };
}

/**
 * Applies native Figma effects (DropShadow, InnerShadow, LayerBlur, BackgroundBlur)
 * to a FrameNode or RectangleNode based on FIRStyle.
 */
export function applyEffects(
  node: FrameNode | RectangleNode,
  style?: FIRStyle
): void {
  if (!style) return;

  const effects: Effect[] = [];

  // 1. Shadows (Drop Shadow and Inner Shadow)
  if (style.shadows && style.shadows.length > 0) {
    for (const shadow of style.shadows) {
      effects.push({
        type: shadow.type,
        color: toEffectColor(shadow.color),
        offset: { x: shadow.offset.x, y: shadow.offset.y },
        radius: Math.max(0, shadow.radius),
        spread: shadow.spread || 0,
        visible: shadow.visible !== false,
        blendMode: 'NORMAL',
      });
    }
  }

  // 2. Layer Blur (CSS filter: blur)
  if (style.blur && style.blur > 0) {
    effects.push({
      type: 'LAYER_BLUR',
      radius: style.blur,
      visible: true,
      blurType: 'NORMAL',
    });
  }

  // 3. Background Blur / Glassmorphism (CSS backdrop-filter: blur)
  if (style.backgroundBlur && style.backgroundBlur > 0) {
    effects.push({
      type: 'BACKGROUND_BLUR',
      radius: style.backgroundBlur,
      visible: true,
      blurType: 'NORMAL',
    });
  }

  if (effects.length > 0) {
    node.effects = effects;
  }
}
