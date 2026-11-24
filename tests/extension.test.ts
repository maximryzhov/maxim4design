import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Extension manifest is valid Manifest V3', () => {
  const manifestPath = path.resolve('src/extension/manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');

  const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(content.manifest_version, 3);
  assert.equal(content.name, 'maxim4design — HTML to Figma Capture');
  assert.ok(content.permissions.includes('activeTab'));
  assert.ok(content.permissions.includes('scripting'));
  assert.equal(content.action.default_popup, 'popup.html');
});

test('Bookmarklet syntax is valid', () => {
  const bookmarkletPath = path.resolve('dist/bookmarklet.js');
  if (fs.existsSync(bookmarkletPath)) {
    const code = fs.readFileSync(bookmarkletPath, 'utf8');
    assert.ok(code.startsWith('javascript:(function(){'));
    assert.ok(code.endsWith('})();'));
    assert.ok(code.includes('extractFIRFromElement'));
  }
});
