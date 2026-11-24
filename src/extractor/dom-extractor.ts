import type {
  FIRNode,
  FIRNodeType,
  RGBAColor,
  FIRBounds,
  FIRStyle,
  BorderSideStyle,
  TextSegment,
} from '../types/fir';

// Tags that should be ignored during extraction
const IGNORED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'HEAD',
  'LINK',
  'META',
  'TITLE',
  'AUDIO',
  'VIDEO',
  'SOURCE',
]);

/**
 * Parses CSS color strings into RGBAColor (with 0..1 channels).
 * Supports:
 * - hex: #rgb, #rgba, #rrggbb, #rrggbbaa
 * - rgb/rgba: rgb(r, g, b), rgba(r, g, b, a), modern space-separated rgb(r g b / a)
 * - keyword: 'transparent'
 */
export function parseCssColor(colorStr: string): RGBAColor | undefined {
  if (!colorStr) return undefined;
  const str = colorStr.trim().toLowerCase();

  if (str === 'transparent' || str === 'rgba(0, 0, 0, 0)') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Hex format
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return {
        r: Number(r.toFixed(4)),
        g: Number(g.toFixed(4)),
        b: Number(b.toFixed(4)),
        a: Number(a.toFixed(4)),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
      return {
        r: Number(r.toFixed(4)),
        g: Number(g.toFixed(4)),
        b: Number(b.toFixed(4)),
        a: Number(a.toFixed(4)),
      };
    }
    return undefined;
  }

  // rgb/rgba format: rgb(r, g, b) or rgba(r, g, b, a) or rgb(r g b / a)
  const rgbMatch = str.match(/rgba?\(\s*([\d.]+)\s*(?:,|\s+)\s*([\d.]+)\s*(?:,|\s+)\s*([\d.]+)(?:\s*(?:,|\/)\s*([\d.%]+))?\s*\)/);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseFloat(rgbMatch[1]))) / 255;
    const g = Math.min(255, Math.max(0, parseFloat(rgbMatch[2]))) / 255;
    const b = Math.min(255, Math.max(0, parseFloat(rgbMatch[3]))) / 255;

    let a = 1;
    if (rgbMatch[4] !== undefined) {
      const alphaStr = rgbMatch[4];
      if (alphaStr.endsWith('%')) {
        a = Math.min(100, Math.max(0, parseFloat(alphaStr))) / 100;
      } else {
        a = Math.min(1, Math.max(0, parseFloat(alphaStr)));
      }
    }

    return {
      r: Number(r.toFixed(4)),
      g: Number(g.toFixed(4)),
      b: Number(b.toFixed(4)),
      a: Number(a.toFixed(4)),
    };
  }

  return undefined;
}

let elementIdCounter = 0;

function generateNodeId(element: Element): string {
  if (element.id && element.id.trim() !== '') {
    return element.id;
  }
  elementIdCounter += 1;
  return `fir-node-${elementIdCounter}`;
}

function getNodeName(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  let classes = '';
  if (element.className && typeof element.className === 'string') {
    const list = element.className.trim().split(/\s+/).filter(Boolean);
    if (list.length > 0) {
      classes = `.${list.slice(0, 2).join('.')}`;
    }
  }
  return `${tag}${id}${classes}`;
}

function parseBorderRadius(computed: CSSStyleDeclaration) {
  const tl = parseFloat(computed.borderTopLeftRadius) || 0;
  const tr = parseFloat(computed.borderTopRightRadius) || 0;
  const br = parseFloat(computed.borderBottomRightRadius) || 0;
  const bl = parseFloat(computed.borderBottomLeftRadius) || 0;

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

function parseBorderSide(
  widthStr: string,
  colorStr: string,
  styleStr: string
): BorderSideStyle {
  const width = parseFloat(widthStr) || 0;
  const color = parseCssColor(colorStr) || { r: 0, g: 0, b: 0, a: 1 };
  let style: 'solid' | 'dashed' | 'dotted' | 'none' = 'none';

  if (styleStr === 'solid' || styleStr === 'dashed' || styleStr === 'dotted') {
    style = styleStr;
  }

  return { width, color, style };
}

function parseBorders(computed: CSSStyleDeclaration) {
  const top = parseBorderSide(computed.borderTopWidth, computed.borderTopColor, computed.borderTopStyle);
  const right = parseBorderSide(computed.borderRightWidth, computed.borderRightColor, computed.borderRightStyle);
  const bottom = parseBorderSide(computed.borderBottomWidth, computed.borderBottomColor, computed.borderBottomStyle);
  const left = parseBorderSide(computed.borderLeftWidth, computed.borderLeftColor, computed.borderLeftStyle);

  if (top.width === 0 && right.width === 0 && bottom.width === 0 && left.width === 0) {
    return undefined;
  }

  return { top, right, bottom, left };
}

function isElementVisible(computed: CSSStyleDeclaration, rect: DOMRect | { width: number; height: number }): boolean {
  if (computed.display === 'none') return false;
  if (computed.visibility === 'hidden' || computed.visibility === 'collapse') return false;
  if (parseFloat(computed.opacity) === 0) return false;
  return true;
}

/**
 * Main DOM element extractor. Traverses the DOM subtree starting from rootElement
 * and builds a valid FIRNode tree.
 */
export function extractFIRFromElement(rootElement: HTMLElement): FIRNode {
  elementIdCounter = 0;
  return traverseElement(rootElement);
}

function traverseElement(element: HTMLElement): FIRNode {
  const tagName = element.tagName.toUpperCase();
  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const bounds: FIRBounds = {
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
  };

  const id = generateNodeId(element);
  const name = getNodeName(element);
  const visible = isElementVisible(computed, rect);
  const opacity = parseFloat(computed.opacity) || 1;
  const clipsContent =
    computed.overflow === 'hidden' ||
    computed.overflowX === 'hidden' ||
    computed.overflowY === 'hidden';
  const zIndex = parseInt(computed.zIndex, 10) || 0;

  // Build style
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

  // 1. SVG element handler
  if (tagName === 'SVG') {
    return {
      id,
      name,
      type: 'VECTOR',
      bounds,
      visible,
      opacity,
      clipsContent,
      zIndex,
      style: Object.keys(style).length > 0 ? style : undefined,
      svgContent: element.outerHTML,
    };
  }

  // 2. IMG element handler
  if (tagName === 'IMG') {
    const imgElement = element as HTMLImageElement;
    return {
      id,
      name,
      type: 'IMAGE',
      bounds,
      visible,
      opacity,
      clipsContent,
      zIndex,
      style: Object.keys(style).length > 0 ? style : undefined,
      imageData: {
        base64: imgElement.src || '',
        scaleMode: computed.objectFit === 'contain' ? 'FIT' : computed.objectFit === 'none' ? 'CROP' : 'FILL',
      },
    };
  }

  // Filter child elements
  const childElements: HTMLElement[] = [];
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i] as HTMLElement;
    if (!IGNORED_TAGS.has(child.tagName.toUpperCase())) {
      const childComputed = window.getComputedStyle(child);
      if (childComputed.display !== 'none' && childComputed.visibility !== 'hidden') {
        childElements.push(child);
      }
    }
  }

  // Check if element is a pure text container
  const rawText = element.textContent || '';
  const trimmedText = rawText.trim();
  const hasOnlyText = childElements.length === 0 && trimmedText.length > 0;

  if (hasOnlyText) {
    const textColor = parseCssColor(computed.color) || { r: 0, g: 0, b: 0, a: 1 };
    const fontSize = parseFloat(computed.fontSize) || 16;
    const fontWeight = parseInt(computed.fontWeight, 10) || (computed.fontWeight === 'bold' ? 700 : 400);
    const lineHeightVal = parseFloat(computed.lineHeight);
    const letterSpacingVal = parseFloat(computed.letterSpacing);

    const segment: TextSegment = {
      start: 0,
      end: trimmedText.length,
      fontFamily: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim() || 'Inter',
      fontWeight,
      fontSize,
      color: textColor,
      lineHeightPx: !isNaN(lineHeightVal) ? lineHeightVal : undefined,
      letterSpacingPx: !isNaN(letterSpacingVal) ? letterSpacingVal : undefined,
      textDecoration:
        computed.textDecorationLine?.includes('underline')
          ? 'UNDERLINE'
          : computed.textDecorationLine?.includes('line-through')
          ? 'STRIKETHROUGH'
          : 'NONE',
    };

    return {
      id,
      name,
      type: 'TEXT',
      bounds,
      visible,
      opacity,
      clipsContent,
      zIndex,
      style: Object.keys(style).length > 0 ? style : undefined,
      textData: {
        characters: trimmedText,
        segments: [segment],
      },
    };
  }

  // Frame container node
  const children: FIRNode[] = [];
  for (const childEl of childElements) {
    children.push(traverseElement(childEl));
  }

  return {
    id,
    name,
    type: 'FRAME',
    bounds,
    visible,
    opacity,
    clipsContent,
    zIndex,
    style: Object.keys(style).length > 0 ? style : undefined,
    children: children.length > 0 ? children : undefined,
  };
}
