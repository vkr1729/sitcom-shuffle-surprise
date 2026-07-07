// tests/config.test.js
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
  };

  it('round-trips encode → decode', () => {
    const encoded = encodeConfig(sampleConfig);
    const decoded = decodeConfig(encoded);
    assert.deepStrictEqual(decoded, sampleConfig);
  });

  it('throws on invalid base64', () => {
    assert.throws(() => decodeConfig('not-valid!!!'), /Failed to decode config/);
  });

  it('throws on missing aio field', () => {
    const bad = Buffer.from(JSON.stringify({ shows: [] })).toString('base64url');
    assert.throws(() => decodeConfig(bad), /missing "aio"/);
  });

  it('throws on missing shows field', () => {
    const bad = Buffer.from(JSON.stringify({ aio: 'x' })).toString('base64url');
    assert.throws(() => decodeConfig(bad), /missing "aio" or "shows"/);
  });
});
