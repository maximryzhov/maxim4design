import type { FIRLayout } from '../types/fir.ts';

/**
 * Applies Auto Layout configuration from FIRLayout to a Figma FrameNode.
 */
export function applyAutoLayout(frame: FrameNode, layout?: FIRLayout): void {
  if (!layout || layout.mode === 'NONE') {
    frame.layoutMode = 'NONE';
    return;
  }

  // Set direction: HORIZONTAL or VERTICAL
  frame.layoutMode = layout.mode;

  // Set wrap (supported in modern Figma API)
  try {
    frame.layoutWrap = layout.wrap ? 'WRAP' : 'NO_WRAP';
  } catch {
    // Graceful fallback for older typings / environments
  }

  // Item spacing (gap)
  frame.itemSpacing = Math.max(0, layout.itemSpacing || 0);

  // Paddings
  if (layout.padding) {
    frame.paddingTop = Math.max(0, layout.padding.top || 0);
    frame.paddingRight = Math.max(0, layout.padding.right || 0);
    frame.paddingBottom = Math.max(0, layout.padding.bottom || 0);
    frame.paddingLeft = Math.max(0, layout.padding.left || 0);
  }

  // Primary & Counter axis sizing modes (prevent Figma from defaulting to HUG on FIXED containers)
  try {
    if (layout.mode === 'HORIZONTAL') {
      const isPrimaryHug =
        layout.sizingHorizontal === 'HUG' && layout.primaryAlign !== 'SPACE_BETWEEN';
      frame.primaryAxisSizingMode = isPrimaryHug ? 'AUTO' : 'FIXED';
      frame.counterAxisSizingMode = layout.sizingVertical === 'HUG' ? 'AUTO' : 'FIXED';
    } else if (layout.mode === 'VERTICAL') {
      const isPrimaryHug =
        layout.sizingVertical === 'HUG' && layout.primaryAlign !== 'SPACE_BETWEEN';
      frame.primaryAxisSizingMode = isPrimaryHug ? 'AUTO' : 'FIXED';
      frame.counterAxisSizingMode = layout.sizingHorizontal === 'HUG' ? 'AUTO' : 'FIXED';
    }
  } catch {
    // Graceful fallback for mock environments
  }

  // Primary axis alignment (justify-content)
  switch (layout.primaryAlign) {
    case 'CENTER':
      frame.primaryAxisAlignItems = 'CENTER';
      break;
    case 'MAX':
      frame.primaryAxisAlignItems = 'MAX';
      break;
    case 'SPACE_BETWEEN':
      frame.primaryAxisAlignItems = 'SPACE_BETWEEN';
      break;
    case 'MIN':
    default:
      frame.primaryAxisAlignItems = 'MIN';
      break;
  }

  // Counter axis alignment (align-items)
  switch (layout.counterAlign) {
    case 'CENTER':
      frame.counterAxisAlignItems = 'CENTER';
      break;
    case 'MAX':
      frame.counterAxisAlignItems = 'MAX';
      break;
    case 'BASELINE':
      try {
        frame.counterAxisAlignItems = 'BASELINE';
      } catch {
        frame.counterAxisAlignItems = 'MIN';
      }
      break;
    case 'MIN':
    default:
      frame.counterAxisAlignItems = 'MIN';
      break;
  }
}

/**
 * Applies child sizing rules (FILL, HUG, FIXED) to a node inside an Auto Layout container.
 */
export function applyChildSizing(
  child: SceneNode,
  sizing?: {
    horizontal?: 'FIXED' | 'HUG' | 'FILL';
    vertical?: 'FIXED' | 'HUG' | 'FILL';
  }
): void {
  if (!sizing) return;

  const target = child as unknown as {
    layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
    layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
    layoutGrow?: number;
    layoutAlign?: 'INHERIT' | 'STRETCH';
  };

  if (sizing.horizontal) {
    try {
      target.layoutSizingHorizontal = sizing.horizontal;
    } catch {
      // Fallback for older Figma API using layoutAlign / layoutGrow
      if (sizing.horizontal === 'FILL') {
        target.layoutAlign = 'STRETCH';
      }
    }
  }

  if (sizing.vertical) {
    try {
      target.layoutSizingVertical = sizing.vertical;
    } catch {
      if (sizing.vertical === 'FILL') {
        target.layoutGrow = 1;
      }
    }
  }
}

/**
 * Applies layout positioning (ABSOLUTE / AUTO) to a child node inside an Auto Layout container.
 */
export function applyChildPositioning(
  child: SceneNode,
  layout?: FIRLayout,
  relX?: number,
  relY?: number
): void {
  if (!layout) return;

  const target = child as unknown as {
    layoutPositioning?: 'AUTO' | 'ABSOLUTE';
  };

  if (layout.isAbsolute) {
    try {
      target.layoutPositioning = 'ABSOLUTE';
      if (typeof relX === 'number' && typeof relY === 'number') {
        child.x = relX;
        child.y = relY;
      }
    } catch {
      // ignore
    }
  }
}
