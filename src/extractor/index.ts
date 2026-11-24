// Browser DOM Extractor entry point
export * from './dom-extractor.ts';
import { extractFIRFromElement, extractFIRFromElementAsync, parseCssColor } from './dom-extractor.ts';

// Global console helper for DevTools snippets and browser extensions
if (typeof window !== 'undefined') {
  const globalObj = window as unknown as {
    maxim4design?: {
      extractFIRFromElement: typeof extractFIRFromElement;
      extractFIRFromElementAsync: typeof extractFIRFromElementAsync;
      parseCssColor: typeof parseCssColor;
    };
  };

  globalObj.maxim4design = {
    ...(globalObj.maxim4design || {}),
    extractFIRFromElement,
    extractFIRFromElementAsync,
    parseCssColor,
  };
}
