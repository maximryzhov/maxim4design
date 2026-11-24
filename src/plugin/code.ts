// Figma plugin entry point (runs in isolated Figma sandbox)

figma.showUI(__html__, { width: 420, height: 560 });

figma.ui.onmessage = async (msg: { type: string; payload?: unknown }) => {
  console.log('[maxim4design] Message received:', msg.type);

  if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
