import type {
  FIRNode,
  FIRNodeType,
  RGBAColor,
  FIRBounds,
  FIRStyle,
  FIRLayout,
  BorderSideStyle,
  TextSegment,
} from '../types/fir.ts';
import { isTextContainer, extractTextData } from './text-builder.ts';
import { extractElementStyles } from './style-extractor.ts';
import { serializeSvgElement } from './svg-serializer.ts';
import { extractImageData, resolveTreeImagesAsync, type ExternalImageFetcher } from './image-loader.ts';
import { extractPageFonts } from './font-extractor.ts';
import { extractPseudoElement } from './pseudo-extractor.ts';
import { analyzeElementLayout } from './layout-analyzer.ts';

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
  'OPTION',
  'OPTGROUP',
  'DATALIST',
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

export function parseLayout(computed: CSSStyleDeclaration): FIRLayout | undefined {
  const isFlex = computed.display === 'flex' || computed.display === 'inline-flex';
  if (!isFlex) {
    return undefined;
  }

  const mode = computed.flexDirection?.startsWith('column') ? 'VERTICAL' : 'HORIZONTAL';
  const wrap = computed.flexWrap === 'wrap' || computed.flexWrap === 'wrap-reverse';
  const itemSpacing =
    parseFloat(computed.gap) ||
    parseFloat(mode === 'VERTICAL' ? computed.rowGap : computed.columnGap) ||
    0;

  const padding = {
    top: parseFloat(computed.paddingTop) || 0,
    right: parseFloat(computed.paddingRight) || 0,
    bottom: parseFloat(computed.paddingBottom) || 0,
    left: parseFloat(computed.paddingLeft) || 0,
  };

  let primaryAlign: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' = 'MIN';
  const jc = computed.justifyContent;
  if (jc === 'center') {
    primaryAlign = 'CENTER';
  } else if (jc === 'flex-end' || jc === 'end') {
    primaryAlign = 'MAX';
  } else if (jc === 'space-between') {
    primaryAlign = 'SPACE_BETWEEN';
  }

  let counterAlign: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE' = 'MIN';
  const ai = computed.alignItems;
  if (ai === 'center') {
    counterAlign = 'CENTER';
  } else if (ai === 'flex-end' || ai === 'end') {
    counterAlign = 'MAX';
  } else if (ai === 'baseline') {
    counterAlign = 'BASELINE';
  }

  let sizingHorizontal: 'FIXED' | 'HUG' | 'FILL' = 'FIXED';
  const flexGrow = parseFloat(computed.flexGrow) || 0;
  if (flexGrow > 0 || computed.width === '100%') {
    sizingHorizontal = 'FILL';
  } else if (computed.width === 'auto' || computed.display === 'inline-flex') {
    sizingHorizontal = 'HUG';
  }

  let sizingVertical: 'FIXED' | 'HUG' | 'FILL' = 'FIXED';
  if (computed.height === '100%') {
    sizingVertical = 'FILL';
  } else if (computed.height === 'auto') {
    sizingVertical = 'HUG';
  }

  return {
    mode,
    wrap,
    itemSpacing,
    padding,
    primaryAlign,
    counterAlign,
    sizingHorizontal,
    sizingVertical,
  };
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
  const rootNode = traverseElement(rootElement);
  if (typeof document !== 'undefined' && (rootElement === document.body || rootElement === document.documentElement)) {
    const fonts = extractPageFonts();
    if (fonts.length > 0) {
      rootNode.fonts = fonts;
    }
  }
  return rootNode;
}

/**
 * Scrolls the page in viewport increments to trigger IntersectionObserver scroll-reveal
 * animations before extracting the DOM, then restores the original scroll position.
 */
export async function warmupScrollReveal(stepDelayMs = 80): Promise<void> {
  if (typeof window === 'undefined' || typeof window.scrollTo !== 'function' || typeof document === 'undefined') {
    return;
  }
  const origX = window.scrollX || 0;
  const origY = window.scrollY || 0;
  const docHeight = Math.max(
    document.body?.scrollHeight || 0,
    document.documentElement?.scrollHeight || 0
  );
  const step = Math.max(300, window.innerHeight || 800);

  for (let y = 0; y <= docHeight; y += step) {
    window.scrollTo({ left: 0, top: y, behavior: 'instant' as ScrollBehavior });
    await new Promise((r) => setTimeout(r, stepDelayMs));
  }
  window.scrollTo({ left: origX, top: origY, behavior: 'instant' as ScrollBehavior });
  await new Promise((r) => setTimeout(r, stepDelayMs));
}

/**
 * Async DOM extractor that optionally warms up scroll animations, resolves external HTTP(S)
 * image URLs, and compresses oversized data URIs into Figma-compatible PNG/JPEG base64 strings.
 */
export async function extractFIRFromElementAsync(
  rootElement: HTMLElement,
  maxImageDimension = 2048,
  options?: { warmupScroll?: boolean; fetchExternalImage?: ExternalImageFetcher }
): Promise<FIRNode> {
  if (options?.warmupScroll) {
    await warmupScrollReveal();
  }
  const tree = extractFIRFromElement(rootElement);
  return resolveTreeImagesAsync(tree, maxImageDimension, options?.fetchExternalImage);
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
  const style = extractElementStyles(computed);

  const layout = analyzeElementLayout(computed);

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
      svgContent: serializeSvgElement(element, element.parentElement || undefined),
    };
  }

  // 2. IMG element handler
  if (tagName === 'IMG') {
    const imgElement = element as HTMLImageElement;
    const imageData = extractImageData(element) || {
      base64: imgElement.src || '',
      scaleMode: 'FILL',
    };
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
      imageData,
    };
  }

  // Filter child elements
  const childElements: HTMLElement[] = [];
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i] as HTMLElement;
    if (!IGNORED_TAGS.has(child.tagName.toUpperCase())) {
      const childComputed = window.getComputedStyle(child);
      const childRect = child.getBoundingClientRect();
      const hasSize = childRect.width > 0 && childRect.height > 0;
      const hasChildren = child.children && child.children.length > 0;
      if (
        childComputed.display !== 'none' &&
        childComputed.visibility !== 'hidden' &&
        (hasSize || (hasChildren && childComputed.overflow !== 'hidden'))
      ) {
        childElements.push(child);
      }
    }
  }

  // Check if element is a text container (leaf text or block with inline tags like b, a, span)
  if (isTextContainer(element)) {
    const textData = extractTextData(element);
    if (textData.characters.trim().length > 0) {
      const hasBoxStyling = Boolean(
        (style.backgroundColor && style.backgroundColor.a > 0) ||
          style.borders ||
          (style.shadows && style.shadows.length > 0)
      );

      if (hasBoxStyling) {
        const padTop = parseFloat(computed.paddingTop) || 0;
        const padRight = parseFloat(computed.paddingRight) || 0;
        const padBottom = parseFloat(computed.paddingBottom) || 0;
        const padLeft = parseFloat(computed.paddingLeft) || 0;
        const innerWidth = Math.max(1, bounds.width - padLeft - padRight);
        const innerHeight = Math.max(1, bounds.height - padTop - padBottom);

        const textChild: FIRNode = {
          id: `${id}-text`,
          name: `${name}-text`,
          type: 'TEXT',
          bounds: {
            x: bounds.x + padLeft,
            y: bounds.y + padTop,
            width: innerWidth,
            height: innerHeight,
          },
          visible,
          opacity: 1,
          clipsContent: false,
          zIndex: 0,
          textData,
        };

        const buttonLayout: FIRLayout = layout
          ? {
              ...layout,
              sizingHorizontal: 'FIXED',
              sizingVertical: 'FIXED',
            }
          : {
              mode: 'HORIZONTAL',
              wrap: false,
              itemSpacing: 0,
              padding: { top: padTop, right: padRight, bottom: padBottom, left: padLeft },
              primaryAlign: computed.textAlign === 'center' || tagName === 'BUTTON' ? 'CENTER' : 'MIN',
              counterAlign: 'CENTER',
              sizingHorizontal: 'FIXED',
              sizingVertical: 'FIXED',
            };

        return {
          id,
          name,
          type: 'FRAME',
          bounds,
          visible,
          opacity,
          clipsContent,
          layout: buttonLayout,
          zIndex,
          style: Object.keys(style).length > 0 ? style : undefined,
          children: [textChild],
        };
      }

      return {
        id,
        name,
        type: 'TEXT',
        bounds,
        visible,
        opacity,
        clipsContent,
        layout,
        zIndex,
        style: Object.keys(style).length > 0 ? style : undefined,
        textData,
      };
    }
  }

  // Frame container node
  const children: FIRNode[] = [];
  // Pseudo-element ::before
  const beforeNode = extractPseudoElement(element, '::before', bounds);
  if (beforeNode) {
    children.push(beforeNode);
  }

  for (const childEl of childElements) {
    children.push(traverseElement(childEl));
  }

  // Pseudo-element ::after
  const afterNode = extractPseudoElement(element, '::after', bounds);
  if (afterNode) {
    children.push(afterNode);
  }

  const bgImageData = extractImageData(element);

  // If flex container has gap: 0 and children are separated via CSS margins, infer itemSpacing
  if (
    layout &&
    (layout.mode === 'HORIZONTAL' || layout.mode === 'VERTICAL') &&
    layout.itemSpacing === 0 &&
    layout.primaryAlign !== 'SPACE_BETWEEN' &&
    children.length >= 2
  ) {
    const flowChildren = children.filter((c) => !c.layout?.isAbsolute);
    const gaps: number[] = [];
    for (let i = 0; i < flowChildren.length - 1; i++) {
      const a = flowChildren[i].bounds;
      const b = flowChildren[i + 1].bounds;
      const gap =
        layout.mode === 'HORIZONTAL'
          ? b.x - (a.x + a.width)
          : b.y - (a.y + a.height);
      if (gap > 0.5 && gap < 500) {
        gaps.push(Math.round(gap));
      }
    }
    if (gaps.length > 0) {
      layout.itemSpacing = Math.min(...gaps);
    }
  }

  return {
    id,
    name,
    type: 'FRAME',
    bounds,
    visible,
    opacity,
    clipsContent,
    layout,
    zIndex,
    style: Object.keys(style).length > 0 ? style : undefined,
    imageData: bgImageData,
    children: children.length > 0 ? children : undefined,
  };
}
