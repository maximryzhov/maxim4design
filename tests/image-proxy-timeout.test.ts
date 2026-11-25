import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveImageUrlToBase64,
  IMAGE_PROXY_TIMEOUT_MS,
  IMAGE_PROXY_RETRIES,
} from '../src/extractor/image-loader.ts';

test('local image proxy timeout is long enough for cold remote fetches', () => {
  assert.ok(IMAGE_PROXY_TIMEOUT_MS >= 10000);
  assert.equal(IMAGE_PROXY_RETRIES, 2);
});

test('resolveImageUrlToBase64 retries the local proxy and returns base64', async () => {
  const calls: string[] = [];
  let proxyAttempts = 0;

  (globalThis as any).fetch = async (url: string) => {
    calls.push(String(url));
    proxyAttempts += 1;
    if (proxyAttempts === 1) {
      throw new Error('transient proxy abort');
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ dataUrl: 'data:image/png;base64,AAAA' }),
    };
  };

  const result = await resolveImageUrlToBase64('https://example.com/photo.jpg', 2048);

  assert.equal(result, 'data:image/png;base64,AAAA');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => url.startsWith('http://localhost:8765/proxy-image?url=')));

  delete (globalThis as any).fetch;
});

test('resolveImageUrlToBase64 returns undefined after all proxy retries fail', async () => {
  let calls = 0;
  (globalThis as any).fetch = async () => {
    calls += 1;
    throw new Error('proxy unavailable');
  };

  const result = await resolveImageUrlToBase64('https://example.com/missing.jpg', 2048);

  assert.equal(result, undefined);
  assert.equal(calls, IMAGE_PROXY_RETRIES);

  delete (globalThis as any).fetch;
});
