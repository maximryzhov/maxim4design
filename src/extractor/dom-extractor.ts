import type {
  FIRNode,
  FIRNodeType,
  RGBAColor,
  FIRBounds,
  FIRStyle,
  FIRLayout,
  FIRTransform,
  BorderSideStyle,
  TextSegment,
} from '../types/fir.ts';
import {
  isTextContainer,
  extractTextData,
  extractTextNodeData,
  extractFormControlTextData,
  type FormControlKind,
} from './text-builder.ts';
import { extractElementStyles } from './style-extractor.ts';
import { serializeSvgElement } from './svg-serializer.ts';
import { extractBackgroundImageUrl, extractImageData, resolveTreeImagesAsync, type ExternalImageFetcher } from './image-loader.ts';
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
 * Returns true for a `<details>` element whose content is collapsed.
 * Chrome still reports layout boxes for the hidden answer inside such an element,
 * so visibility must be decided from the element's open state rather than from
 * getBoundingClientRect()/getClientRects().
 */
function isClosedDetails(element: HTMLElement): boolean {
  return (
    element.tagName.toUpperCase() === 'DETAILS' &&
    (element as HTMLDetailsElement).open !== true
  );
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
 * Disables CSS transitions/animations for the duration of extraction. Scroll-reveal
 * libraries animate opacity from 0 to 1; reading styles mid-transition bakes 0.27–0.99
 * into FIR and makes cards semi-transparent in Figma. With transitions off, adding
 * the final `.is-visible` class snaps the element to its target opacity immediately.
 *
 * Returns a cleanup function that removes the injected style.
 */
export function disableTransitionsForExtraction(): () => void {
  if (
    typeof document === 'undefined' ||
    !document.head ||
    typeof document.createElement !== 'function'
  ) {
    return () => undefined;
  }
  const style = document.createElement('style');
  style.setAttribute('data-maxim4design-extraction', 'transitions-off');
  style.textContent =
    '*,*::before,*::after{transition:none!important;animation:none!important;' +
    'scroll-behavior:auto!important}';
  document.head.appendChild(style);
  return () => {
    if (style.parentNode) style.parentNode.removeChild(style);
  };
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
  const restoreAnimations = options?.warmupScroll
    ? disableTransitionsForExtraction()
    : undefined;
  try {
    if (options?.warmupScroll) {
      await warmupScrollReveal();
    }
    const tree = extractFIRFromElement(rootElement);
    return await resolveTreeImagesAsync(tree, maxImageDimension, options?.fetchExternalImage);
  } finally {
    restoreAnimations?.();
  }
}

function getTextNodeBounds(node: Node): FIRBounds | undefined {
  if (typeof document === 'undefined' || typeof document.createRange !== 'function') {
    return undefined;
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return undefined;
    return {
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
    };
  } catch {
    return undefined;
  }
}

function parseTransformMatrix(computed: CSSStyleDeclaration): FIRTransform | undefined {
  const raw = computed.transform;
  if (!raw || raw === 'none') return undefined;

  const match = raw.match(/matrix\(([^)]+)\)/);
  if (!match) return undefined;

  const values = match[1].split(',').map((value) => parseFloat(value.trim()));
  if (values.length < 6 || values.some((value) => Number.isNaN(value))) return undefined;

  const [a, b, c, d, e, f] = values;
  const isIdentity =
    Math.abs(a - 1) < 0.0001 &&
    Math.abs(b) < 0.0001 &&
    Math.abs(c) < 0.0001 &&
    Math.abs(d - 1) < 0.0001;
  if (isIdentity) return undefined;

  let rotation = 0;
  if (Math.abs(b) > 0.0001 || Math.abs(c) > 0.0001) {
    rotation = (Math.atan2(b, a) * 180) / Math.PI;
  } else if (a < 0 && d < 0) {
    rotation = 180;
  }

  const transform: FIRTransform = {
    scaleX: a,
    scaleY: d,
    rotation,
    translateX: e,
    translateY: f,
  };

  // getBoundingClientRect() is the axis-aligned box of the already-rotated
  // element. Keep the CSS layout box so the renderer can undo that inflation
  // (e.g. a 37x37 FAQ "+" becomes 52.33x52.33 at 45 degrees).
  const baseWidth = parseFloat(computed.width);
  const baseHeight = parseFloat(computed.height);
  if (Number.isFinite(baseWidth) && baseWidth > 0) transform.baseWidth = baseWidth;
  if (Number.isFinite(baseHeight) && baseHeight > 0) transform.baseHeight = baseHeight;

  return transform;
}

/** Undoes the bounding-box inflation caused by a CSS rotation. */
function getUnrotatedBounds(bounds: FIRBounds, transform?: FIRTransform): FIRBounds {
  if (!transform?.baseWidth || !transform?.baseHeight) return bounds;
  return {
    x: bounds.x + (bounds.width - transform.baseWidth) / 2,
    y: bounds.y + (bounds.height - transform.baseHeight) / 2,
    width: transform.baseWidth,
    height: transform.baseHeight,
  };
}

function decodeSvgDataUrl(url: string): string | undefined {
  if (!url.startsWith('data:image/svg+xml')) return undefined;
  const comma = url.indexOf(',');
  if (comma < 0) return undefined;
  const meta = url.slice(0, comma);
  const payload = url.slice(comma + 1);
  try {
    if (meta.includes(';base64')) {
      return typeof atob === 'function' ? atob(payload) : undefined;
    }
    return decodeURIComponent(payload);
  } catch {
    return undefined;
  }
}

function parseSvgSize(svg: string): { width: number; height: number } | undefined {
  const width = parseFloat((svg.match(/<svg[^>]*\bwidth=['"]([\d.]+)/i) || [])[1]);
  const height = parseFloat((svg.match(/<svg[^>]*\bheight=['"]([\d.]+)/i) || [])[1]);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }
  const viewBox = (svg.match(/viewBox=['"]([^'"]+)['"]/i) || [])[1];
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  return undefined;
}

function parseBackgroundSize(
  value: string,
  fallback: { width: number; height: number }
): { width: number; height: number } {
  const parts = (value || '').trim().split(/\s+/);
  const parse = (token: string | undefined, fb: number) => {
    if (!token || token === 'auto' || token === 'cover' || token === 'contain') return fb;
    const parsed = parseFloat(token);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fb;
  };
  const width = parse(parts[0], fallback.width);
  const height = parse(parts[1] || parts[0], fallback.height);
  return { width, height };
}

function parseBackgroundPosition(
  value: string,
  container: { width: number; height: number },
  icon: { width: number; height: number }
): { x: number; y: number } {
  const tokens = (value || '').trim().split(/\s+/);
  const number = (token: string | undefined) => {
    if (!token) return 0;
    const parsed = parseFloat(token);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Chrome resolves `right 17px center` into `calc(100% - 11.6719px) 50%`.
  const calcX = value.match(/calc\(\s*([\d.]+)%\s*([+-])\s*([\d.]+)px\s*\)/i);
  if (calcX) {
    const percent = parseFloat(calcX[1]) / 100;
    const offset = parseFloat(calcX[3]);
    return {
      x: (container.width - icon.width) * percent + (calcX[2] === '-' ? -offset : offset),
      y: (container.height - icon.height) / 2,
    };
  }

  let x = (container.width - icon.width) / 2;
  const first = tokens[0] || 'center';
  if (first === 'left') {
    x = number(tokens[1]);
  } else if (first === 'right') {
    x = container.width - icon.width - number(tokens[1]);
  } else if (first.endsWith('%')) {
    x = ((container.width - icon.width) * parseFloat(first)) / 100;
  }

  let y = (container.height - icon.height) / 2;
  const vertical = first === 'left' || first === 'right' ? tokens[2] : tokens[1];
  if (vertical === 'top') {
    y = first === 'left' || first === 'right' ? number(tokens[3]) : number(tokens[2]);
  } else if (vertical === 'bottom') {
    const offset = first === 'left' || first === 'right' ? number(tokens[3]) : number(tokens[2]);
    y = container.height - icon.height - offset;
  } else if (vertical && vertical.endsWith('%')) {
    y = ((container.height - icon.height) * parseFloat(vertical)) / 100;
  }

  return { x, y };
}


function buildFormControlNode(
  element: HTMLElement,
  kind: FormControlKind,
  base: {
    id: string;
    name: string;
    bounds: FIRBounds;
    visible: boolean;
    opacity: number;
    clipsContent: boolean;
    zIndex: number;
    style?: FIRStyle;
    layout?: FIRLayout;
  }
): FIRNode {
  const computed = window.getComputedStyle(element);
  const inputType =
    kind === 'input' ? String((element as HTMLInputElement).type || 'text').toLowerCase() : '';
  const isChoice = inputType === 'checkbox' || inputType === 'radio';

  if (isChoice) {
    const checked = Boolean((element as HTMLInputElement).checked);
    const style: FIRStyle = { ...(base.style || {}) };
    if (!style.borders) {
      const borderColor: RGBAColor = { r: 0.85, g: 0.87, b: 0.83, a: 1 };
      const side = { width: 1, color: borderColor, style: 'solid' as const };
      style.borders = { top: side, right: side, bottom: side, left: side };
    }
    if (!style.borderRadius) {
      const radius = { topLeft: 3, topRight: 3, bottomRight: 3, bottomLeft: 3 };
      style.borderRadius = radius;
    }

    const children: FIRNode[] = [];
    if (checked) {
      const size = Math.max(8, Math.min(base.bounds.width, base.bounds.height) - 4);
      const x = base.bounds.x + (base.bounds.width - size) / 2;
      const y = base.bounds.y + (base.bounds.height - size) / 2;
      children.push({
        id: `${base.id}-check`,
        name: `${base.name}-check`,
        type: 'VECTOR',
        bounds: { x, y, width: size, height: size },
        visible: base.visible,
        opacity: 1,
        clipsContent: false,
        zIndex: 1,
        svgContent: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 10 10"><path d="M1.5 5.2 L4 7.7 L8.7 2.4" fill="none" stroke="#193800" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      });
    }

    return {
      ...base,
      type: 'FRAME',
      style,
      children: children.length > 0 ? children : undefined,
    };
  }

  const textData = extractFormControlTextData(element, kind);
  const children: FIRNode[] = [];

  if (textData) {
    const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
    const borderRight = parseFloat(computed.borderRightWidth) || 0;
    const borderTop = parseFloat(computed.borderTopWidth) || 0;
    const borderBottom = parseFloat(computed.borderBottomWidth) || 0;
    const padLeft = parseFloat(computed.paddingLeft) || 0;
    const padRight = parseFloat(computed.paddingRight) || 0;
    const padTop = parseFloat(computed.paddingTop) || 0;
    const padBottom = parseFloat(computed.paddingBottom) || 0;

    const x = base.bounds.x + borderLeft + padLeft;
    const y = base.bounds.y + borderTop + padTop;
    const width = Math.max(
      1,
      base.bounds.width - borderLeft - borderRight - padLeft - padRight
    );
    const height = Math.max(
      1,
      base.bounds.height - borderTop - borderBottom - padTop - padBottom
    );

    children.push({
      id: `${base.id}-text`,
      name: `${base.name}-text`,
      type: 'TEXT',
      bounds: { x, y, width, height },
      visible: base.visible,
      opacity: 1,
      clipsContent: false,
      zIndex: 0,
      textData,
    });
  }

  // Native select arrows are CSS background-images. They are intentionally skipped
  // as a full-frame background paint, but must be preserved as a small child layer.
  if (kind === 'select') {
    const bgUrl = extractBackgroundImageUrl(computed.backgroundImage || '');
    if (bgUrl) {
      const svg = decodeSvgDataUrl(bgUrl);
      const intrinsic = svg ? parseSvgSize(svg) : undefined;
      const icon = parseBackgroundSize(
        computed.backgroundSize || '',
        intrinsic || { width: 12, height: 8 }
      );
      const position = parseBackgroundPosition(
        computed.backgroundPosition || '',
        { width: base.bounds.width, height: base.bounds.height },
        icon
      );
      const arrowBounds: FIRBounds = {
        x: Math.round((base.bounds.x + position.x) * 100) / 100,
        y: Math.round((base.bounds.y + position.y) * 100) / 100,
        width: Math.round(icon.width * 100) / 100,
        height: Math.round(icon.height * 100) / 100,
      };

      if (svg) {
        children.push({
          id: `${base.id}-arrow`,
          name: `${base.name}-arrow`,
          type: 'VECTOR',
          bounds: arrowBounds,
          visible: base.visible,
          opacity: 1,
          clipsContent: false,
          zIndex: 1,
          svgContent: svg,
        });
      } else if (bgUrl.startsWith('data:image/')) {
        children.push({
          id: `${base.id}-arrow`,
          name: `${base.name}-arrow`,
          type: 'IMAGE',
          bounds: arrowBounds,
          visible: base.visible,
          opacity: 1,
          clipsContent: false,
          zIndex: 1,
          imageData: { base64: bgUrl, scaleMode: 'FIT' },
        });
      }

      // Keep the value text from running under the arrow.
      const textChild = children.find((child) => child.type === 'TEXT');
      if (textChild) {
        textChild.bounds.width = Math.max(1, textChild.bounds.width - icon.width - 6);
      }
    }
  }

  return {
    ...base,
    type: 'FRAME',
    children: children.length > 0 ? children : undefined,
  };
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
  const closedDetails = isClosedDetails(element);
  const opacity = parseFloat(computed.opacity) || 1;
  const clipsContent =
    computed.overflow === 'hidden' ||
    computed.overflowX === 'hidden' ||
    computed.overflowY === 'hidden';
  const zIndex = parseInt(computed.zIndex, 10) || 0;

  // Build style
  const style = extractElementStyles(computed);

  const layout = analyzeElementLayout(computed);
  const transform = parseTransformMatrix(computed);

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
      transform,
    };
  }

  // 3. Form controls (input/textarea/select)
  const formKind: FormControlKind | undefined =
    tagName === 'INPUT'
      ? 'input'
      : tagName === 'TEXTAREA'
        ? 'textarea'
        : tagName === 'SELECT'
          ? 'select'
          : undefined;
  if (formKind) {
    const inputType =
      formKind === 'input'
        ? String((element as HTMLInputElement).type || 'text').toLowerCase()
        : '';
    if (inputType === 'hidden') {
      return {
        id,
        name,
        type: 'FRAME',
        bounds,
        visible: false,
        opacity: 0,
        clipsContent,
        zIndex,
      };
    }
    return buildFormControlNode(element, formKind, {
      id,
      name,
      bounds,
      visible,
      opacity,
      clipsContent,
      zIndex,
      style: Object.keys(style).length > 0 ? style : undefined,
      layout,
    });
  }

  // Collect element and raw-text children in DOM order. Raw text nodes must survive
  // here (e.g. <summary>Вопрос<span class="faq-plus">+</span></summary>) — otherwise
  // the question text is dropped while only the "+" icon remains.
  const childNodes: Node[] = [];
  const sourceNodes: ArrayLike<Node> =
    element.childNodes && element.childNodes.length > 0 ? element.childNodes : element.children;
  for (let i = 0; i < sourceNodes.length; i++) {
    const node = sourceNodes[i] as Node & HTMLElement;
    const nodeType = typeof node.nodeType === 'number' ? node.nodeType : 1;

    if (nodeType === 3 /* TEXT_NODE */) {
      if (closedDetails) continue;
      if (node.textContent && node.textContent.trim()) {
        childNodes.push(node);
      }
      continue;
    }
    if (nodeType !== 1 /* ELEMENT_NODE */) continue;

    const child = node as HTMLElement;
    // A closed <details> only renders its <summary>; Chrome still gives the
    // answer content a layout box, which otherwise leaks into the FIR.
    if (closedDetails && child.tagName.toUpperCase() !== 'SUMMARY') {
      continue;
    }
    if (
      child.tagName.toUpperCase() === 'INPUT' &&
      String((child as HTMLInputElement).type || '').toLowerCase() === 'hidden'
    ) {
      continue;
    }
    if (!IGNORED_TAGS.has(child.tagName.toUpperCase())) {
      const childComputed = window.getComputedStyle(child);
      const childRect = child.getBoundingClientRect();
      const hasSize = childRect.width > 0 && childRect.height > 0;
      const hasChildren = child.children && child.children.length > 0;
      // Visually-hidden helpers (width/height 1px + clip) must not leak into FIR.
      const isVisuallyHidden =
        childRect.width <= 1 &&
        childRect.height <= 1 &&
        (childComputed.overflow === 'hidden' ||
          (childComputed.clip !== undefined && childComputed.clip !== 'auto'));
      if (
        !isVisuallyHidden &&
        childComputed.display !== 'none' &&
        childComputed.visibility !== 'hidden' &&
        (hasSize || (hasChildren && childComputed.overflow !== 'hidden'))
      ) {
        childNodes.push(node);
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
        const layoutBounds = getUnrotatedBounds(bounds, transform);
        const padTop = parseFloat(computed.paddingTop) || 0;
        const padRight = parseFloat(computed.paddingRight) || 0;
        const padBottom = parseFloat(computed.paddingBottom) || 0;
        const padLeft = parseFloat(computed.paddingLeft) || 0;
        const innerWidth = Math.max(1, layoutBounds.width - padLeft - padRight);
        const innerHeight = Math.max(1, layoutBounds.height - padTop - padBottom);

        const textChild: FIRNode = {
          id: `${id}-text`,
          name: `${name}-text`,
          type: 'TEXT',
          bounds: {
            x: layoutBounds.x + padLeft,
            y: layoutBounds.y + padTop,
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
          transform,
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
        transform,
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

  for (const childNode of childNodes) {
    const childType = typeof (childNode as any).nodeType === 'number' ? (childNode as any).nodeType : 1;
    if (childType === 3) {
      const textData = extractTextNodeData(childNode, element);
      const textBounds = getTextNodeBounds(childNode);
      if (!textData || !textBounds) continue;
      children.push({
        id: `${id}-text-${children.length}`,
        name: `${name}-text`,
        type: 'TEXT',
        bounds: textBounds,
        visible,
        opacity: 1,
        clipsContent: false,
        zIndex: 0,
        textData,
      });
    } else {
      children.push(traverseElement(childNode as unknown as HTMLElement));
    }
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
    transform,
    children: children.length > 0 ? children : undefined,
  };
}
