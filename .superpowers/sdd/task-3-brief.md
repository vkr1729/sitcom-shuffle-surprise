# Task 3: Catalog & Stream Route Handlers

**Files:**
- Modify: `src/index.js` (add catalog and stream routes)
- Test: `tests/routes.test.js`

**Interfaces:**
- Consumes: `decodeConfig()` from `src/config.js` (via `req.addonConfig` — already wired by app.param middleware)
- Consumes: `pickRandomEpisode(imdbId)` from `src/tvmaze.js` — returns `{ season, number, name, rating }`
- Produces: `GET /:config/catalog/movie/sitcom_shuffle_catalog.json` → `{ metas: [...] }`
- Produces: `GET /:config/stream/movie/:id.json` → `{ streams: [...] }`

- [ ] **Step 1: Add catalog route to `src/index.js`**

Add after the manifest route in `src/index.js`:

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

Add the required import at the top of `src/index.js`:
```js
const fetch = require('node-fetch');
const { pickRandomEpisode } = require('./tvmaze');
```

Then add this route after the catalog handler:

```js
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

IMPORTANT: The route tests require the server to be running. Start the server first, then run tests.

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
