import type { FIRNode, FIRBounds } from '../types/fir.ts';

/**
 * Safely renders a vector SVG into native Figma nodes via figma.createNodeFromSvg().
 * If SVG parsing fails, creates a visual placeholder rectangle instead of crashing.
 */
export async function renderVectorNode(
  node: FIRNode,
  parentFrame?: FrameNode,
  parentBounds?: FIRBounds
): Promise<SceneNode> {
  const relX = parentBounds ? node.bounds.x - parentBounds.x : node.bounds.x;
  const relY = parentBounds ? node.bounds.y - parentBounds.y : node.bounds.y;
  const width = Math.max(1, node.bounds.width);
  const height = Math.max(1, node.bounds.height);

  try {
    const rawSvg = node.svgContent?.trim();
    if (!rawSvg) {
      throw new Error('Empty SVG content');
    }

    const svgNode = figma.createNodeFromSvg(rawSvg);
    svgNode.name = node.name || 'Vector';
    svgNode.x = relX;
    svgNode.y = relY;
    svgNode.resize(width, height);
    svgNode.opacity = node.opacity;
    svgNode.visible = node.visible;

    return svgNode;
  } catch (err) {
    console.warn(`[VectorRenderer] Failed to render SVG for node "${node.name}":`, err);

    // Fallback: create safe placeholder rectangle
    const placeholder = figma.createRectangle();
    placeholder.name = `${node.name || 'Vector'} (Broken SVG Fallback)`;
    placeholder.x = relX;
    placeholder.y = relY;
    placeholder.resize(width, height);
    placeholder.opacity = node.opacity;
    placeholder.visible = node.visible;
    placeholder.fills = [{ type: 'SOLID', color: { r: 0.92, g: 0.92, b: 0.94 }, opacity: 0.9 }];
    placeholder.strokes = [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.75 }, opacity: 1 }];

    try {
      (placeholder as unknown as { dashPattern?: readonly number[] }).dashPattern = [4, 4];
    } catch {
      // ignore
    }

    return placeholder;
  }
}
