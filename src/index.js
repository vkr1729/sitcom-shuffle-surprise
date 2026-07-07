// src/index.js
'use strict';
const express = require('express');
const path = require('path');
const { decodeConfig } = require('./config');

const app = express();

// CORS headers required by Stremio
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Serve configurator page
app.use('/configure', express.static(path.join(__dirname, '..', 'public')));

// Redirect root to configurator
app.get('/', (req, res) => {
  res.redirect('/configure');
});

// Config-decoding middleware for all /:config/* routes
app.param('config', (req, res, next, configParam) => {
  try {
    req.addonConfig = decodeConfig(configParam);
    next();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Manifest
app.get('/:config/manifest.json', (req, res) => {
  res.json({
    id: 'org.stremio.sitcomshuffle',
    name: 'Sitcom Shuffle',
    version: '1.0.0',
    description: 'One-click random top-rated episode of your favorite sitcoms.',
    logo: 'https://images.metahub.space/logo/medium/tt0898266/img.png',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    catalogs: [
      {
        type: 'movie',
        id: 'sitcom_shuffle_catalog',
        name: 'Sitcom Shuffle',
      },
    ],
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sitcom Shuffle addon running at http://localhost:${PORT}`);
});

module.exports = app;
