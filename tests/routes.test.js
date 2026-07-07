// tests/routes.test.js
'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { encodeConfig } = require('../src/config');

const TEST_CONFIG = {
  aio: 'http://localhost:9999',
  shows: [
    { id: 'tt0898266', name: 'The Big Bang Theory' },
    { id: 'tt0386676', name: 'The Office' },
  ],
};

const configStr = encodeConfig(TEST_CONFIG);

describe('catalog route', () => {
  it('returns metas for configured shows', async () => {
    const url = `http://localhost:3000/${configStr}/catalog/movie/sitcom_shuffle_catalog.json`;
    const res = await fetch(url);
    const data = await res.json();

    assert.equal(data.metas.length, 2);
    assert.equal(data.metas[0].id, 'shuffle:tt0898266');
    assert.equal(data.metas[0].name, 'The Big Bang Theory (Shuffle)');
    assert.equal(data.metas[0].type, 'movie');
    assert.ok(data.metas[0].poster.includes('tt0898266'));
  });
});

describe('manifest route', () => {
  it('returns valid stremio manifest', async () => {
    const url = `http://localhost:3000/${configStr}/manifest.json`;
    const res = await fetch(url);
    const data = await res.json();

    assert.equal(data.id, 'org.stremio.sitcomshuffle');
    assert.ok(data.resources.includes('catalog'));
    assert.ok(data.resources.includes('stream'));
    assert.equal(data.types[0], 'movie');
  });
});
