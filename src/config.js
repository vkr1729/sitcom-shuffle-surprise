// src/config.js
'use strict';

function encodeConfig(config) {
  return Buffer.from(JSON.stringify(config)).toString('base64url');
}

function decodeConfig(base64String) {
  try {
    const json = Buffer.from(base64String, 'base64url').toString('utf-8');
    const config = JSON.parse(json);
    if (!config.aio || !Array.isArray(config.shows)) {
      throw new Error('Invalid config: missing "aio" or "shows"');
    }
    return config;
  } catch (err) {
    throw new Error(`Failed to decode config: ${err.message}`);
  }
}

module.exports = { encodeConfig, decodeConfig };
