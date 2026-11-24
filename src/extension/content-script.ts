import { extractFIRFromElementAsync } from '../extractor/dom-extractor.ts';

declare const chrome: any;

function showToast(message: string, isError = false) {
  const existing = document.getElementById('maxim4design-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'maxim4design-toast';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = isError ? '#ef4444' : '#18a0fb';
  toast.style.color = '#ffffff';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
  toast.style.fontFamily = 'Inter, -apple-system, sans-serif';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '600';
  toast.style.zIndex = '2147483647';
  toast.style.pointerEvents = 'none';
  toast.style.transition = 'opacity 0.3s ease';

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

async function trySendToLocalBridge(data: unknown): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const resp = await fetch('http://localhost:8765/fir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

async function copyToClipboard(data: unknown): Promise<void> {
  const jsonStr = JSON.stringify(data, null, 2);
  try {
    await navigator.clipboard.writeText(jsonStr);
  } catch {
    // Fallback using textarea
    const textarea = document.createElement('textarea');
    textarea.value = jsonStr;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function startElementInspector() {
  let hoveredElement: HTMLElement | null = null;
  let prevOutline = '';
  let prevCursor = '';

  function onMouseOver(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target || target.id === 'maxim4design-toast') return;

    if (hoveredElement && hoveredElement !== target) {
      hoveredElement.style.outline = prevOutline;
      hoveredElement.style.cursor = prevCursor;
    }

    hoveredElement = target;
    prevOutline = target.style.outline;
    prevCursor = target.style.cursor;

    target.style.outline = '2px dashed #18a0fb';
    target.style.cursor = 'crosshair';
  }

  async function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    cleanup();

    const target = e.target as HTMLElement;
    if (!target) return;

    try {
      const fir = await extractFIRFromElementAsync(target);
      const sentViaBridge = await trySendToLocalBridge(fir);
      if (sentViaBridge) {
        showToast(`Элемент <${target.tagName.toLowerCase()}> отправлен напрямую в Figma!`);
      } else {
        await copyToClipboard(fir);
        showToast(`Элемент <${target.tagName.toLowerCase()}> скопирован в буфер! Вставьте в Figma.`);
      }
    } catch (err: any) {
      showToast('Ошибка экстракции элемента: ' + err?.message, true);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cleanup();
      showToast('Выбор элемента отменен.');
    }
  }

  function cleanup() {
    if (hoveredElement) {
      hoveredElement.style.outline = prevOutline;
      hoveredElement.style.cursor = prevCursor;
    }
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  showToast('Режим инспектора активен: наведите и кликните на нужный блок (Esc — отмена)');
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: (resp: any) => void) => {
    if (request.action === 'CAPTURE_PAGE') {
      (async () => {
        try {
          const root = document.body || document.documentElement;
          const fir = await extractFIRFromElementAsync(root, 2048, { warmupScroll: true });
          const sentViaBridge = await trySendToLocalBridge(fir);
          if (sentViaBridge) {
            showToast('Страница отправлена напрямую в Figma!');
            sendResponse({ success: true, message: 'Отправлено в Figma через локальный мост!' });
          } else {
            await copyToClipboard(fir);
            showToast('Вся страница скопирована в буфер! Вставьте в плагин Figma.');
            sendResponse({ success: true, message: 'Страница скопирована!' });
          }
        } catch (err: any) {
          showToast('Ошибка экстракции: ' + err?.message, true);
          sendResponse({ success: false, message: err?.message });
        }
      })();
      return true;
    }

    if (request.action === 'START_INSPECTOR') {
      startElementInspector();
      sendResponse({ success: true, message: 'Инспектор запущен' });
      return true;
    }
  });
}
