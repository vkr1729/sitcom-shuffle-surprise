// src/config.js
'use strict';

function encodeConfig(config) {
  return Buffer.from(JSON.stringify(config)).toString('base64url');
}

function decodeConfig(base64String) {
  try {
    const json = Buffer.from(base64String, 'base64url').toString('utf-8');
    const config = JSON.parse(json);

    if (!Array.isArray(config.shows)) {
      throw new Error('Invalid config: missing "shows" array');
    }
    if (config.shows.length === 0) {
      throw new Error('Invalid config: at least 1 show required');
    }

    // Normalize and validate shows
    config.shows = config.shows
      .filter(s => s && typeof s.id === 'string' && s.id.match(/^tt\d+$/))
      .map(s => ({ id: s.id, name: (s.name || s.id).toString().slice(0, 100) }));

    if (config.shows.length === 0) {
      throw new Error('Invalid config: no valid shows');
    }

    // topPercent: if not populated include all 100% (per user request)
    // Default 20% only when explicitly configured via UI, but per latest spec:
    // - empty/null/undefined => 100%
    // - 0 or invalid => 20%? Actually per spec: not populated => 100%
    let topPercent = config.topPercent;
    if (topPercent == null || topPercent === '') {
      topPercent = 100; // include all
    } else {
      topPercent = Math.round(Number(topPercent));
      if (!Number.isFinite(topPercent) || topPercent < 1) topPercent = 20;
      if (topPercent > 100) topPercent = 100;
    }
    config.topPercent = topPercent;

    // aio is now OPTIONAL for universal mode
    // If present, must be valid URL string
    if (config.aio != null && config.aio !== '') {
      try {
        const u = new URL(config.aio);
        if (!u.protocol.startsWith('http')) throw new Error('must be http(s)');
        // strip /manifest.json
        config.aio = config.aio.replace(/\/manifest\.json\s*$/i, '').trim();
      } catch {
        throw new Error('Invalid config: aio must be a valid URL or omitted');
      }
    } else {
      config.aio = null; // universal mode
    }

    return config;
  } catch (err) {
    if (err.message.startsWith('Invalid config')) throw err;
    throw new Error(`Failed to decode config: ${err.message}`);
  }
}

module.exports = { encodeConfig, decodeConfig };
