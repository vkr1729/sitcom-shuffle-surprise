# Task 2: TVmaze Integration & Episode Rating Filter

**Files:**
- Create: `src/tvmaze.js`
- Test: `tests/tvmaze.test.js`

**Interfaces:**
- Consumes: IMDb ID string (e.g. `'tt0898266'`)
- Produces: `getTopEpisodes(imdbId) → Promise<Array<{season, number, name, rating}>>` — returns the filtered and cached list of top-rated episodes
- Produces: `pickRandomEpisode(imdbId) → Promise<{season, number, name, rating}>` — picks one at random from the top list
- Produces: `filterTopEpisodes(episodes) → Array` — pure function for unit testing

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
