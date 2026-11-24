import type { FIRLayout } from '../types/fir.ts';
import { parseLayout } from './dom-extractor.ts';

/**
 * Analyzes layout mode and positioning strategy.
 * For CSS Grid and complex multi-dimensional layouts, falls back to `mode: 'NONE'`
 * with absolute coordinate positioning for 100% visual fidelity.
 * Also flags elements with `position: absolute` or `position: fixed`.
 */
export function analyzeElementLayout(
  computed: CSSStyleDeclaration
): FIRLayout | undefined {
  const isAbsolute =
    computed.position === 'absolute' || computed.position === 'fixed';
  const display = computed.display;

  // 1. CSS Grid Fallback
  if (display === 'grid' || display === 'inline-grid') {
    return {
      mode: 'NONE',
      wrap: false,
      itemSpacing: 0,
      padding: {
        top: parseFloat(computed.paddingTop) || 0,
        right: parseFloat(computed.paddingRight) || 0,
        bottom: parseFloat(computed.paddingBottom) || 0,
        left: parseFloat(computed.paddingLeft) || 0,
      },
      primaryAlign: 'MIN',
      counterAlign: 'MIN',
      isAbsolute,
    };
  }

  // 2. Flexbox
  const flexLayout = parseLayout(computed);
  if (flexLayout) {
    if (isAbsolute) {
      flexLayout.isAbsolute = true;
    }
    return flexLayout;
  }

  // 3. Regular block / inline with absolute positioning
  if (isAbsolute) {
    return {
      mode: 'NONE',
      wrap: false,
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      primaryAlign: 'MIN',
      counterAlign: 'MIN',
      isAbsolute: true,
    };
  }

  return undefined;
}
