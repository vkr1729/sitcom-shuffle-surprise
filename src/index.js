// src/index.js
'use strict';
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { decodeConfig } = require('./config');
const { pickRandomEpisode } = require('./tvmaze');

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

// Catalog handler
app.get('/:config/catalog/movie/sitcom_shuffle_catalog.json', (req, res) => {
  const { shows } = req.addonConfig;
  const metas = shows.map((show) => ({
    id: `shuffle:${show.id}`,
    type: 'movie',
    name: `${show.name} (Shuffle)`,
    poster: `https://images.metahub.space/poster/medium/${show.id}/img`,
  }));
  res.json({ metas });
});

// Stream handler
app.get('/:config/stream/movie/:id.json', async (req, res) => {
  try {
    const { aio } = req.addonConfig;
    const rawId = req.params.id;

    // Extract IMDb ID from "shuffle:ttXXXXXXX"
    if (!rawId.startsWith('shuffle:')) {
      return res.json({ streams: [] });
    }
    const imdbId = rawId.replace('shuffle:', '');

    // Pick a random top-rated episode
    const episode = await pickRandomEpisode(imdbId);
    const s = episode.season;
    const e = episode.number;
    const epLabel = `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;

    // Query AIOStreams for that specific episode
    const aioUrl = `${aio}/stream/series/${imdbId}:${s}:${e}.json`;
    const aioRes = await fetch(aioUrl);

    if (!aioRes.ok) {
      console.error(`AIOStreams returned ${aioRes.status} for ${aioUrl}`);
      return res.json({
        streams: [
          {
            name: `[Shuffle] ${epLabel}`,
            title: `${episode.name} (★${episode.rating})\nNo streams found — try again`,
            externalUrl: `https://www.imdb.com/title/${imdbId}/`,
          },
        ],
      });
    }

    const aioData = await aioRes.json();
    const streams = (aioData.streams || []).map((stream) => ({
      ...stream,
      name: `[Shuffle] ${epLabel} | ${stream.name || ''}`,
      title: `${episode.name} (★${episode.rating})\n${stream.title || ''}`,
    }));

    // cacheMaxAge: 0 ensures Stremio re-randomizes on every click
    res.json({ streams, cacheMaxAge: 0 });
  } catch (err) {
    console.error('Stream handler error:', err.message);
    res.json({ streams: [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sitcom Shuffle addon running at http://localhost:${PORT}`);
});

module.exports = app;
