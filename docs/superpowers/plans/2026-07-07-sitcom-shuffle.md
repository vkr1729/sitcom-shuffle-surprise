# Sitcom Shuffle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Stremio addon that presents configured TV shows as "movies" in a custom catalog, and when clicked, randomly selects a top-rated episode and proxies streams from the user's AIOStreams instance.

**Architecture:** Node.js Express server with three route groups: manifest, catalog, stream. A separate TVmaze module handles episode lookups and caching. A static HTML configurator page lets users search shows and generate an install URL. Configuration is encoded as Base64 JSON in the URL path — no database needed.

**Tech Stack:** Node.js 18+, Express, node-fetch, Vanilla HTML/CSS/JS (configurator)

## Global Constraints

- No external dependencies beyond `express` and `node-fetch`
- TVmaze API is keyless; respect rate limits (max ~20 req/s, cache aggressively)
- All config lives in the URL path as Base64 JSON — zero server-side state
- Stremio addon protocol compliance (JSON responses, CORS headers, `/:config/` path prefix)
- Stream responses must set `cacheMaxAge: 0` so Stremio re-randomizes on every click

---

### Task 1: Project Scaffold & Express Server with Config Decoding

**Files:**
- Create: `package.json`
- Create: `src/index.js`
- Create: `src/config.js`
- Test: `tests/config.test.js`

**Interfaces:**
- Produces: `decodeConfig(base64String) → { aio: string, shows: Array<{id, name}> }` used by all route handlers
- Produces: `encodeConfig(configObj) → string` used by configurator page
- Produces: Express app listening on `process.env.PORT || 3000` with CORS headers

- [ ] **Step 1: Initialize project**

```bash
cd /home/kedarnath-reddy-vallaboina/Stremio-Extension
npm init -y
npm install express node-fetch@2
```

Use `node-fetch@2` because v3 is ESM-only and we use CommonJS for simplicity.

- [ ] **Step 2: Create `src/config.js` — config encode/decode**

```js
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
```

- [ ] **Step 3: Write failing tests for config**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/config.test.js
```

Expected: 4 passing tests.

- [ ] **Step 5: Create `src/index.js` — Express server with CORS and config middleware**

```js
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

// Placeholder routes — implemented in subsequent tasks
// app.get('/:config/catalog/movie/sitcom_shuffle_catalog.json', ...)
// app.get('/:config/stream/movie/:id.json', ...)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sitcom Shuffle addon running at http://localhost:${PORT}`);
});

module.exports = app; // for testing
```

- [ ] **Step 6: Add npm scripts to `package.json`**

Add these to the `"scripts"` section of `package.json`:
```json
{
  "start": "node src/index.js",
  "dev": "node --watch src/index.js",
  "test": "node --test tests/"
}
```

- [ ] **Step 7: Smoke-test the server**

```bash
npm start &
sleep 1
curl -s http://localhost:3000/$(node -e "console.log(require('./src/config').encodeConfig({aio:'http://x',shows:[{id:'tt1',name:'Test'}]}))")/manifest.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);console.log(j.id);process.exit(j.id==='org.stremio.sitcomshuffle'?0:1)"
kill %1
```

Expected: prints `org.stremio.sitcomshuffle` and exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/config.js src/index.js tests/config.test.js
git commit -m "feat: project scaffold with express server and config encode/decode"
```

---

### Task 2: TVmaze Integration & Episode Rating Filter

**Files:**
- Create: `src/tvmaze.js`
- Test: `tests/tvmaze.test.js`

**Interfaces:**
- Consumes: IMDb ID string (e.g. `'tt0898266'`)
- Produces: `getTopEpisodes(imdbId) → Promise<Array<{season, number, name, rating}>>` — returns the filtered and cached list of top-rated episodes
- Produces: `pickRandomEpisode(imdbId) → Promise<{season, number, name, rating}>` — picks one at random from the top list

- [ ] **Step 1: Write `src/tvmaze.js`**

```js
// src/tvmaze.js
'use strict';
const fetch = require('node-fetch');

// In-memory cache: { [imdbId]: { episodes: [...], cachedAt: timestamp } }
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function lookupShowId(imdbId) {
  const res = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`);
  if (!res.ok) {
    throw new Error(`TVmaze lookup failed for ${imdbId}: ${res.status}`);
  }
  const show = await res.json();
  return show.id;
}

async function fetchAllEpisodes(tvmazeId) {
  const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/episodes`);
  if (!res.ok) {
    throw new Error(`TVmaze episodes fetch failed for show ${tvmazeId}: ${res.status}`);
  }
  return res.json();
}

function filterTopEpisodes(episodes) {
  // Step 1: Filter episodes that have ratings
  const rated = episodes.filter(
    (ep) => ep.rating && ep.rating.average != null && ep.type === 'regular'
  );

  if (rated.length === 0) return [];

  // Step 2: Try hybrid filter — minimum 7.5 AND top 20%
  const aboveThreshold = rated.filter((ep) => ep.rating.average >= 7.5);

  let pool;
  if (aboveThreshold.length === 0) {
    // Fallback: top 20% regardless of rating
    pool = rated;
  } else {
    pool = aboveThreshold;
  }

  // Step 3: Sort descending by rating, take top 20%
  pool.sort((a, b) => b.rating.average - a.rating.average);
  const cutoff = Math.max(1, Math.ceil(pool.length * 0.2));
  const topEpisodes = pool.slice(0, cutoff);

  return topEpisodes.map((ep) => ({
    season: ep.season,
    number: ep.number,
    name: ep.name || `Episode ${ep.number}`,
    rating: ep.rating.average,
  }));
}

async function getTopEpisodes(imdbId) {
  // Check cache
  const cached = cache.get(imdbId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.episodes;
  }

  const tvmazeId = await lookupShowId(imdbId);
  const allEpisodes = await fetchAllEpisodes(tvmazeId);
  const top = filterTopEpisodes(allEpisodes);

  cache.set(imdbId, { episodes: top, cachedAt: Date.now() });
  return top;
}

async function pickRandomEpisode(imdbId) {
  const top = await getTopEpisodes(imdbId);
  if (top.length === 0) {
    throw new Error(`No rated episodes found for ${imdbId}`);
  }
  const idx = Math.floor(Math.random() * top.length);
  return top[idx];
}

// Exported for testing
module.exports = { getTopEpisodes, pickRandomEpisode, filterTopEpisodes, _cache: cache };
```

- [ ] **Step 2: Write tests for `filterTopEpisodes` (pure logic, no network)**

```js
// tests/tvmaze.test.js
'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { filterTopEpisodes } = require('../src/tvmaze');

function makeEp(season, number, rating, type = 'regular') {
  return {
    season,
    number,
    name: `S${season}E${number}`,
    type,
    rating: { average: rating },
  };
}

describe('filterTopEpisodes', () => {
  it('returns top 20% of episodes rated >= 7.5', () => {
    // 10 episodes: ratings 6.0, 6.5, 7.0, 7.5, 8.0, 8.2, 8.5, 8.8, 9.0, 9.5
    const episodes = [
      makeEp(1, 1, 6.0),
      makeEp(1, 2, 6.5),
      makeEp(1, 3, 7.0),
      makeEp(1, 4, 7.5),
      makeEp(1, 5, 8.0),
      makeEp(1, 6, 8.2),
      makeEp(1, 7, 8.5),
      makeEp(1, 8, 8.8),
      makeEp(1, 9, 9.0),
      makeEp(1, 10, 9.5),
    ];

    const result = filterTopEpisodes(episodes);

    // 7 episodes are >= 7.5, top 20% of 7 = ceil(1.4) = 2
    assert.equal(result.length, 2);
    assert.equal(result[0].rating, 9.5);
    assert.equal(result[1].rating, 9.0);
  });

  it('falls back to top 20% when no episodes >= 7.5', () => {
    const episodes = [
      makeEp(1, 1, 5.0),
      makeEp(1, 2, 5.5),
      makeEp(1, 3, 6.0),
      makeEp(1, 4, 6.5),
      makeEp(1, 5, 7.0),
    ];

    const result = filterTopEpisodes(episodes);

    // All below 7.5 → fallback to top 20% of all 5 = ceil(1) = 1
    assert.equal(result.length, 1);
    assert.equal(result[0].rating, 7.0);
  });

  it('excludes specials (non-regular episodes)', () => {
    const episodes = [
      makeEp(0, 1, 9.5, 'special'),
      makeEp(1, 1, 8.0),
      makeEp(1, 2, 8.5),
    ];

    const result = filterTopEpisodes(episodes);

    // Special excluded, 2 regular eps >= 7.5, top 20% of 2 = ceil(0.4) = 1
    assert.equal(result.length, 1);
    assert.equal(result[0].rating, 8.5);
    assert.equal(result[0].season, 1);
  });

  it('returns empty array when no rated episodes', () => {
    const episodes = [
      { season: 1, number: 1, name: 'Pilot', type: 'regular', rating: { average: null } },
    ];

    const result = filterTopEpisodes(episodes);
    assert.equal(result.length, 0);
  });

  it('returns at least 1 episode even for small pools', () => {
    const episodes = [makeEp(1, 1, 9.0)];
    const result = filterTopEpisodes(episodes);
    assert.equal(result.length, 1);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
node --test tests/tvmaze.test.js
```

Expected: 5 passing tests.

- [ ] **Step 4: Commit**

```bash
git add src/tvmaze.js tests/tvmaze.test.js
git commit -m "feat: TVmaze integration with hybrid episode rating filter"
```

---

### Task 3: Catalog & Stream Route Handlers

**Files:**
- Modify: `src/index.js` (add catalog and stream routes)
- Test: `tests/routes.test.js`

**Interfaces:**
- Consumes: `decodeConfig()` from `src/config.js` (via `req.addonConfig`)
- Consumes: `pickRandomEpisode(imdbId)` from `src/tvmaze.js`
- Produces: `GET /:config/catalog/movie/sitcom_shuffle_catalog.json` → `{ metas: [...] }`
- Produces: `GET /:config/stream/movie/:id.json` → `{ streams: [...] }`

- [ ] **Step 1: Add catalog route to `src/index.js`**

Add after the manifest route:

```js
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
```

- [ ] **Step 2: Add stream route to `src/index.js`**

Add after the catalog route:

```js
const fetch = require('node-fetch');
const { pickRandomEpisode } = require('./tvmaze');

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
```

- [ ] **Step 3: Write route integration tests**

```js
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
    // Direct HTTP test against running server
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
```

- [ ] **Step 4: Start server and run route tests**

```bash
PORT=3000 node src/index.js &
sleep 1
node --test tests/routes.test.js
kill %1
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.js tests/routes.test.js
git commit -m "feat: catalog and stream route handlers with AIOStreams proxy"
```

---

### Task 4: Configurator Web Page

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`

**Interfaces:**
- Consumes: TVmaze search API `https://api.tvmaze.com/search/shows?q=...` (client-side fetch)
- Consumes: `encodeConfig()` logic (reimplemented in browser JS via `btoa()`)
- Produces: A beautiful single-page configurator at `/configure` that generates the Stremio install URL

- [ ] **Step 1: Create `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitcom Shuffle — Configure</title>
  <meta name="description" content="Configure your Sitcom Shuffle Stremio addon. Add your favorite TV shows and get one-click random top-rated episode playback.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header class="hero">
      <h1>🎲 Sitcom Shuffle</h1>
      <p class="tagline">One click. Random top-rated episode. Instant play.</p>
    </header>

    <section class="card" id="aio-section">
      <h2>1. AIOStreams URL</h2>
      <p class="hint">Paste your AIOStreams manifest URL (the one you installed in Stremio).</p>
      <input type="url" id="aio-url" placeholder="https://aiostreams.elfhosted.com/abc123/manifest.json" autocomplete="off">
      <p class="error" id="aio-error"></p>
    </section>

    <section class="card" id="search-section">
      <h2>2. Add TV Shows</h2>
      <input type="search" id="search-input" placeholder="Search for a TV show..." autocomplete="off">
      <div id="search-results" class="results-grid"></div>
    </section>

    <section class="card" id="favorites-section">
      <h2>3. My Sitcoms <span class="badge" id="show-count">0</span></h2>
      <div id="favorites-list" class="favorites-grid">
        <p class="empty-state" id="empty-state">No shows added yet. Search above to add your favorites!</p>
      </div>
    </section>

    <section class="card action-card" id="install-section">
      <h2>4. Install Addon</h2>
      <button id="install-btn" class="btn-primary" disabled>Generate Install Link</button>
      <div id="install-output" class="install-output hidden">
        <p>Your addon is ready! Click below to install:</p>
        <a id="install-link" class="btn-install" href="#" target="_blank">🚀 Install in Stremio</a>
        <div class="url-box">
          <input type="text" id="install-url" readonly>
          <button id="copy-btn" class="btn-copy">Copy</button>
        </div>
      </div>
    </section>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/style.css`**

Create a dark-themed, glassmorphism-styled CSS file. Key design tokens:
- Background: deep gradient `#0a0a1a` → `#1a1a3e`
- Cards: semi-transparent with backdrop-filter blur
- Accent: vibrant purple-to-teal gradient for buttons and highlights
- Font: Inter
- Smooth transitions on hover, focus states, card interactions
- Responsive grid for search results and favorites
- Show poster cards with rounded corners, subtle shadow, hover scale

Full CSS in the file — approximately 250 lines covering:
- `.container` max-width centered layout
- `.hero` gradient text heading
- `.card` glassmorphism panels
- `.results-grid` and `.favorites-grid` responsive CSS grid
- `.show-card` with poster image, title overlay, add/remove buttons
- `.btn-primary`, `.btn-install`, `.btn-copy` styled buttons with hover effects
- Input fields with focus glow animation
- `.badge` count indicator
- `.hidden` utility class
- Mobile responsive breakpoints

- [ ] **Step 3: Create `public/app.js`**

```js
// public/app.js
'use strict';
(function () {
  const aioInput = document.getElementById('aio-url');
  const aioError = document.getElementById('aio-error');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const favoritesList = document.getElementById('favorites-list');
  const emptyState = document.getElementById('empty-state');
  const showCount = document.getElementById('show-count');
  const installBtn = document.getElementById('install-btn');
  const installOutput = document.getElementById('install-output');
  const installLink = document.getElementById('install-link');
  const installUrl = document.getElementById('install-url');
  const copyBtn = document.getElementById('copy-btn');

  const favorites = new Map(); // id → { id, name, poster }

  // --- AIOStreams URL parsing ---
  function getAioBase() {
    let url = aioInput.value.trim();
    if (!url) return null;
    // Strip /manifest.json if present
    url = url.replace(/\/manifest\.json\s*$/i, '');
    try {
      new URL(url);
      aioError.textContent = '';
      return url;
    } catch {
      aioError.textContent = 'Please enter a valid URL.';
      return null;
    }
  }

  aioInput.addEventListener('input', updateInstallBtn);

  // --- Search ---
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchResults.innerHTML = '';
      return;
    }
    searchTimeout = setTimeout(() => searchShows(query), 350);
  });

  async function searchShows(query) {
    try {
      const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      renderSearchResults(data);
    } catch (err) {
      searchResults.innerHTML = '<p class="error">Search failed. Please try again.</p>';
    }
  }

  function renderSearchResults(results) {
    searchResults.innerHTML = results
      .filter((r) => r.show && r.show.externals && r.show.externals.imdb)
      .slice(0, 12)
      .map((r) => {
        const show = r.show;
        const imdbId = show.externals.imdb;
        const poster = show.image ? show.image.medium : '';
        const year = show.premiered ? show.premiered.slice(0, 4) : '?';
        const isAdded = favorites.has(imdbId);
        return `
          <div class="show-card ${isAdded ? 'added' : ''}" data-id="${imdbId}" data-name="${escapeHtml(show.name)}" data-poster="${poster}">
            <div class="poster-wrap">
              ${poster ? `<img src="${poster}" alt="${escapeHtml(show.name)}" loading="lazy">` : '<div class="no-poster">No Image</div>'}
            </div>
            <div class="show-info">
              <span class="show-title">${escapeHtml(show.name)}</span>
              <span class="show-year">${year}</span>
            </div>
            <button class="btn-add" onclick="window.__addShow('${imdbId}', '${escapeHtml(show.name)}', '${poster}')">
              ${isAdded ? '✓ Added' : '+ Add'}
            </button>
          </div>
        `;
      })
      .join('');
  }

  // --- Favorites ---
  window.__addShow = function (id, name, poster) {
    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.set(id, { id, name, poster });
    }
    renderFavorites();
    // Re-render search results to toggle button state
    const query = searchInput.value.trim();
    if (query.length >= 2) searchShows(query);
    updateInstallBtn();
  };

  function renderFavorites() {
    if (favorites.size === 0) {
      favoritesList.innerHTML = '<p class="empty-state">No shows added yet. Search above to add your favorites!</p>';
      showCount.textContent = '0';
      return;
    }
    showCount.textContent = favorites.size;
    favoritesList.innerHTML = Array.from(favorites.values())
      .map(
        (show) => `
        <div class="show-card favorite" data-id="${show.id}">
          <div class="poster-wrap">
            ${show.poster ? `<img src="${show.poster}" alt="${escapeHtml(show.name)}" loading="lazy">` : '<div class="no-poster">No Image</div>'}
          </div>
          <div class="show-info">
            <span class="show-title">${escapeHtml(show.name)}</span>
          </div>
          <button class="btn-remove" onclick="window.__addShow('${show.id}', '${escapeHtml(show.name)}', '${show.poster}')">✕ Remove</button>
        </div>
      `
      )
      .join('');
  }

  // --- Install ---
  function updateInstallBtn() {
    const hasAio = !!getAioBase();
    const hasShows = favorites.size > 0;
    installBtn.disabled = !(hasAio && hasShows);
    installOutput.classList.add('hidden');
  }

  installBtn.addEventListener('click', () => {
    const aioBase = getAioBase();
    if (!aioBase || favorites.size === 0) return;

    const config = {
      aio: aioBase,
      shows: Array.from(favorites.values()).map((s) => ({ id: s.id, name: s.name })),
    };

    const encoded = btoa(JSON.stringify(config))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const base = window.location.origin;
    const manifestUrl = `${base}/${encoded}/manifest.json`;
    const stremioUrl = `stremio://${base.replace(/^https?:\/\//, '')}/${encoded}/manifest.json`;

    installLink.href = stremioUrl;
    installUrl.value = manifestUrl;
    installOutput.classList.remove('hidden');
  });

  copyBtn.addEventListener('click', () => {
    installUrl.select();
    navigator.clipboard.writeText(installUrl.value);
    copyBtn.textContent = '✓ Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
```

- [ ] **Step 4: Verify the configurator page loads**

```bash
PORT=3000 node src/index.js &
sleep 1
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/configure/
kill %1
```

Expected: HTTP status `200`.

- [ ] **Step 5: Commit**

```bash
git add public/
git commit -m "feat: configurator web page with show search and install link generation"
```

---

### Task 5: End-to-End Verification & Polish

**Files:**
- Modify: `src/index.js` (add meta handler for show detail pages)
- Create: `tests/e2e.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: All previous modules
- Produces: Working, tested, documented addon

- [ ] **Step 1: Add meta handler to `src/index.js`**

Stremio may request meta details for individual items. Add after the catalog route:

```js
// Meta handler — provides show details when Stremio opens the item page
app.get('/:config/meta/movie/:id.json', (req, res) => {
  const rawId = req.params.id;
  if (!rawId.startsWith('shuffle:')) {
    return res.json({ meta: null });
  }
  const imdbId = rawId.replace('shuffle:', '');
  const show = req.addonConfig.shows.find((s) => s.id === imdbId);
  if (!show) {
    return res.json({ meta: null });
  }
  res.json({
    meta: {
      id: rawId,
      type: 'movie',
      name: `${show.name} (Shuffle)`,
      poster: `https://images.metahub.space/poster/medium/${imdbId}/img`,
      background: `https://images.metahub.space/background/medium/${imdbId}/img`,
      description: `Click play to watch a random top-rated episode of ${show.name}. A new episode is picked every time!`,
    },
  });
});
```

Also add `'meta'` to the `resources` array in the manifest route:
```js
resources: ['catalog', 'meta', 'stream'],
```

- [ ] **Step 2: Write E2E smoke test**

```js
// tests/e2e.test.js
'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { encodeConfig } = require('../src/config');

const TEST_CONFIG = {
  aio: 'https://aiostreams.elfhosted.com/test',
  shows: [{ id: 'tt0898266', name: 'The Big Bang Theory' }],
};
const configStr = encodeConfig(TEST_CONFIG);
const BASE = 'http://localhost:3000';

describe('e2e: full addon flow', () => {
  it('manifest → catalog → meta → stream (live TVmaze)', async () => {
    // 1. Manifest
    const manifest = await (await fetch(`${BASE}/${configStr}/manifest.json`)).json();
    assert.equal(manifest.id, 'org.stremio.sitcomshuffle');
    assert.ok(manifest.resources.includes('stream'));

    // 2. Catalog
    const catalog = await (await fetch(`${BASE}/${configStr}/catalog/movie/sitcom_shuffle_catalog.json`)).json();
    assert.equal(catalog.metas.length, 1);
    assert.equal(catalog.metas[0].id, 'shuffle:tt0898266');

    // 3. Meta
    const meta = await (await fetch(`${BASE}/${configStr}/meta/movie/shuffle:tt0898266.json`)).json();
    assert.ok(meta.meta.name.includes('Big Bang'));

    // 4. Stream (will fail to reach AIOStreams test URL but should not crash)
    const stream = await (await fetch(`${BASE}/${configStr}/stream/movie/shuffle:tt0898266.json`)).json();
    // Should either return streams or an empty array — never crash
    assert.ok(Array.isArray(stream.streams));
  });
});
```

- [ ] **Step 3: Run E2E test**

```bash
PORT=3000 node src/index.js &
sleep 1
node --test tests/e2e.test.js
kill %1
```

Expected: All assertions pass. The stream call may return empty streams (because the AIOStreams test URL is fake) but will not crash.

- [ ] **Step 4: Create `README.md`**

```markdown
# 🎲 Sitcom Shuffle — Stremio Addon

One-click random top-rated episode playback for your favorite TV shows.

## How It Works

1. Visit the configurator page
2. Paste your AIOStreams URL
3. Search and add your favorite TV shows
4. Click "Generate Install Link" and install in Stremio
5. Open Stremio → find "Sitcom Shuffle" catalog → click any show → enjoy!

## Development

```bash
npm install
npm run dev     # Start with --watch
npm test        # Run tests
```

## Tech Stack

- Node.js + Express
- TVmaze API (episode ratings, no API key needed)
- AIOStreams (stream proxying via your existing config)
- Vanilla HTML/CSS/JS configurator
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All unit and integration tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git status  # verify no agent files are staged
git commit -m "feat: complete sitcom shuffle addon with meta handler, e2e tests, and README"
```
