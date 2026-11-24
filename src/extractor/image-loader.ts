import type { FIRImageData } from '../types/fir.ts';

/**
 * Extracts url from CSS background-image property.
 * e.g. `url("https://example.com/pic.png")` -> `https://example.com/pic.png`
 */
export function extractBackgroundImageUrl(bgImage: string): string | undefined {
  if (!bgImage || bgImage === 'none') return undefined;
  const match = bgImage.match(/url\(\s*['"]?([^'"]+)['"]?\s*\)/i);
  return match ? match[1] : undefined;
}

/**
 * Maps CSS object-fit / background-size to FIR scaleMode.
 */
export function mapObjectFitToScaleMode(fit: string): 'FILL' | 'FIT' | 'CROP' {
  if (fit === 'contain') return 'FIT';
  if (fit === 'none') return 'CROP';
  return 'FILL'; // cover or default
}

/**
 * Converts an image element or URL to base64 Data URL using an in-memory canvas.
 * Downscales images larger than 4096px to prevent memory overflow.
 */
export function imageToDataUrl(
  img: HTMLImageElement,
  maxDimension = 4096
): string | undefined {
  try {
    const width = img.naturalWidth || img.width || 1;
    const height = img.naturalHeight || img.height || 1;

    let targetWidth = width;
    let targetHeight = height;

    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
        targetWidth = maxDimension;
      } else {
        targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
        targetHeight = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/png');
  } catch (err) {
    // Canvas tainted by CORS or invalid image
    console.warn('[ImageLoader] Failed to read image bytes via canvas (likely CORS):', err);
    return undefined;
  }
}

/**
 * Synchronously extracts image data (base64 or direct URL placeholder).
 */
export function extractImageData(element: HTMLElement): FIRImageData | undefined {
  const tagName = element.tagName.toUpperCase();
  const computed = window.getComputedStyle(element);

  if (tagName === 'IMG') {
    const img = element as HTMLImageElement;
    const src = img.currentSrc || img.src || img.getAttribute('src') || '';
    if (!src) return undefined;

    const scaleMode = mapObjectFitToScaleMode(computed.objectFit);
    const base64Data = imageToDataUrl(img);

    return {
      base64: base64Data || src,
      scaleMode,
    };
  }

  // Check background-image
  const bgUrl = extractBackgroundImageUrl(computed.backgroundImage);
  if (bgUrl) {
    const scaleMode = mapObjectFitToScaleMode(computed.backgroundSize);
    return {
      base64: bgUrl,
      scaleMode,
    };
  }

  return undefined;
}
