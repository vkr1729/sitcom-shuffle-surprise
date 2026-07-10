// tests/config.test.js v2
'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { encodeConfig, decodeConfig } = require('../src/config');

describe('config', () => {
  const sampleConfig = {
    aio: 'https://aiostreams.elfhosted.com/abc123',
    shows: [
      { id: 'tt0898266', name: 'The Big Bang Theory' },
      { id: 'tt0386676', name: 'The Office' },
    ],
    topPercent: 20,
  };

  it('round-trips encode → decode', () => {
    const encoded = encodeConfig(sampleConfig);
    const decoded = decodeConfig(encoded);
    assert.deepStrictEqual(decoded, sampleConfig);
  });

  it('round-trips universal mode (no aio, 100%)', () => {
    const cfg = {
      shows: [{ id: 'tt0898266', name: 'BBT' }],
    };
    const encoded = encodeConfig(cfg);
    const decoded = decodeConfig(encoded);
    assert.equal(decoded.aio, null);
    assert.equal(decoded.topPercent, 100); // not populated => 100%
    assert.equal(decoded.shows.length, 1);
  });

  it('defaults to 100% when topPercent missing', () => {
    const bad = Buffer.from(JSON.stringify({ shows: [{ id: 'tt0898266', name: 'BBT' }] })).toString('base64url');
    const decoded = decodeConfig(bad);
    assert.equal(decoded.topPercent, 100);
  });

  it('throws on invalid base64', () => {
    assert.throws(() => decodeConfig('not-valid!!!'), /Failed to decode config/);
  });

  it('throws on missing shows field', () => {
    const bad = Buffer.from(JSON.stringify({ aio: 'x' })).toString('base64url');
    assert.throws(() => decodeConfig(bad), /shows/);
  });

  it('throws on empty shows', () => {
    const bad = Buffer.from(JSON.stringify({ shows: [] })).toString('base64url');
    assert.throws(() => decodeConfig(bad), /at least 1 show/);
  });

  it('normalizes topPercent range', () => {
    const mk = (tp) => {
      const s = Buffer.from(JSON.stringify({ shows: [{ id: 'tt0898266' }], topPercent: tp })).toString('base64url');
      return decodeConfig(s).topPercent;
    };
    assert.equal(mk(20), 20);
    assert.equal(mk(100), 100);
    assert.equal(mk(200), 100);
    assert.equal(mk(null), 100);
    assert.equal(mk(undefined), 100);
    assert.equal(mk(''), 100);
  });
});
