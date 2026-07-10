// tests/routes.test.js v2 - universal
'use strict';
const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { encodeConfig } = require('../src/config');

const TEST_CONFIG_UNIVERSAL = {
  shows: [
    { id: 'tt0898266', name: 'The Big Bang Theory' },
    { id: 'tt0386676', name: 'The Office' },
  ],
  topPercent: 100,
};

const TEST_CONFIG_WITH_AIO = {
  aio: 'http://localhost:9999',
  shows: [
    { id: 'tt0898266', name: 'The Big Bang Theory' },
    { id: 'tt0386676', name: 'The Office' },
  ],
  topPercent: 20,
};

const configUniversal = encodeConfig(TEST_CONFIG_UNIVERSAL);
const configAio = encodeConfig(TEST_CONFIG_WITH_AIO);
const PORT = 3100 + Math.floor(Math.random() * 900);
let server;

before(async () => {
  const app = require('../src/index');
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });
});

after(() => {
  if (server) server.close();
});

describe('catalog route universal', () => {
  it('returns one tile per show (series type)', async () => {
    const url = `http://localhost:${PORT}/${configUniversal}/catalog/series/shuffle_series.json`;
    const res = await fetch(url);
    const data = await res.json();

    assert.equal(data.metas.length, 2);
    assert.equal(data.metas[0].id, 'shuffle:tt0898266');
    assert.equal(data.metas[0].name, 'The Big Bang Theory');
    assert.equal(data.metas[0].type, 'series');
    assert.ok(data.metas[0].poster.includes('tt0898266'));
  });

  it('works for movie catalog alias too', async () => {
    const url = `http://localhost:${PORT}/${configUniversal}/catalog/movie/shuffle_movie.json`;
    const res = await fetch(url);
    assert.equal(res.status, 200);
  });
});

describe('manifest route', () => {
  it('returns valid universal manifest', async () => {
    const url = `http://localhost:${PORT}/${configUniversal}/manifest.json`;
    const res = await fetch(url);
    const data = await res.json();

    assert.equal(data.id, 'org.stremio.sitcomshuffle.surprise');
    const resourceNames = data.resources.map(r => typeof r === 'string' ? r : r.name);
    assert.ok(resourceNames.includes('catalog'));
    assert.ok(resourceNames.includes('meta'));
    assert.ok(data.types.includes('series'));
    assert.ok(data.catalogs.some(c => c.type === 'series' && c.id === 'shuffle_series'));
    assert.ok(data.description.includes('100%'));
  });

  it('handles catalog with extra args like skip/search (Stremio Web)', async () => {
    const base = `http://localhost:${PORT}/${configUniversal}`;
    const res1 = await fetch(`${base}/catalog/series/shuffle_series/skip=0.json`);
    assert.equal(res1.status, 200);
    const d1 = await res1.json();
    assert.equal(d1.metas.length, 2);

    const res2 = await fetch(`${base}/catalog/series/shuffle_series/search=Big.json`);
    assert.equal(res2.status, 200);
    const d2 = await res2.json();
    assert.equal(d2.metas.length, 1);
  });

  it('with AIO advertises stream resources', async () => {
    const url = `http://localhost:${PORT}/${configAio}/manifest.json`;
    const data = await (await fetch(url)).json();
    const names = data.resources.map(r => typeof r === 'string' ? r : r.name);
    assert.ok(names.includes('stream'));
  });
});
