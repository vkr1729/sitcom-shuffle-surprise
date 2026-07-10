# Task 1: Project Scaffold & Express Server with Config Decoding

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sitcom Shuffle addon running at http://localhost:${PORT}`);
});

module.exports = app;
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
