import type { FIRNode, FIRBounds, RGBAColor } from '../types/fir.ts';
import { fontManager } from './font-manager.ts';
import { applyAutoLayout, applyChildSizing, applyChildPositioning } from './layout-engine.ts';
import { renderTextNode } from './text-renderer.ts';
import { renderVectorNode } from './vector-renderer.ts';
import { renderImageNode, createImagePaint } from './image-renderer.ts';
import { applyStyles } from './style-applier.ts';
import { sortChildrenByStackingOrder } from './stacking-manager.ts';

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
  parentBounds?: FIRBounds
): Promise<SceneNode> {
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

  // Auto Layout configuration
  if (node.layout) {
    applyAutoLayout(frame, node.layout);
  }

  // Recursively render children in proper stacking context order
  if (node.children && node.children.length > 0) {
    const sortedChildren = sortChildrenByStackingOrder(node.children);
    for (const childNode of sortedChildren) {
      const childSceneNode = await renderFIRNode(childNode, frame, node.bounds);
      frame.appendChild(childSceneNode);

      if (childNode.layout) {
        applyChildSizing(childSceneNode, {
          horizontal: childNode.layout.sizingHorizontal,
          vertical: childNode.layout.sizingVertical,
        });

        const childRelX = childNode.bounds.x - node.bounds.x;
        const childRelY = childNode.bounds.y - node.bounds.y;
        applyChildPositioning(childSceneNode, childNode.layout, childRelX, childRelY);
      }
    }
  }

  return frame;
}
