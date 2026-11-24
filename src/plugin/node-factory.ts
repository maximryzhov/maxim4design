import type { FIRNode, FIRBounds, RGBAColor } from '../types/fir.ts';
import { fontManager } from './font-manager.ts';
import { applyAutoLayout, applyChildSizing, applyChildPositioning } from './layout-engine.ts';
import { renderTextNode } from './text-renderer.ts';
import { renderVectorNode } from './vector-renderer.ts';
import { renderImageNode, createImagePaint } from './image-renderer.ts';
import { applyStyles } from './style-applier.ts';
import { sortChildrenByStackingOrder } from './stacking-manager.ts';

export interface RenderOptions {
  useAutoLayout?: boolean;
  includeHidden?: boolean;
  chunkSize?: number;
  onProgress?: (current: number, total: number, nodeName: string) => void | Promise<void>;
}

export interface RenderContext {
  options: RenderOptions;
  current: number;
  total: number;
  yieldCounter: number;
}

/**
 * Counts total FIR nodes in the tree, respecting the includeHidden flag.
 */
export function countFIRNodes(node: FIRNode, includeHidden = true): number {
  if (!includeHidden && !node.visible) {
    return 0;
  }
  let count = 1;
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      count += countFIRNodes(child, includeHidden);
    }
  }
  return count;
}

/**
 * Traverses FIR tree to collect unique font descriptors needed for preloading.
 */
export function collectFontsFromTree(
  node: FIRNode
): Array<{ family: string; weight?: number; isItalic?: boolean }> {
  const fonts = new Map<string, { family: string; weight?: number; isItalic?: boolean }>();

  function traverse(n: FIRNode) {
    if (n.type === 'TEXT' && n.textData?.segments) {
      for (const seg of n.textData.segments) {
        const family = seg.fontFamily || 'Inter';
        const weight = seg.fontWeight || 400;
        const isItalic = seg.fontStyle === 'italic';
        const key = `${family}:${weight}:${isItalic}`;
        if (!fonts.has(key)) {
          fonts.set(key, { family, weight, isItalic });
        }
      }
    }
    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return Array.from(fonts.values());
}

/**
 * Safely loads a font with fallback to Inter Regular
 */
export async function safeLoadFont(family: string = 'Inter', style: string = 'Regular'): Promise<FontName> {
  const isBold = style.toLowerCase().includes('bold');
  const weight = isBold ? 700 : 400;
  const isItalic = style.toLowerCase().includes('italic');
  return fontManager.loadFontSafely(family, weight, isItalic);
}

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
 * Renders a single FIRNode and its children into native Figma canvas nodes.
 */
export async function renderFIRNode(
  node: FIRNode,
  parentFrame?: FrameNode,
  parentBounds?: FIRBounds,
  options?: RenderOptions,
  context?: RenderContext
): Promise<SceneNode | null> {
  if (options?.includeHidden === false && !node.visible) {
    return null;
  }

  // Yield to UI event loop periodically in chunked mode
  if (context) {
    context.current++;
    context.yieldCounter++;
    const chunkSize = options?.chunkSize ?? 50;
    if (context.yieldCounter >= chunkSize) {
      context.yieldCounter = 0;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (options?.onProgress) {
        await options.onProgress(context.current, context.total, node.name);
      }
    }
  }

  const relX = parentBounds ? node.bounds.x - parentBounds.x : node.bounds.x;
  const relY = parentBounds ? node.bounds.y - parentBounds.y : node.bounds.y;
  const width = Math.max(1, node.bounds.width);
  const height = Math.max(1, node.bounds.height);

  if (node.type === 'TEXT') {
    return renderTextNode(node, parentFrame, parentBounds);
  }

  if (node.type === 'VECTOR') {
    return renderVectorNode(node, parentFrame, parentBounds);
  }

  if (node.type === 'IMAGE') {
    return renderImageNode(node, parentFrame, parentBounds);
  }

  if (node.type === 'RECTANGLE') {
    const rect = figma.createRectangle();
    rect.name = node.name || 'Rectangle';
    rect.x = relX;
    rect.y = relY;
    rect.resize(width, height);
    rect.opacity = node.opacity;
    rect.visible = node.visible;

    applyStyles(rect, node.style, node.clipsContent);
    return rect;
  }

  // Default: FRAME
  const frame = figma.createFrame();
  frame.name = node.name || 'Frame';
  frame.x = relX;
  frame.y = relY;
  frame.resize(width, height);
  frame.opacity = node.opacity;
  frame.visible = node.visible;

  // Apply visual styles (fills, corner radius, borders, clipsContent)
  applyStyles(frame, node.style, node.clipsContent);

  // Background image fill if present
  if (node.imageData) {
    const bgPaint = await createImagePaint(node.imageData);
    if (bgPaint) {
      const currentFills = Array.isArray(frame.fills) ? frame.fills : [];
      frame.fills = [...currentFills, bgPaint];
    }
  }

  // Auto Layout configuration (optional based on user settings)
  if (node.layout && options?.useAutoLayout !== false) {
    applyAutoLayout(frame, node.layout);
  }

  // Recursively render children in proper stacking context order
  if (node.children && node.children.length > 0) {
    const sortedChildren = sortChildrenByStackingOrder(node.children);
    for (const childNode of sortedChildren) {
      const childSceneNode = await renderFIRNode(childNode, frame, node.bounds, options, context);
      if (!childSceneNode) continue;

      frame.appendChild(childSceneNode);

      if (childNode.layout) {
        if (node.layout && node.layout.mode !== 'NONE' && options?.useAutoLayout !== false) {
          applyChildSizing(childSceneNode, {
            horizontal: childNode.layout.sizingHorizontal,
            vertical: childNode.layout.sizingVertical,
          });
        }

        const childRelX = childNode.bounds.x - node.bounds.x;
        const childRelY = childNode.bounds.y - node.bounds.y;
        applyChildPositioning(childSceneNode, childNode.layout, childRelX, childRelY);
      }
    }
  }

  return frame;
}

/**
 * Top-level entry point for rendering an entire FIR tree asynchronously with chunking and progress reporting.
 */
export async function renderFIRTreeAsync(
  root: FIRNode,
  options?: RenderOptions
): Promise<SceneNode> {
  const includeHidden = options?.includeHidden ?? true;
  const total = countFIRNodes(root, includeHidden);
  const context: RenderContext = {
    options: options || {},
    current: 0,
    total,
    yieldCounter: 0,
  };

  const sceneNode = await renderFIRNode(root, undefined, undefined, options, context);
  if (!sceneNode) {
    const fallbackFrame = figma.createFrame();
    fallbackFrame.name = root.name || 'Frame';
    return fallbackFrame;
  }
  return sceneNode;
}
