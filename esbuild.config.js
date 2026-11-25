const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

async function copyStaticFiles() {
  const distDir = path.join(__dirname, 'dist');
  const extDistDir = path.join(distDir, 'extension');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  if (!fs.existsSync(extDistDir)) {
    fs.mkdirSync(extDistDir, { recursive: true });
  }

  // Copy ui.html
  const srcUi = path.join(__dirname, 'src/plugin/ui.html');
  const distUi = path.join(distDir, 'ui.html');
  if (fs.existsSync(srcUi)) {
    fs.copyFileSync(srcUi, distUi);
    console.log('[esbuild] Copied ui.html -> dist/ui.html');
  }

  // Copy extension static files
  const extManifest = path.join(__dirname, 'src/extension/manifest.json');
  const distExtManifest = path.join(extDistDir, 'manifest.json');
  if (fs.existsSync(extManifest)) {
    fs.copyFileSync(extManifest, distExtManifest);
  }

  const extPopup = path.join(__dirname, 'src/extension/popup.html');
  const distExtPopup = path.join(extDistDir, 'popup.html');
  if (fs.existsSync(extPopup)) {
    fs.copyFileSync(extPopup, distExtPopup);
  }
}

async function generateBookmarklet() {
  const bookmarkletFile = path.join(__dirname, 'dist/bookmarklet.js');

  // A bookmarklet is a `javascript:` URL: the browser strips every newline from it
  // before execution, so a multi-line bundle with `//` comments silently comments out
  // the rest of the script. Build a minified, single-line copy instead.
  const result = await esbuild.build({
    entryPoints: ['src/extractor/index.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'maxim4design',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    // Lower template literals so `\n` inside text becomes an escape sequence:
    // the browser removes raw newlines from a `javascript:` URL, which would
    // silently drop line breaks baked into the bundle.
    supported: { 'template-literal': false },
    write: false,
    logLevel: 'silent',
  });

  const code = result.outputFiles[0].text.trim();
  if (code.includes('\n')) {
    throw new Error('Bookmarklet bundle must be a single line');
  }

  const source = `(function(){${code};try{const fir=maxim4design.extractFIRFromElement(document.body);navigator.clipboard.writeText(JSON.stringify(fir,null,2));alert('maxim4design: Страница скопирована в буфер обмена!');}catch(e){alert('Ошибка: '+e.message);}})();`;

  // Percent-encode the script: raw `#` inside a `javascript:` URL starts a fragment
  // and would truncate the code (CSS selectors, hex colors, SVG), while `%` keeps the
  // payload ASCII-safe. Browsers decode the path before executing it.
  const bookmarkletCode = `javascript:${encodeURIComponent(source)}`;
  fs.writeFileSync(bookmarkletFile, bookmarkletCode, 'utf8');
  console.log('[esbuild] Generated dist/bookmarklet.js (single line, minified, URL-encoded)');
}

async function run() {
  await copyStaticFiles();

  const configs = [
    // 1. Figma Plugin sandbox code
    {
      entryPoints: ['src/plugin/code.ts'],
      bundle: true,
      outfile: 'dist/code.js',
      target: 'es2020',
      logLevel: 'info',
    },
    // 2. DOM Extractor standalone library
    {
      entryPoints: ['src/extractor/index.ts'],
      bundle: true,
      outfile: 'dist/extractor.js',
      format: 'iife',
      globalName: 'maxim4design',
      target: 'es2020',
      logLevel: 'info',
    },
    // 3. Extension Content Script
    {
      entryPoints: ['src/extension/content-script.ts'],
      bundle: true,
      outfile: 'dist/extension/content-script.js',
      target: 'es2020',
      logLevel: 'info',
    },
    // 4. Extension Popup script
    {
      entryPoints: ['src/extension/popup.ts'],
      bundle: true,
      outfile: 'dist/extension/popup.js',
      target: 'es2020',
      logLevel: 'info',
    },
    // 5. Extension Background Service Worker
    {
      entryPoints: ['src/extension/background.ts'],
      bundle: true,
      outfile: 'dist/extension/background.js',
      target: 'es2020',
      logLevel: 'info',
    },
  ];

  if (isWatch) {
    const contexts = await Promise.all(configs.map((c) => esbuild.context(c)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('[esbuild] Watching for changes...');
  } else {
    await Promise.all(configs.map((c) => esbuild.build(c)));
    await generateBookmarklet();
    console.log('[esbuild] Build complete.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
