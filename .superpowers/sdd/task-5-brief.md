# Task 5: End-to-End Verification & Polish

**Files:**
- Modify: `src/index.js` (add meta handler and update manifest resources)
- Create: `tests/e2e.test.js`
- Create: `README.md`

**Interfaces:**
- Consumes: All previous modules (`config.js`, `tvmaze.js`, existing routes in `index.js`)
- Produces: Working, tested, documented addon

- [ ] **Step 1: Add meta handler to `src/index.js`**

Stremio may request meta details for individual items. Add this route after the catalog route in `src/index.js`:

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

Also update the `resources` array in the manifest route to include `'meta'`:
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
    assert.ok(manifest.resources.includes('meta'));

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

## Features

- **True One-Click Play** — No browsing seasons or episodes
- **Smart Episode Selection** — Picks from the top 20% rated episodes (minimum 7.5 rating)
- **AIOStreams Integration** — Uses your existing streaming setup with TorBox/Real-Debrid
- **24-Hour Caching** — Episode ratings cached locally to minimize API calls
- **Stateless Design** — All configuration encoded in your install URL, no database needed

## Development

\`\`\`bash
npm install
npm run dev     # Start with --watch
npm test        # Run tests
\`\`\`

## Tech Stack

- Node.js + Express
- TVmaze API (episode ratings, no API key needed)
- AIOStreams (stream proxying via your existing config)
- Vanilla HTML/CSS/JS configurator
```

- [ ] **Step 5: Run all tests**

```bash
PORT=3000 node src/index.js &
sleep 1
node --test tests/
kill %1
```

Expected: All unit and integration tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git status  # verify no agent state files are staged (.claude.md, .agents/, implementation_plan.md, etc.)
git reset HEAD .claude.md .agents/ implementation_plan.md success_criteria.md .superpowers/ 2>/dev/null || true
git commit -m "feat: complete sitcom shuffle addon with meta handler, e2e tests, and README"
```
