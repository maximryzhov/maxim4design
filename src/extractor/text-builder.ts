import type { FIRTextData, TextSegment, RGBAColor } from '../types/fir.ts';
import { parseCssColor } from './dom-extractor.ts';

const INLINE_TAGS = new Set([
  'SPAN',
  'A',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'CODE',
  'SMALL',
  'MARK',
  'SUB',
  'SUP',
  'ABBR',
  'TIME',
  'CITE',
  'Q',
]);

const TEXT_BLOCK_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BUTTON',
  'LABEL',
  'LI',
  'A',
  'SPAN',
]);

// Replaced/embedded elements stay structural even when CSS renders them inline.
const REPLACED_TAGS = new Set([
  'IMG',
  'SVG',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'BUTTON',
]);

export function isInlineElement(el: Element): boolean {
  if (REPLACED_TAGS.has(el.tagName.toUpperCase())) {
    return false;
  }
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const computed = window.getComputedStyle(el);
    if (computed.position === 'absolute' || computed.position === 'fixed') {
      return false;
    }
    if (computed.display && computed.display !== 'inline') {
      return false;
    }
    if (computed.display === 'inline') {
      return true;
    }
  }
  return INLINE_TAGS.has(el.tagName.toUpperCase());
}

export function isTextContainer(element: HTMLElement): boolean {
  const tagName = element.tagName.toUpperCase();
  const computed = typeof window !== 'undefined' && window.getComputedStyle
    ? window.getComputedStyle(element)
    : undefined;
  const display = computed?.display || '';

  // Flex/grid containers stay structural even when their children are inline tags.
  // Otherwise <a class="product-card" style="display:flex"> with spans inside would
  // be flattened into one TEXT node, losing images and per-child layout.
  if (
    (display === 'flex' || display === 'grid' || display === 'inline-flex' || display === 'inline-grid') &&
    element.children.length > 0
  ) {
    return false;
  }

  // Check child nodes: if all element children are inline tags, it's a text container.
  // Structural children (img/svg/input/...) are not inline, so they force a FRAME.
  let hasElementChildren = false;
  for (let i = 0; i < element.children.length; i++) {
    hasElementChildren = true;
    const child = element.children[i];
    if (!isInlineElement(child)) {
      return false;
    }
  }

  return hasElementChildren || TEXT_BLOCK_TAGS.has(tagName) || Boolean(element.textContent?.trim());
}

export function normalizeWhitespace(raw: string, whiteSpace = 'normal'): string {
  if (whiteSpace === 'pre' || whiteSpace === 'pre-wrap') {
    return raw;
  }
  if (whiteSpace === 'pre-line') {
    return raw.replace(/[ \t]+/g, ' ');
  }
  return raw.replace(/\s+/g, ' ');
}

interface SegmentCollectorState {
  characters: string;
  segments: TextSegment[];
}

/**
 * Builds a TextSegment from a computed style and a character range.
 * Shared by inline text extraction and raw text-node extraction.
 */
function createSegmentFromComputed(
  computed: CSSStyleDeclaration,
  start: number,
  end: number
): TextSegment {
  const textColor = parseCssColor(computed.color) || { r: 0, g: 0, b: 0, a: 1 };
  const fontSize = parseFloat(computed.fontSize) || 16;
  const fontWeight =
    parseInt(computed.fontWeight, 10) || (computed.fontWeight === 'bold' ? 700 : 400);
  const lineHeightVal = parseFloat(computed.lineHeight);
  const effectiveLineHeight = !isNaN(lineHeightVal) && lineHeightVal > 0
    ? Math.round(lineHeightVal * 100) / 100
    : fontSize >= 28
      ? Math.round(fontSize * 1.05 * 100) / 100
      : undefined;
  const letterSpacingVal = parseFloat(computed.letterSpacing);

  let textDecoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH' = 'NONE';
  const dec = computed.textDecorationLine || computed.textDecoration || '';
  if (dec.includes('underline')) {
    textDecoration = 'UNDERLINE';
  } else if (dec.includes('line-through')) {
    textDecoration = 'STRIKETHROUGH';
  }

  const fontStyle: 'normal' | 'italic' = computed.fontStyle === 'italic' ? 'italic' : 'normal';

  return {
    start,
    end,
    fontFamily: (computed.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim() || 'Inter',
    fontWeight,
    fontSize,
    fontStyle,
    color: textColor,
    lineHeightPx: effectiveLineHeight,
    letterSpacingPx: !isNaN(letterSpacingVal) ? letterSpacingVal : undefined,
    textDecoration,
  };
}

/**
 * Extracts complete text and styled range segments from an element and its inline children.
 */
export function extractTextData(rootElement: HTMLElement): FIRTextData {
  const rootComputed = window.getComputedStyle(rootElement);
  const state: SegmentCollectorState = {
    characters: '',
    segments: [],
  };

  function collectFromNode(node: Node, parentElement: HTMLElement) {
    if (node.nodeType === 3 /* Node.TEXT_NODE */) {
      const rawText = node.textContent || '';
      if (!rawText) return;

      const computed = window.getComputedStyle(parentElement);
      let text = normalizeWhitespace(rawText, computed.whiteSpace);

      // Trim leading whitespace at the very start or collapse consecutive spaces across nodes
      if (state.characters.length === 0 || state.characters.endsWith(' ') || state.characters.endsWith('\n')) {
        text = text.trimStart();
      }
      if (!text) return;

      const start = state.characters.length;
      state.characters += text;
      const end = state.characters.length;

      state.segments.push(createSegmentFromComputed(computed, start, end));
    } else if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const childEl = node as HTMLElement;
      const childTag = (childEl.tagName || '').toUpperCase();

      if (childTag === 'BR') {
        if (state.characters.endsWith(' ')) {
          state.characters = state.characters.slice(0, -1);
          if (state.segments.length > 0) {
            state.segments[state.segments.length - 1].end = state.characters.length;
          }
        }
        state.characters += '\n';
        if (state.segments.length > 0) {
          state.segments[state.segments.length - 1].end = state.characters.length;
        }
        return;
      }

      const childComputed = window.getComputedStyle(childEl);
      if (childComputed.display === 'none' || childComputed.visibility === 'hidden') {
        return;
      }

      // If child has childNodes, recursively collect
      if (childEl.childNodes && childEl.childNodes.length > 0) {
        for (let i = 0; i < childEl.childNodes.length; i++) {
          collectFromNode(childEl.childNodes[i], childEl);
        }
      } else if (childEl.textContent) {
        collectFromNode(
          {
            nodeType: 3,
            textContent: childEl.textContent,
          } as Node,
          childEl
        );
      }
    }
  }

  if (rootElement.childNodes && rootElement.childNodes.length > 0) {
    for (let i = 0; i < rootElement.childNodes.length; i++) {
      collectFromNode(rootElement.childNodes[i], rootElement);
    }
  } else if (rootElement.textContent) {
    collectFromNode(
      {
        nodeType: 3,
        textContent: rootElement.textContent,
      } as Node,
      rootElement
    );
  }

  // Trim trailing whitespace from characters and adjust last segment
  if (state.characters.endsWith(' ')) {
    state.characters = state.characters.trimEnd();
    if (state.segments.length > 0) {
      const last = state.segments[state.segments.length - 1];
      last.end = state.characters.length;
    }
  }

  // Fallback segment if none collected
  if (state.segments.length === 0 && state.characters.length > 0) {
    state.segments.push({
      start: 0,
      end: state.characters.length,
      fontFamily: (rootComputed.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim() || 'Inter',
      fontWeight: parseInt(rootComputed.fontWeight, 10) || 400,
      fontSize: parseFloat(rootComputed.fontSize) || 16,
      color: parseCssColor(rootComputed.color) || { r: 0, g: 0, b: 0, a: 1 },
    });
  }

  const whiteSpace = rootComputed.whiteSpace || 'normal';
  let isSingleLine = whiteSpace === 'nowrap';

  if (!isSingleLine && !state.characters.includes('\n') && typeof rootElement.getBoundingClientRect === 'function') {
    const rect = rootElement.getBoundingClientRect();
    const firstFontSize = state.segments[0]?.fontSize || parseFloat(rootComputed.fontSize) || 16;
    const rawLineHeight = parseFloat(rootComputed.lineHeight);
    const effectiveLineHeight = !isNaN(rawLineHeight) ? rawLineHeight : firstFontSize * 1.25;
    if (rect.height > 0 && rect.height <= Math.max(effectiveLineHeight, firstFontSize * 1.2) * 1.45) {
      isSingleLine = true;
    }
  }

  return {
    characters: state.characters,
    segments: state.segments,
    whiteSpace,
    isSingleLine,
  };
}

/**
 * Extracts a standalone DOM text node (e.g. "Всегда зелёные" directly inside <summary>
 * before <span class="faq-plus">). Used when the parent is a structural FRAME, so the
 * regular text-container path is not taken.
 */
export function extractTextNodeData(
  textNode: Node,
  parentElement: HTMLElement
): FIRTextData | undefined {
  if (typeof window === 'undefined' || !window.getComputedStyle) return undefined;

  const computed = window.getComputedStyle(parentElement);
  const raw = textNode.textContent || '';
  const characters = normalizeWhitespace(raw, computed.whiteSpace).trim();
  if (!characters) return undefined;

  const segment = createSegmentFromComputed(computed, 0, characters.length);
  const whiteSpace = computed.whiteSpace || 'normal';
  let isSingleLine = whiteSpace === 'nowrap';

  if (!isSingleLine && typeof document !== 'undefined' && typeof document.createRange === 'function') {
    try {
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const rect = range.getBoundingClientRect();
      const fontSize = segment.fontSize;
      const lineHeight = segment.lineHeightPx || fontSize * 1.25;
      if (rect.height > 0 && rect.height <= Math.max(lineHeight, fontSize * 1.2) * 1.45) {
        isSingleLine = true;
      }
    } catch {
      // Range may fail on detached/mock nodes; keep multi-line default.
    }
  }

  return {
    characters,
    segments: [segment],
    whiteSpace,
    isSingleLine,
  };
}
