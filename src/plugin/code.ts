// Figma plugin entry point (runs in isolated Figma sandbox)
import { isFIRNode, validateFIRTree, type FIRNode } from '../types/fir.ts';
import { renderFIRNode, safeLoadFont } from './node-factory.ts';

figma.showUI(__html__, { width: 440, height: 580 });

interface PluginIncomingMessage {
  type: string;
  payload?: unknown;
}

figma.ui.onmessage = async (msg: PluginIncomingMessage) => {
  console.log('[maxim4design] Message received:', msg.type);

  if (msg.type === 'IMPORT_FIR') {
    const data = msg.payload as FIRNode;

    if (!data) {
      figma.ui.postMessage({
        type: 'ERROR',
        message: 'Получены пустые данные FIR',
      });
      return;
    }

    const validation = validateFIRTree(data);
    if (!validation.valid) {
      console.warn('[maxim4design] Validation errors:', validation.errors);
      figma.ui.postMessage({
        type: 'ERROR',
        message: `Невалидная структура FIR: ${validation.errors[0]}`,
      });
      return;
    }

    figma.ui.postMessage({
      type: 'STATUS',
      message: 'Загрузка шрифтов и генерация слоев...',
      status: 'info',
    });

    try {
      // Preload baseline fonts
      await safeLoadFont('Inter', 'Regular');
      await safeLoadFont('Inter', 'Bold');

      // Render root node and all children
      const rootNode = await renderFIRNode(data);

      figma.currentPage.appendChild(rootNode);
      figma.currentPage.selection = [rootNode];
      figma.viewport.scrollAndZoomIntoView([rootNode]);

      figma.ui.postMessage({
        type: 'SUCCESS',
        message: `Элемент "${rootNode.name}" успешно импортирован на холст!`,
      });
    } catch (err) {
      console.error('[maxim4design] Rendering error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({
        type: 'ERROR',
        message: `Ошибка рендеринга слоев: ${errMsg}`,
      });
    }
  } else if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
