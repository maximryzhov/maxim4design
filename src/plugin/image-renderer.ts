import type { FIRNode, FIRBounds, FIRImageData } from '../types/fir.ts';
import { applyStyles } from './style-applier.ts';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

/**
 * Pure TypeScript Base64 to Uint8Array decoder (works in isolated Figma sandbox).
 */
export function base64ToUint8Array(base64Str: string): Uint8Array {
  // Strip data URL prefix if present (e.g. data:image/png;base64,...)
  const cleanStr = base64Str.replace(/^data:image\/[a-z0-9+.-]+;base64,/i, '').replace(/\s/g, '');

  let bufferLength = Math.floor((cleanStr.length * 3) / 4);
  if (cleanStr.endsWith('==')) bufferLength -= 2;
  else if (cleanStr.endsWith('=')) bufferLength -= 1;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;

  for (let i = 0; i < cleanStr.length; i += 4) {
    const enc1 = B64_CHARS.indexOf(cleanStr[i]);
    const enc2 = B64_CHARS.indexOf(cleanStr[i + 1]);
    const enc3 = B64_CHARS.indexOf(cleanStr[i + 2]);
    const enc4 = B64_CHARS.indexOf(cleanStr[i + 3]);

    if (enc1 === -1 || enc2 === -1) break;

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes[p++] = chr1;
    if (enc3 !== 64 && enc3 !== -1 && p < bufferLength) {
      bytes[p++] = chr2;
    }
    if (enc4 !== 64 && enc4 !== -1 && p < bufferLength) {
      bytes[p++] = chr3;
    }
  }

  return bytes;
}

/**
 * Creates a Figma ImagePaint from FIRImageData.
 */
export async function createImagePaint(
  imageData?: FIRImageData
): Promise<ImagePaint | null> {
  if (!imageData || !imageData.base64 || imageData.base64.trim() === '') {
    return null;
  }

  try {
    const bytes = base64ToUint8Array(imageData.base64);
    if (bytes.length === 0) {
      return null;
    }

    const image = figma.createImage(bytes);
    return {
      type: 'IMAGE',
      imageHash: image.hash,
      scaleMode: imageData.scaleMode,
    };
  } catch (err) {
    console.warn('[ImageRenderer] Failed to create image in Figma:', err);
    return null;
  }
}

/**
 * Renders an IMAGE FIRNode into a native Figma RectangleNode with ImagePaint fill.
 * If image decoding fails, creates a safe placeholder with border.
 */
export async function renderImageNode(
  node: FIRNode,
  parentFrame?: FrameNode,
  parentBounds?: FIRBounds
): Promise<SceneNode> {
  const relX = parentBounds ? node.bounds.x - parentBounds.x : node.bounds.x;
  const relY = parentBounds ? node.bounds.y - parentBounds.y : node.bounds.y;
  const width = Math.max(1, node.bounds.width);
  const height = Math.max(1, node.bounds.height);

  const rect = figma.createRectangle();
  rect.name = node.name || 'Image';
  rect.x = relX;
  rect.y = relY;
  rect.resize(width, height);
  rect.opacity = node.opacity;
  rect.visible = node.visible;

  // Apply corner radius, border styles, etc.
  applyStyles(rect, node.style, node.clipsContent);

  const imagePaint = await createImagePaint(node.imageData);

  if (imagePaint) {
    rect.fills = [imagePaint];
  } else {
    // Safe placeholder if image failed to load or CORS blocked
    rect.name = `${node.name || 'Image'} (Placeholder)`;
    rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.92, b: 0.94 }, opacity: 1 }];
    rect.strokes = [{ type: 'SOLID', color: { r: 0.75, g: 0.78, b: 0.82 }, opacity: 1 }];
  }

  return rect;
}
