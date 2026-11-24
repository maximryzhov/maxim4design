// Figma plugin entry point (runs in isolated Figma sandbox)
import { validateFIRTree, type FIRNode } from '../types/fir.ts';
import {
  renderFIRTreeAsync,
  collectFontsFromTree,
  countFIRNodes,
  safeLoadFont,
} from './node-factory.ts';
import { fontManager, selectMissingFontAssets } from './font-manager.ts';

figma.showUI(__html__, { width: 460, height: 620 });

interface PluginIncomingMessage {
  type: string;
  payload?: unknown;
  options?: {
    useAutoLayout?: boolean;
    includeHidden?: boolean;
  };
}

figma.ui.onmessage = async (msg: PluginIncomingMessage) => {
  console.log('[maxim4design] Message received:', msg.type);

  if (msg.type === 'IMPORT_FIR') {
    const data = msg.payload as FIRNode;
    const options = {
      useAutoLayout: msg.options?.useAutoLayout ?? true,
      includeHidden: msg.options?.includeHidden ?? false,
    };

    if (!data) {
      figma.ui.postMessage({
        type: 'ERROR',
        message: 'Получены пустые данные FIR',
      });
      return;
    }

    // Step 1: Validate tree structure
    figma.ui.postMessage({
      type: 'PROGRESS',
      phase: 'validation',
      percent: 5,
      message: 'Валидация структуры FIR...',
    });

    const validation = validateFIRTree(data);
    if (!validation.valid) {
      console.warn('[maxim4design] Validation errors:', validation.errors);
      figma.ui.postMessage({
        type: 'ERROR',
        message: `Невалидная структура FIR: ${validation.errors[0]}`,
      });
      return;
    }

    const totalNodes = countFIRNodes(data, options.includeHidden);
    fontManager.clearWarnings();

    try {
      // Step 2: Preload detected fonts
      figma.ui.postMessage({
        type: 'PROGRESS',
        phase: 'fonts',
        percent: 15,
        message: 'Анализ дерева и загрузка шрифтов...',
        current: 0,
        total: totalNodes,
      });

      await fontManager.initAvailableFonts();
      const requiredFonts = collectFontsFromTree(data);
      if (requiredFonts.length > 0) {
        await fontManager.preloadFonts(requiredFonts);
      }
      await safeLoadFont('Inter', 'Regular');
      await safeLoadFont('Inter', 'Bold');

      // Step 3: Chunked async rendering
      figma.ui.postMessage({
        type: 'PROGRESS',
        phase: 'rendering',
        percent: 25,
        message: `Генерация слоев (0/${totalNodes})...`,
        current: 0,
        total: totalNodes,
      });

      const rootNode = await renderFIRTreeAsync(data, {
        useAutoLayout: options.useAutoLayout,
        includeHidden: options.includeHidden,
        chunkSize: 50,
        onProgress: (current, total, nodeName) => {
          const percent = Math.min(95, Math.round(25 + (current / Math.max(1, total)) * 70));
          figma.ui.postMessage({
            type: 'PROGRESS',
            phase: 'rendering',
            percent,
            current,
            total,
            message: `Генерация слоев (${current}/${total}): ${nodeName || 'элемент'}`,
          });
        },
      });

      figma.currentPage.appendChild(rootNode);
      figma.currentPage.selection = [rootNode];
      figma.viewport.scrollAndZoomIntoView([rootNode]);

      const warnings = fontManager.getWarnings();
      const missingFonts = selectMissingFontAssets(data.fonts, (family) =>
        fontManager.isFamilyAvailable(family)
      );

      figma.ui.postMessage({
        type: 'SUCCESS',
        message: `Макет "${rootNode.name}" (${totalNodes} слоев) успешно импортирован на холст!`,
        totalNodes,
        warnings,
        missingFonts,
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
