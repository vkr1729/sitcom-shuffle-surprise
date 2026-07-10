// src/index.js - Sitcom Shuffle: Single Click Surprise v3 (Universal + Persistent Cache)
'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const { decodeConfig } = require('./config');
const { pickRandomEpisode, getTopEpisodes } = require('./tvmaze');

const app = express();

const ADDON_ID = 'org.stremio.sitcomshuffle.surprise';
const ADDON_NAME = 'Sitcom Shuffle: Single Click Surprise';
const ADDON_VERSION = '3.0.0';

// Default logo - use hosted SVG/PNG with fallback to generated dice logo
// This logo is a dice inside TV with gift box — reflects surprise theme, NOT a series logo
function getDefaultLogo(req) {
  const host = req ? `${req.protocol}://${req.get('host')}` : '';
  // Prefer local hosted logo if we have host, else fallback to clear icon
  if (host) {
    return `${host}/logo.png`;
  }
  // Fallback for manifest without req context
  return 'https://raw.githubusercontent.com/vkr1729/sitcom-shuffle/main/public/logo.png'; // placeholder, will be replaced by vercel URL after deploy
}

app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} → ${res.statusCode} (${elapsed}ms)`);
  });
  next();
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/configure', express.static(path.join(__dirname, '..', 'public')));
app.use('/logo.png', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'logo.png')));
app.use('/logo.svg', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'logo.svg')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => res.redirect('/configure'));

// Config param middleware
app.param('config', (req, res, next, configParam) => {
  if (configParam === 'default' || configParam === 'manifest.json') {
    req.addonConfig = {
      shows: [{ id: 'tt0898266', name: 'The Big Bang Theory' }],
      topPercent: 100,
      aio: null,
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
  const host = req ? `${req.protocol}://${req.get('host')}` : '';
  const logo = host ? `${host}/logo.png` : getDefaultLogo(req);

  const hasAio = !!cfg.aio;
  const topLabel = cfg.topPercent === 100 ? 'all episodes' : `top ${cfg.topPercent}%`;

  const resources = [
    'catalog',
    { name: 'meta', types: ['series', 'movie'], idPrefixes: ['shuffle:', 'tt'] },
    { name: 'stream', types: ['series', 'movie'], idPrefixes: ['shuffle:'] },
  ];
  if (hasAio) {
    // also handle tt ids when AIO present
    resources[2] = { name: 'stream', types: ['series', 'movie'], idPrefixes: ['shuffle:', 'tt'] };
  }

  return {
    id: ADDON_ID,
    version: ADDON_VERSION,
    name: ADDON_NAME,
    description: `One tile per show. One click = surprise random episode from ${topLabel}. Uses your existing Stremio addons. No browsing, no picking. Top ${cfg.topPercent}% filter, persistent cache, universal mode.`,
    logo,
    resources,
    types: ['series', 'movie'],
    idPrefixes: ['shuffle:', 'tt'],
    catalogs: [
      { type: 'series', id: 'shuffle_series', name: ADDON_NAME },
      { type: 'movie', id: 'shuffle_movie', name: ADDON_NAME },
    ],
    behaviorHints: { configurable: true, configurationRequired: false },
  };
}

// Manifest routes
app.get('/manifest.json', (req, res) => {
  res.json(buildManifest({ shows: [{ id: 'tt0898266', name: 'The Big Bang Theory' }], topPercent: 100, aio: null }, req));
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

function makeCatalogHandler() {
  return (req, res) => {
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
      posterShape: 'poster',
      background: `https://images.metahub.space/background/medium/${show.id}/img.jpg`,
      logo: `https://images.metahub.space/logo/medium/${show.id}/img.png`,
      description: `🎲 Surprise! Click for random ${cfg.topPercent === 100 ? 'episode' : `top ${cfg.topPercent}% episode`} of ${show.name}. New surprise every click!`,
      behaviorHints: { defaultVideoId: null },
    }));
    res.json({ metas, cacheMaxAge: 60 });
    for (const show of paged) getTopEpisodes(show.id, cfg.topPercent).catch(() => {});
  };
}

app.get('/:config/catalog/series/shuffle_series.json', makeCatalogHandler());
app.get('/:config/catalog/series/shuffle_series/:extra.json', makeCatalogHandler());
app.get('/:config/catalog/movie/shuffle_movie.json', makeCatalogHandler());
app.get('/:config/catalog/movie/shuffle_movie/:extra.json', makeCatalogHandler());
app.get('/:config/catalog/:type/sitcom_shuffle_catalog.json', makeCatalogHandler());
app.get('/:config/catalog/:type/sitcom_shuffle_catalog/:extra.json', makeCatalogHandler());
app.get('/:config/catalog/:type/:id.json', makeCatalogHandler());
app.get('/:config/catalog/:type/:id/:extra.json', makeCatalogHandler());

async function handleMeta(req, res) {
  const rawId = req.params.id;
  if (!rawId.startsWith('shuffle:')) return res.json({ meta: null });
  const imdbMatch = rawId.match(/^(shuffle:)(tt\d+)/);
  const imdbId = imdbMatch ? imdbMatch[2] : rawId.replace('shuffle:', '').match(/tt\d+/)?.[0];
  if (!imdbId) return res.json({ meta: null });
  const cfg = req.addonConfig;
  const show = cfg.shows.find(s => s.id === imdbId);
  if (!show) return res.json({ meta: null });
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
        description: `🎲 Single Click Surprise — ${cfg.topPercent === 100 ? 'All episodes' : `Top ${cfg.topPercent}% rated`} · ${epLabel} — ${episode.name} (★${episode.rating ?? '?'})\nSurprise random pick! New episode every time you open this tile. Universal mode uses your existing addons.`,
        releaseInfo: `${episode.season}`,
        imdbRating: episode.rating != null ? `${episode.rating}` : undefined,
        behaviorHints: { defaultVideoId: videoId },
        videos: [
          {
            id: videoId,
            title: `🎁 Surprise: ${epLabel} — ${episode.name}${episode.rating != null ? ` (★${episode.rating})` : ''}`,
            overview: `Random surprise from ${cfg.topPercent === 100 ? 'all episodes' : `top ${cfg.topPercent}% rated`}. ${show.name} ${epLabel}: ${episode.name}`,
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
        description: `Error: ${err.message}. Try again.`,
        videos: [],
      },
      cacheMaxAge: 0,
    });
  }
}

app.get('/:config/meta/series/:id.json', handleMeta);
app.get('/:config/meta/movie/:id.json', handleMeta);
app.get('/:config/meta/:type/:id.json', handleMeta);

async function handleStream(req, res) {
  const rawId = req.params.id || '';
  const cfg = req.addonConfig;
  const hasAio = !!cfg.aio;

  if (rawId.startsWith('shuffle:')) {
    const imdbMatch = rawId.match(/tt\d+/);
    const imdbId = imdbMatch ? imdbMatch[0] : null;
    if (!imdbId) return res.json({ streams: [], cacheMaxAge: 0 });
    try {
      const episode = await pickRandomEpisode(imdbId, cfg.topPercent);
      const videoId = `${imdbId}:${episode.season}:${episode.number}`;
      const epLabel = `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`;
      if (!hasAio) {
        return res.json({
          streams: [
            {
              name: `🎲 Surprise ${epLabel}`,
              title: `${episode.name} (★${episode.rating ?? '?'}) — uses your other addons for ${videoId}`,
              externalUrl: `${req.protocol}://${req.get('host')}/${req.params.config}/player/${rawId}`,
              behaviorHints: { bingeGroup: `surprise-${imdbId}` },
            },
          ],
          cacheMaxAge: 0,
        });
      }
      const aioUrl = `${cfg.aio}/stream/series/${videoId}.json`;
      const aioRes = await fetch(aioUrl, { signal: AbortSignal.timeout(15000) });
      if (!aioRes.ok) {
        return res.json({
          streams: [{ name: `Surprise ${epLabel}`, title: `${episode.name} (★${episode.rating})\nNo AIO streams — retry`, externalUrl: `https://www.imdb.com/title/${imdbId}/` }],
          cacheMaxAge: 0,
        });
      }
      const aioData = await aioRes.json();
      const streams = (aioData.streams || []).slice(0, 10).map(s => ({
        ...s,
        name: `[🎁 ${epLabel}] ${s.name || ''}`.trim(),
        title: `${episode.name} (★${episode.rating ?? '?'})\n${s.title || ''}`,
        behaviorHints: { ...(s.behaviorHints || {}), bingeGroup: `surprise-${imdbId}-${epLabel}` },
      }));
      return res.json({ streams, cacheMaxAge: 0 });
    } catch (err) {
      console.error('Stream shuffle err', err);
      return res.json({ streams: [], cacheMaxAge: 0 });
    }
  }

  const stdMatch = rawId.match(/^(tt\d+):(\d+):(\d+)/);
  if (stdMatch && hasAio) {
    const [, imdbId, s, e] = stdMatch;
    try {
      const aioUrl = `${cfg.aio}/stream/series/${imdbId}:${s}:${e}.json`;
      const aioRes = await fetch(aioUrl, { signal: AbortSignal.timeout(15000) });
      if (!aioRes.ok) return res.json({ streams: [], cacheMaxAge: 0 });
      const aioData = await aioRes.json();
      const epLabel = `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;
      const streams = (aioData.streams || []).map(st => ({ ...st, name: `[🎁 ${epLabel}] ${st.name || ''}`.trim() }));
      return res.json({ streams, cacheMaxAge: 0 });
    } catch (err) {
      return res.json({ streams: [], cacheMaxAge: 0 });
    }
  }
  return res.json({ streams: [], cacheMaxAge: 0 });
}

app.get('/:config/stream/series/:id.json', handleStream);
app.get('/:config/stream/movie/:id.json', handleStream);
app.get('/:config/stream/:type/:id.json', handleStream);

app.get('/:config/player/:id', async (req, res) => {
  const cfg = req.addonConfig;
  const rawId = req.params.id;
  const imdbMatch = (rawId || '').match(/tt\d+/);
  const imdbId = imdbMatch ? imdbMatch[0] : null;
  if (!imdbId) return res.status(400).send('Invalid id');
  try {
    const episode = await pickRandomEpisode(imdbId, cfg.topPercent);
    const videoId = `${imdbId}:${episode.season}:${episode.number}`;
    const epLabel = `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`;
    let streams = [];
    if (cfg.aio) {
      try {
        const aioRes = await fetch(`${cfg.aio}/stream/series/${videoId}.json`, { signal: AbortSignal.timeout(15000) });
        if (aioRes.ok) {
          const aioData = await aioRes.json();
          streams = aioData.streams || [];
        }
      } catch (e) { console.error('player AIO', e.message); }
    }
    const hasStreams = streams.length > 0;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${cfg.shows.find(s=>s.id===imdbId)?.name || imdbId} — ${epLabel} Surprise</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;font-family:Inter,system-ui,sans-serif;background:#0a0a1a;color:#eee;display:flex;flex-direction:column;min-height:100vh}
header{padding:20px;background:rgba(255,255,255,0.05);backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,0.1)}
h1{margin:0;font-size:1.5rem;background:linear-gradient(135deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:20px}
video{width:100%;max-width:960px;aspect-ratio:16/9;background:#000;border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.5)}
.info{background:rgba(255,255,255,0.05);padding:16px;border-radius:12px;max-width:960px;width:100%;border:1px solid rgba(255,255,255,0.1)}
button{padding:12px 20px;border:none;border-radius:8px;background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;font-weight:600;cursor:pointer;margin:4px}
button:hover{filter:brightness(1.1)}
pre{white-space:pre-wrap;word-break:break-all;background:#111;padding:12px;border-radius:8px;max-height:200px;overflow:auto;font-size:0.8rem}
.badge{display:inline-block;background:#10b981;color:#fff;padding:2px 8px;border-radius:9999px;font-size:0.8rem;margin-left:8px}
</style></head>
<body>
<header><h1>🎲 ${ADDON_NAME} — ${imdbId} <span class="badge">${epLabel} ★${episode.rating ?? '?'}</span></h1><div>${episode.name}</div></header>
<main>
${hasStreams ? `<video id="v" controls autoplay playsinline></video><div class="info"><div><strong>Now playing:</strong> ${epLabel} — ${episode.name} (★${episode.rating ?? '?'})</div><div style="margin-top:12px"><button onclick="document.getElementById('v').play()">▶️ Play</button><button onclick="location.reload()">🔀 Shuffle Again</button><button onclick="navigator.clipboard.writeText(streams[0].url);alert('Copied!')">📋 Copy URL for celluloid</button></div><details style="margin-top:12px"><summary>All streams (${streams.length})</summary><pre>${JSON.stringify(streams.slice(0,5),null,2)}</pre></details></div>` : `<div class="info"><h3>Universal Mode — ${epLabel}</h3><p>Random: <strong>${epLabel} — ${episode.name}</strong> — Video ID: <code>${videoId}</code></p><p>Install other Stremio addons (TorBox, Real-Debrid) to get streams for <code>${videoId}</code>, or add AIO URL for direct player.</p><button onclick="location.reload()">🔀 Pick Another</button></div>`}
</main>
<script>
const streams = ${JSON.stringify(streams)};
const video = document.getElementById('v');
if(video && streams[0]?.url){ video.src=streams[0].url; video.play().catch(()=>{}); }
</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${err.message}</pre>`);
  }
});

app.get('/:config/play/:id', async (req, res) => {
  const cfg = req.addonConfig;
  const rawId = req.params.id || '';
  const imdbMatch = rawId.match(/tt\d+/);
  const imdbId = imdbMatch ? imdbMatch[0] : null;
  if (!imdbId) return res.status(400).json({ error: 'Invalid id' });
  if (!cfg.aio) {
    return res.status(400).json({ error: 'Universal mode: no AIO, cannot provide direct URL', videoId: rawId });
  }
  try {
    const episode = await pickRandomEpisode(imdbId, cfg.topPercent);
    const videoId = `${imdbId}:${episode.season}:${episode.number}`;
    const aioRes = await fetch(`${cfg.aio}/stream/series/${videoId}.json`, { signal: AbortSignal.timeout(15000) });
    if (!aioRes.ok) return res.status(502).json({ error: `AIO ${aioRes.status}` });
    const data = await aioRes.json();
    const first = (data.streams || [])[0];
    if (!first?.url) return res.status(404).json({ error: 'No streams' });
    if (req.query.format === 'json' || req.query.redirect === '0') {
      return res.json({ url: first.url, episode, videoId });
    }
    return res.redirect(first.url);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Persistent cache preload
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
