import type { FIRImageData, FIRNode } from '../types/fir.ts';

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
 * Converts an image element or bitmap to base64 Data URL using an in-memory canvas.
 * Downscales images larger than maxDimension (default 2048px) to keep FIR JSON compact.
 */
export function imageToDataUrl(
  img: HTMLImageElement,
  maxDimension = 2048
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
    const pngData = canvas.toDataURL('image/png');
    // If PNG is still > 1.5MB, try JPEG compression if no transparency is needed
    if (pngData.length > 1_500_000) {
      const jpegData = canvas.toDataURL('image/jpeg', 0.85);
      if (jpegData.length < pngData.length * 0.6) {
        // Check if image has any transparent pixels on corners/center before replacing PNG
        const sample = ctx.getImageData(0, 0, 1, 1).data;
        if (sample[3] === 255) {
          return jpegData;
        }
      }
    }
    return pngData;
  } catch (err) {
    // Canvas tainted by CORS or invalid image
    console.warn('[ImageLoader] Failed to read image bytes via canvas (likely CORS):', err);
    return undefined;
  }
}

/**
 * Asynchronously fetches an external HTTP(S) image URL (or decodes WebP/oversized data URI)
 * and converts it into a Figma-compatible PNG/JPEG base64 data URL.
 */
export async function resolveImageUrlToBase64(
  url: string,
  maxDimension = 2048
): Promise<string | undefined> {
  if (!url) return undefined;

  if (url.startsWith('data:image/')) {
    const isSupported = url.startsWith('data:image/png') || url.startsWith('data:image/jpeg');
    if (isSupported && url.length <= 1_000_000) {
      return url;
    }
    // Re-encode unsupported (e.g. WebP/AVIF) or oversized data URIs via canvas
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return url;
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(imageToDataUrl(img, maxDimension) || url);
      img.onerror = () => resolve(url);
      img.src = url;
    });
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return undefined;
  }

  try {
    if (typeof fetch !== 'function' || typeof Image === 'undefined') {
      return undefined;
    }
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return undefined;
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    try {
      return await new Promise<string | undefined>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(imageToDataUrl(img, maxDimension));
        img.onerror = () => resolve(undefined);
        img.src = objUrl;
      });
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  } catch (err) {
    console.warn('[ImageLoader] Async fetch failed (likely CORS or offline):', url, err);
    return undefined;
  }
}

/**
 * Walks an extracted FIRNode tree and resolves any HTTP(S) or oversized imageData.base64
 * entries asynchronously.
 */
export async function resolveTreeImagesAsync(
  root: FIRNode,
  maxDimension = 2048
): Promise<FIRNode> {
  const tasks: Array<Promise<void>> = [];

  function walk(node: FIRNode) {
    if (node.imageData?.base64) {
      const target = node.imageData;
      const src = target.base64;
      if (
        src.startsWith('http://') ||
        src.startsWith('https://') ||
        (src.startsWith('data:image/') &&
          (src.length > 1_000_000 ||
            (!src.startsWith('data:image/png') && !src.startsWith('data:image/jpeg'))))
      ) {
        tasks.push(
          resolveImageUrlToBase64(src, maxDimension).then((resolved) => {
            if (resolved) {
              target.base64 = resolved;
            }
          })
        );
      }
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(root);
  await Promise.all(tasks);
  return root;
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
