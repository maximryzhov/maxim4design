import { parseCssColor } from './dom-extractor.ts';

/**
 * Sanitizes and normalizes an SVG element for Figma.
 * 1. Resolves `currentColor` into computed RGB/Hex color.
 * 2. Ensures `xmlns` and proper `width`/`height` or `viewBox`.
 * 3. Handles default fills/strokes.
 */
export function serializeSvgElement(
  svgElement: Element,
  parentElement?: HTMLElement
): string {
  let computedColor = 'rgb(0, 0, 0)';

  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const computed = window.getComputedStyle(svgElement);
    if (computed.color && computed.color !== 'rgba(0, 0, 0, 0)') {
      computedColor = computed.color;
    } else if (parentElement) {
      const parentComputed = window.getComputedStyle(parentElement);
      if (parentComputed.color) {
        computedColor = parentComputed.color;
      }
    }
  }

  let svgString = svgElement.outerHTML || '';

  // 1. Replace currentColor with the computed color (case-insensitive)
  svgString = svgString.replace(/currentColor/gi, computedColor);

  // 2. Ensure xmlns attribute exists
  if (!svgString.includes('xmlns=')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // 3. Ensure viewBox or width/height attributes exist
  const hasWidth = typeof svgElement.hasAttribute === 'function' ? svgElement.hasAttribute('width') : false;
  const hasHeight = typeof svgElement.hasAttribute === 'function' ? svgElement.hasAttribute('height') : false;
  const hasViewBox = typeof svgElement.hasAttribute === 'function' ? svgElement.hasAttribute('viewBox') : false;

  if (!hasViewBox && hasWidth && hasHeight && typeof svgElement.getAttribute === 'function') {
    const w = svgElement.getAttribute('width');
    const h = svgElement.getAttribute('height');
    svgString = svgString.replace('<svg', `<svg viewBox="0 0 ${w} ${h}"`);
  } else if (!hasWidth && !hasHeight && !hasViewBox && typeof svgElement.getBoundingClientRect === 'function') {
    const rect = svgElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      svgString = svgString.replace(
        '<svg',
        `<svg width="${Math.round(rect.width)}" height="${Math.round(rect.height)}" viewBox="0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}"`
      );
    }
  }

  return svgString;
}
