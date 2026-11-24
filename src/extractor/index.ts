// Browser DOM Extractor entry point
import { FIRNode } from '../types/fir';

export function extractElement(element: HTMLElement): Partial<FIRNode> {
  const rect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);

  return {
    id: element.id || undefined,
    name: element.tagName.toLowerCase(),
    type: 'FRAME',
    bounds: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    visible: computed.display !== 'none' && computed.visibility !== 'hidden',
    opacity: parseFloat(computed.opacity) || 1,
    clipsContent: computed.overflow === 'hidden',
    zIndex: parseInt(computed.zIndex, 10) || 0,
  };
}

// Global console helper
if (typeof window !== 'undefined') {
  (window as unknown as { maxim4design: { extractElement: typeof extractElement } }).maxim4design = {
    extractElement,
  };
}
