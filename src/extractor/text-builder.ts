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

export function isInlineElement(el: Element): boolean {
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
  if (INLINE_TAGS.has(tagName)) {
    return true;
  }

  // Check child nodes: if all element children are inline tags, it's a text container
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

      // If text is purely whitespace at the very start of characters, trim it
      if (state.characters.length === 0) {
        text = text.trimStart();
      }
      if (!text) return;

      const start = state.characters.length;
      state.characters += text;
      const end = state.characters.length;

      const textColor = parseCssColor(computed.color) || { r: 0, g: 0, b: 0, a: 1 };
      const fontSize = parseFloat(computed.fontSize) || 16;
      const fontWeight =
        parseInt(computed.fontWeight, 10) || (computed.fontWeight === 'bold' ? 700 : 400);
      const lineHeightVal = parseFloat(computed.lineHeight);
      const letterSpacingVal = parseFloat(computed.letterSpacing);

      let textDecoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH' = 'NONE';
      const dec = computed.textDecorationLine || computed.textDecoration || '';
      if (dec.includes('underline')) {
        textDecoration = 'UNDERLINE';
      } else if (dec.includes('line-through')) {
        textDecoration = 'STRIKETHROUGH';
      }

      const fontStyle: 'normal' | 'italic' = computed.fontStyle === 'italic' ? 'italic' : 'normal';

      const segment: TextSegment = {
        start,
        end,
        fontFamily: (computed.fontFamily || 'Inter').split(',')[0].replace(/['"]/g, '').trim() || 'Inter',
        fontWeight,
        fontSize,
        fontStyle,
        color: textColor,
        lineHeightPx: !isNaN(lineHeightVal) ? lineHeightVal : undefined,
        letterSpacingPx: !isNaN(letterSpacingVal) ? letterSpacingVal : undefined,
        textDecoration,
      };

      state.segments.push(segment);
    } else if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const childEl = node as HTMLElement;
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
