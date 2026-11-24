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
    let pngData = canvas.toDataURL('image/png');
    // If PNG is still > 1.5MB, try JPEG compression if no transparency is needed,
    // otherwise downscale alpha PNG to 1280px max dimension to keep FIR JSON compact.
    if (pngData.length > 1_500_000) {
      const jpegData = canvas.toDataURL('image/jpeg', 0.85);
      if (jpegData.length < pngData.length * 0.6) {
        const sample = ctx.getImageData(0, 0, 1, 1).data;
        if (sample[3] === 255) {
          return jpegData;
        }
      }
      if (Math.max(targetWidth, targetHeight) > 1280) {
        const scale = 1280 / Math.max(targetWidth, targetHeight);
        canvas.width = Math.max(1, Math.round(targetWidth * scale));
        canvas.height = Math.max(1, Math.round(targetHeight * scale));
        const ctx2 = canvas.getContext('2d');
        if (ctx2) {
          ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
          pngData = canvas.toDataURL('image/png');
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

export type ExternalImageFetcher = (url: string) => Promise<string | undefined>;

/**
 * Asynchronously fetches an external HTTP(S) image URL (or decodes WebP/oversized data URI)
 * and converts it into a Figma-compatible PNG/JPEG base64 data URL.
 */
export async function resolveImageUrlToBase64(
  url: string,
  maxDimension = 2048,
  fetchExternalImage?: ExternalImageFetcher
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
    if (typeof fetch === 'function' && typeof Image !== 'undefined') {
      const resp = await fetch(url, { mode: 'cors' });
      if (resp.ok) {
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        try {
          const decoded = await new Promise<string | undefined>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(imageToDataUrl(img, maxDimension));
            img.onerror = () => resolve(undefined);
            img.src = objUrl;
          });
          if (decoded) return decoded;
        } finally {
          URL.revokeObjectURL(objUrl);
        }
      }
    }
  } catch (err) {
    console.warn('[ImageLoader] Direct CORS fetch failed, checking fallback proxy:', url, err);
  }

  // Fallback to privileged proxy fetcher (e.g. Chrome Extension background worker)
  if (fetchExternalImage) {
    try {
      const proxiedDataUrl = await fetchExternalImage(url);
      if (proxiedDataUrl) {
        return resolveImageUrlToBase64(proxiedDataUrl, maxDimension);
      }
    } catch (err) {
      console.warn('[ImageLoader] Proxy fetch failed:', url, err);
    }
  }

  // Fallback to local bridge proxy (http://localhost:8765/proxy-image) if running
  if (typeof fetch === 'function') {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
      const timer = controller ? setTimeout(() => controller.abort(), 1500) : undefined;
      const proxyUrl = `http://localhost:8765/proxy-image?url=${encodeURIComponent(url)}`;
      const resp = await fetch(proxyUrl, { signal: controller?.signal });
      if (timer) clearTimeout(timer);
      if (resp.ok) {
        const json = await resp.json().catch(() => null);
        if (json?.dataUrl) {
          return resolveImageUrlToBase64(json.dataUrl, maxDimension);
        }
        if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
          const blob = await resp.blob();
          const objUrl = URL.createObjectURL(blob);
          try {
            const decoded = await new Promise<string | undefined>((resolve) => {
              const img = new Image();
              img.onload = () => resolve(imageToDataUrl(img, maxDimension));
              img.onerror = () => resolve(undefined);
              img.src = objUrl;
            });
            if (decoded) return decoded;
          } finally {
            URL.revokeObjectURL(objUrl);
          }
        }
      }
    } catch {
      // Local bridge not running — ignore silently
    }
  }

  return undefined;
}

/**
 * Computes an optimal maxDimension based on the element's rendered bounds.
 */
export function computeTargetImageDimension(
  boundsWidth: number,
  boundsHeight: number,
  maxDimension = 2048
): number {
  const longest = Math.max(boundsWidth || 0, boundsHeight || 0);
  if (longest <= 0) return maxDimension;
  return Math.min(maxDimension, Math.max(900, Math.round(longest * 1.5)));
}

/**
 * Walks an extracted FIRNode tree and resolves any HTTP(S) or oversized imageData.base64
 * entries asynchronously.
 */
export async function resolveTreeImagesAsync(
  root: FIRNode,
  maxDimension = 2048,
  fetchExternalImage?: ExternalImageFetcher
): Promise<FIRNode> {
  const tasks: Array<Promise<void>> = [];

  function walk(node: FIRNode) {
    if (node.imageData?.base64) {
      const target = node.imageData;
      const src = target.base64;
      const nodeMaxDim = computeTargetImageDimension(
        node.bounds.width,
        node.bounds.height,
        maxDimension
      );
      if (
        src.startsWith('http://') ||
        src.startsWith('https://') ||
        (src.startsWith('data:image/') &&
          (src.length > 1_000_000 ||
            (!src.startsWith('data:image/png') && !src.startsWith('data:image/jpeg'))))
      ) {
        tasks.push(
          resolveImageUrlToBase64(src, nodeMaxDim, fetchExternalImage).then((resolved) => {
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
 * Detects tiny decorative background icons (e.g. <select> dropdown arrows)
 * that would look stretched if applied as a full-frame Figma ImagePaint.
 */
export function isSmallBackgroundIcon(
  tagName: string,
  backgroundSize: string,
  backgroundRepeat: string,
  elementWidth: number
): boolean {
  if (tagName === 'SELECT') return true;
  if (backgroundRepeat === 'no-repeat' && backgroundSize) {
    const pxMatch = backgroundSize.match(/^(\d+(?:\.\d+)?)px/);
    if (pxMatch) {
      const bgW = parseFloat(pxMatch[1]);
      if (bgW > 0 && bgW <= 32 && elementWidth >= bgW * 3) {
        return true;
      }
    }
  }
  return false;
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
    const rect = typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : { width: 0 };
    if (
      isSmallBackgroundIcon(
        tagName,
        computed.backgroundSize || '',
        computed.backgroundRepeat || '',
        rect.width
      )
    ) {
      return undefined;
    }
    const scaleMode = mapObjectFitToScaleMode(computed.backgroundSize);
    return {
      base64: bgUrl,
      scaleMode,
    };
  }

  return undefined;
}
