// Figma plugin entry point (runs in isolated Figma sandbox)
import { isFIRNode, validateFIRTree } from '../types/fir';

figma.showUI(__html__, { width: 440, height: 580 });

interface PluginIncomingMessage {
  type: string;
  payload?: unknown;
}

figma.ui.onmessage = async (msg: PluginIncomingMessage) => {
  console.log('[maxim4design] Message received:', msg.type);

  if (msg.type === 'IMPORT_FIR') {
    const data = msg.payload;

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

    console.log('[maxim4design] FIR is valid, ready for node generation:', data);
    figma.ui.postMessage({
      type: 'STATUS',
      message: 'FIR дерево успешно проверено песочницей плагина',
      status: 'info',
    });
  } else if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
