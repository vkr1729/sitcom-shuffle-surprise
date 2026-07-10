// tests/e2e.test.js v2
'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { encodeConfig } = require('../src/config');

const BASE = 'http://localhost:3000';

describe('e2e: universal flow (no AIO, 100%)', () => {
  const cfg = { shows: [{ id: 'tt0898266', name: 'The Big Bang Theory' }] };
  const configStr = encodeConfig(cfg);

  it('manifest → catalog → meta (random) — universal', async () => {
    const manifest = await (await fetch(`${BASE}/${configStr}/manifest.json`)).json();
    assert.equal(manifest.id, 'org.stremio.sitcomshuffle.surprise');
    const rNames = manifest.resources.map(r => typeof r === 'string' ? r : r.name);
    assert.ok(rNames.includes('meta'));

    const catalog = await (await fetch(`${BASE}/${configStr}/catalog/series/shuffle_series.json`)).json();
    assert.equal(catalog.metas.length, 1);
    assert.equal(catalog.metas[0].id, 'shuffle:tt0898266');
    assert.equal(catalog.metas[0].type, 'series');

    // Meta should return 1 random video with defaultVideoId
    const meta1 = await (await fetch(`${BASE}/${configStr}/meta/series/shuffle:tt0898266.json`)).json();
    assert.ok(meta1.meta.name.includes('Big Bang'));
    assert.ok(Array.isArray(meta1.meta.videos));
    assert.equal(meta1.meta.videos.length, 1);
    assert.ok(meta1.meta.behaviorHints.defaultVideoId);
    assert.match(meta1.meta.videos[0].id, /^tt0898266:\d+:\d+$/);

    const meta2 = await (await fetch(`${BASE}/${configStr}/meta/series/shuffle:tt0898266.json`)).json();
    assert.ok(meta2.meta.videos[0].id.match(/^tt\d+:\d+:\d+$/));
  });
});

describe('e2e: with topPercent=20%', () => {
  const cfg = { shows: [{ id: 'tt0898266', name: 'The Big Bang Theory' }], topPercent: 20 };
  const configStr = encodeConfig(cfg);
  it('meta respects top 20% filter', async () => {
    const meta = await (await fetch(`${BASE}/${configStr}/meta/series/shuffle:tt0898266.json`)).json();
    assert.ok(meta.meta.videos[0].title.includes('★'));
    // rating should be high (>=7.5) when pool has highs
    const ratingMatch = meta.meta.videos[0].title.match(/★([\d.]+)/);
    if (ratingMatch) {
      assert.ok(parseFloat(ratingMatch[1]) >= 7.5);
    }
  });
});
