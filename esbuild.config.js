const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

async function copyUiHtml() {
  const srcUi = path.join(__dirname, 'src/plugin/ui.html');
  const distDir = path.join(__dirname, 'dist');
  const distUi = path.join(distDir, 'ui.html');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  if (fs.existsSync(srcUi)) {
    fs.copyFileSync(srcUi, distUi);
    console.log('[esbuild] Copied ui.html -> dist/ui.html');
  }
}

async function run() {
  await copyUiHtml();

  const pluginConfig = {
    entryPoints: ['src/plugin/code.ts'],
    bundle: true,
    outfile: 'dist/code.js',
    target: 'es2020',
    logLevel: 'info',
  };

  const extractorConfig = {
    entryPoints: ['src/extractor/index.ts'],
    bundle: true,
    outfile: 'dist/extractor.js',
    format: 'iife',
    globalName: 'maxim4design',
    target: 'es2020',
    logLevel: 'info',
  };

  if (isWatch) {
    const pluginCtx = await esbuild.context(pluginConfig);
    const extractorCtx = await esbuild.context(extractorConfig);
    await Promise.all([pluginCtx.watch(), extractorCtx.watch()]);
    console.log('[esbuild] Watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(pluginConfig),
      esbuild.build(extractorConfig),
    ]);
    console.log('[esbuild] Build complete.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
