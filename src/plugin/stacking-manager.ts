import type { FIRNode } from '../types/fir.ts';

/**
 * Performs a stable sort on child nodes based on CSS Stacking Context rules.
 * 1. Negative z-index elements are appended first (rendered beneath everything).
 * 2. z-index: 0 or default elements preserve their natural DOM document order.
 * 3. Positive z-index elements are appended last in ascending order (higher z-index on top).
 */
export function sortChildrenByStackingOrder(children: FIRNode[]): FIRNode[] {
  if (!children || children.length <= 1) {
    return children;
  }

  // Stable sort: when zIndex is equal, original DOM index is preserved
  return [...children].sort((a, b) => {
    const zA = a.zIndex ?? 0;
    const zB = b.zIndex ?? 0;
    return zA - zB;
  });
}
