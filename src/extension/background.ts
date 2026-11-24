// Chrome Extension Manifest V3 Background Service Worker
// Proxies cross-origin image fetches to bypass page CORS restrictions.

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

const chromeApi = (globalThis as any).chrome;

if (chromeApi?.runtime?.onMessage) {
  chromeApi.runtime.onMessage.addListener(
    (request: any, _sender: any, sendResponse: (resp: any) => void) => {
      if (request?.type === 'FETCH_IMAGE_BASE64' && typeof request.url === 'string') {
        (async () => {
          try {
            const resp = await fetch(request.url);
            if (!resp.ok) {
              sendResponse({ ok: false, error: `HTTP ${resp.status}` });
              return;
            }
            const contentType = resp.headers.get('content-type') || 'image/png';
            const mime = contentType.split(';')[0].trim() || 'image/png';
            const buffer = await resp.arrayBuffer();
            const b64 = arrayBufferToBase64(buffer);
            sendResponse({ ok: true, dataUrl: `data:${mime};base64,${b64}` });
          } catch (err: any) {
            sendResponse({ ok: false, error: err?.message || String(err) });
          }
        })();
        return true; // Keep message channel open for async response
      }
      return false;
    }
  );
}
