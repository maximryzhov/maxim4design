// Browser DOM Extractor entry point
export * from './dom-extractor';
import { extractFIRFromElement, parseCssColor } from './dom-extractor';

// Global console helper for DevTools snippets and browser extensions
if (typeof window !== 'undefined') {
  const globalObj = window as unknown as {
    maxim4design?: {
      extractFIRFromElement: typeof extractFIRFromElement;
      parseCssColor: typeof parseCssColor;
    };
  };

  globalObj.maxim4design = {
    ...(globalObj.maxim4design || {}),
    extractFIRFromElement,
    parseCssColor,
  };
}
