// src/index.js - Sitcom Shuffle: Single Click Surprise v4 - single catalog, true 1-click, no AIO
'use strict';
const express = require('express');
const path = require('path');
const { decodeConfig } = require('./config');
const { pickRandomEpisode, getTopEpisodes } = require('./tvmaze');

const app = express();

const ADDON_ID = 'org.stremio.sitcomsurprise';
const ADDON_NAME = 'Sitcom Surprise';
const ADDON_VERSION = '5.0.0';

function getLogoUrl(req) {
  if (!req) return 'https://sitcom-shuffle-surprise.vercel.app/logo.png';
  const host = req.get('host');
  if (!host) return 'https://sitcom-shuffle-surprise.vercel.app/logo.png';
  try {
    // Try to serve local logo if exists, else fallback to placeholder - user will replace with Gemini logo
    const fs = require('fs');
    const path = require('path');
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      return `https://${host}/logo.png`;
    }
  } catch {}
  return `https://${host}/logo.png`;
}

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/configure', express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => res.redirect('/configure'));

app.param('config', (req, res, next, configParam) => {
  if (configParam === 'default') {
    req.addonConfig = {
      shows: [{ id: 'tt0898266', name: 'The Big Bang Theory' }],
      topPercent: 100,
    };
    return next();
  }
  try {
    req.addonConfig = decodeConfig(configParam);
    next();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function buildManifest(cfg, req) {
  const logo = getLogoUrl(req);
  // SINGLE catalog - series only, to avoid duplicate rows
  return {
    id: ADDON_ID,
    version: ADDON_VERSION,
    name: ADDON_NAME,
    description: `One tile per show. True single click surprise — random episode from ${cfg.topPercent === 100 ? 'all episodes' : `top ${cfg.topPercent}% by rating`}. Universal, works with your existing addons.`,
    logo,
    resources: [
      'catalog',
      { name: 'meta', types: ['series'], idPrefixes: ['shuffle:'] },
      // We advertise stream for shuffle: so we can provide meta+stream flow, but we actually delegate to other addons via tt:S:E ids
      { name: 'stream', types: ['series'], idPrefixes: ['shuffle:', 'tt'] },
    ],
    types: ['series'],
    idPrefixes: ['shuffle:'],
    catalogs: [
      { type: 'series', id: 'shuffle', name: ADDON_NAME },
    ],
    behaviorHints: { configurable: true, configurationRequired: false },
  };
}

app.get('/manifest.json', (req, res) => {
  res.json(buildManifest({ shows: [{ id: 'tt0898266', name: 'The Big Bang Theory' }], topPercent: 100 }, req));
});
app.get('/:config/manifest.json', (req, res) => {
  res.json(buildManifest(req.addonConfig, req));
  for (const show of req.addonConfig.shows) {
    getTopEpisodes(show.id, req.addonConfig.topPercent).catch(() => {});
  }
});
app.get('/:config/manifest', (req, res) => res.json(buildManifest(req.addonConfig, req)));

function parseExtra(extraStr) {
  if (!extraStr) return {};
  try {
    const sp = new URLSearchParams(extraStr);
    const obj = {};
    for (const [k, v] of sp.entries()) obj[k] = v;
    return obj;
  } catch { return {}; }
}

// SINGLE catalog handler - series/shuffle only
function catalogHandler(req, res) {
  const cfg = req.addonConfig;
  const extra = parseExtra(req.params.extra);
  const search = (extra.search || '').toLowerCase();
  let filtered = cfg.shows;
  if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search));
  const skip = parseInt(extra.skip || '0', 10) || 0;
  const paged = filtered.slice(skip, skip + 100);
  const metas = paged.map(show => ({
    id: `shuffle:${show.id}`,
    type: 'series',
    name: show.name,
    poster: `https://images.metahub.space/poster/medium/${show.id}/img.jpg`,
    background: `https://images.metahub.space/background/medium/${show.id}/img.jpg`,
    logo: `https://images.metahub.space/logo/medium/${show.id}/img.png`,
    description: `🎲 Surprise! One click → random ${cfg.topPercent === 100 ? 'episode' : `top ${cfg.topPercent}% episode`} of ${show.name}`,
    posterShape: 'poster',
    behaviorHints: { defaultVideoId: null },
  }));
  res.json({ metas });
  for (const show of paged) getTopEpisodes(show.id, cfg.topPercent).catch(() => {});
}

// Only one catalog route family
app.get('/:config/catalog/series/shuffle.json', catalogHandler);
app.get('/:config/catalog/series/shuffle/:extra.json', catalogHandler);
// Legacy aliases still resolve to same single catalog to avoid 404, but they return same single list
app.get('/:config/catalog/:type/:id.json', catalogHandler);
app.get('/:config/catalog/:type/:id/:extra.json', catalogHandler);

// Meta handler - returns single random video with defaultVideoId for true 1-click
async function handleMeta(req, res) {
  const rawId = req.params.id;
  if (!rawId.startsWith('shuffle:')) return res.json({ meta: null });
  const imdbId = rawId.match(/tt\d+/)?.[0];
  if (!imdbId) return res.json({ meta: null });
  const cfg = req.addonConfig;
  const show = cfg.shows.find(s => s.id === imdbId);
  if (!show) {
    // Try to still serve if show list doesn't contain but id is valid - for direct links
    // But for "no metadata found" bug, we must ensure we return meta for configured shows
    return res.json({ meta: null });
  }
  try {
    const episode = await pickRandomEpisode(imdbId, cfg.topPercent);
    const videoId = `${imdbId}:${episode.season}:${episode.number}`;
    const epLabel = `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`;
    const releaseDate = new Date().toISOString().split('T')[0];

    res.json({
      meta: {
        id: rawId,
        type: 'series',
        name: show.name,
        poster: `https://images.metahub.space/poster/medium/${imdbId}/img.jpg`,
        background: `https://images.metahub.space/background/medium/${imdbId}/img.jpg`,
        logo: `https://images.metahub.space/logo/medium/${imdbId}/img.png`,
        description: `🎲 Single Click Surprise — ${cfg.topPercent === 100 ? 'All episodes' : `Top ${cfg.topPercent}%`} · ${epLabel} — ${episode.name}${episode.rating != null ? ` (★${episode.rating})` : ''}. New surprise every open! Universal mode uses your existing addons.`,
        releaseInfo: `${episode.season}`,
        imdbRating: episode.rating != null ? String(episode.rating) : undefined,
        behaviorHints: { defaultVideoId: videoId },
        videos: [
          {
            id: videoId,
            title: `🎁 ${epLabel} — ${episode.name}${episode.rating != null ? ` (★${episode.rating})` : ''}`,
            overview: `Surprise pick from ${cfg.topPercent === 100 ? 'all episodes' : `top ${cfg.topPercent}%`}. ${show.name} ${epLabel}: ${episode.name}`,
            released: releaseDate,
            season: episode.season,
            episode: episode.number,
          },
        ],
      },
      cacheMaxAge: 0,
    });
  } catch (err) {
    console.error('Meta error', err);
    res.json({
      meta: {
        id: rawId,
        type: 'series',
        name: show.name,
        poster: `https://images.metahub.space/poster/medium/${imdbId}/img.jpg`,
        description: `Error: ${err.message}. Retry.`,
        videos: [],
      },
      cacheMaxAge: 0,
    });
  }
}

app.get('/:config/meta/series/:id.json', handleMeta);
app.get('/:config/meta/:type/:id.json', handleMeta);

// Stream handler - for universal mode we DO NOT provide streams ourselves,
// but we must respond to stream requests for tt:S:E so that Stremio doesn't show "No streams found"?
// Actually in universal mode, other addons provide streams for tt:S:E. We return [] to not interfere.
// However, for shuffle:tt id itself (if someone clicks before meta redirect), return empty with externalUrl hint? Better return [] and let meta's defaultVideoId trigger separate stream fetch for tt:S:E which will be handled by other addons.
async function handleStream(req, res) {
  // Always return empty - universal mode relies on TorBox/RD addons for tt:S:E
  // This ensures we don't block other addons
  res.json({ streams: [], cacheMaxAge: 0 });
}

app.get('/:config/stream/series/:id.json', handleStream);
app.get('/:config/stream/:type/:id.json', handleStream);

try {
  const { _loadFileCache } = require('./tvmaze');
  _loadFileCache();
  console.log('[Startup] Persistent cache loaded');
} catch (e) {
  console.warn('[Startup] Cache load failed', e.message);
}

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`${ADDON_NAME} v${ADDON_VERSION} running at http://localhost:${PORT}`));
}
module.exports = app;
