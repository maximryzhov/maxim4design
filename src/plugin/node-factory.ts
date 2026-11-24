import type { FIRNode, FIRBounds, RGBAColor } from '../types/fir.ts';
import { fontManager } from './font-manager.ts';
import { applyAutoLayout, applyChildSizing } from './layout-engine.ts';
import { renderTextNode } from './text-renderer.ts';

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

  if (node.type === 'RECTANGLE') {
    const rect = figma.createRectangle();
    rect.name = node.name || 'Rectangle';
    rect.x = relX;
    rect.y = relY;
    rect.resize(width, height);
    rect.opacity = node.opacity;
    rect.visible = node.visible;

    if (node.style?.backgroundColor && node.style.backgroundColor.a > 0) {
      const { color, opacity } = toFigmaColor(node.style.backgroundColor);
      rect.fills = [{ type: 'SOLID', color, opacity }];
    } else {
      rect.fills = [];
    }

    if (node.style?.borderRadius) {
      rect.topLeftRadius = node.style.borderRadius.topLeft;
      rect.topRightRadius = node.style.borderRadius.topRight;
      rect.bottomRightRadius = node.style.borderRadius.bottomRight;
      rect.bottomLeftRadius = node.style.borderRadius.bottomLeft;
    }

    return rect;
  }

  // Default: FRAME
  const frame = figma.createFrame();
  frame.name = node.name || 'Frame';
  frame.x = relX;
  frame.y = relY;
  frame.resize(width, height);
  frame.clipsContent = node.clipsContent;
  frame.opacity = node.opacity;
  frame.visible = node.visible;

  // Background fill
  if (node.style?.backgroundColor && node.style.backgroundColor.a > 0) {
    const { color, opacity } = toFigmaColor(node.style.backgroundColor);
    frame.fills = [{ type: 'SOLID', color, opacity }];
  } else {
    frame.fills = [];
  }

  // Border radius
  if (node.style?.borderRadius) {
    frame.topLeftRadius = node.style.borderRadius.topLeft;
    frame.topRightRadius = node.style.borderRadius.topRight;
    frame.bottomRightRadius = node.style.borderRadius.bottomRight;
    frame.bottomLeftRadius = node.style.borderRadius.bottomLeft;
  }

  // Auto Layout configuration
  if (node.layout) {
    applyAutoLayout(frame, node.layout);
  }

  // Recursively render children
  if (node.children && node.children.length > 0) {
    for (const childNode of node.children) {
      const childSceneNode = await renderFIRNode(childNode, frame, node.bounds);
      frame.appendChild(childSceneNode);

      if (childNode.layout) {
        applyChildSizing(childSceneNode, {
          horizontal: childNode.layout.sizingHorizontal,
          vertical: childNode.layout.sizingVertical,
        });
      }
    }
  }

  return frame;
}
