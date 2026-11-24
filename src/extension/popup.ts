declare const chrome: any;

const capturePageBtn = document.getElementById('capturePageBtn') as HTMLButtonElement;
const inspectElementBtn = document.getElementById('inspectElementBtn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

function showStatus(text: string, type: 'success' | 'info') {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`;
}

async function sendTabMessage(action: string) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showStatus('Не удалось найти активную вкладку', 'info');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action }, (response: any) => {
      if (chrome.runtime.lastError) {
        showStatus('Перезагрузите страницу для активации расширения', 'info');
        return;
      }
      if (response?.success) {
        showStatus(response.message || 'Скопировано в буфер обмена!', 'success');
      }
    });
  } catch (err: any) {
    showStatus(err?.message || 'Ошибка выполнения', 'info');
  }
}

capturePageBtn.addEventListener('click', () => {
  showStatus('Экстракция страницы...', 'info');
  sendTabMessage('CAPTURE_PAGE');
});

inspectElementBtn.addEventListener('click', () => {
  showStatus('Кликните на элемент на странице...', 'info');
  sendTabMessage('START_INSPECTOR');
  window.close(); // Close popup so user can click on the page
});
