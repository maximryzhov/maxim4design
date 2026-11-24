import type {
  FIRStyle,
  FIRBorderRadius,
  FIRBorders,
  BorderSideStyle,
  RGBAColor,
} from '../types/fir.ts';
import { parseCssColor } from './dom-extractor.ts';

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

export function extractElementStyles(computed: CSSStyleDeclaration): FIRStyle {
  const style: FIRStyle = {};

  const bgColor = parseCssColor(computed.backgroundColor);
  if (bgColor && bgColor.a > 0) {
    style.backgroundColor = bgColor;
  }

  const borderRadius = parseBorderRadius(computed);
  if (borderRadius) {
    style.borderRadius = borderRadius;
  }

  const borders = parseBorders(computed);
  if (borders) {
    style.borders = borders;
  }

  const opacity = parseFloat(computed.opacity);
  if (!isNaN(opacity) && opacity < 1) {
    style.opacity = opacity;
  }

  return style;
}
