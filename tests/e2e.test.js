// tests/e2e.test.js
'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { encodeConfig } = require('../src/config');

const TEST_CONFIG = {
  aio: 'https://aiostreams.elfhosted.com/test',
  shows: [{ id: 'tt0898266', name: 'The Big Bang Theory' }],
};
const configStr = encodeConfig(TEST_CONFIG);
const BASE = 'http://localhost:3000';

describe('e2e: full addon flow', () => {
  it('manifest → catalog → meta → stream (live TVmaze)', async () => {
    // 1. Manifest
    const manifest = await (await fetch(`${BASE}/${configStr}/manifest.json`)).json();
    assert.equal(manifest.id, 'org.stremio.sitcomshuffle');
    assert.ok(manifest.resources.includes('stream'));
    assert.ok(manifest.resources.includes('meta'));

    // 2. Catalog
    const catalog = await (await fetch(`${BASE}/${configStr}/catalog/movie/sitcom_shuffle_catalog.json`)).json();
    assert.equal(catalog.metas.length, 1);
    assert.equal(catalog.metas[0].id, 'shuffle:tt0898266');

    // 3. Meta
    const meta = await (await fetch(`${BASE}/${configStr}/meta/movie/shuffle:tt0898266.json`)).json();
    assert.ok(meta.meta.name.includes('Big Bang'));

    // 4. Stream (will fail to reach AIOStreams test URL but should not crash)
    const stream = await (await fetch(`${BASE}/${configStr}/stream/movie/shuffle:tt0898266.json`)).json();
    // Should either return streams or an empty array — never crash
    assert.ok(Array.isArray(stream.streams));
  });
});
