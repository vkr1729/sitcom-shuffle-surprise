# 🎲 Sitcom Shuffle — Stremio Addon

One tile per TV show in Stremio. Single click → plays random top-rated episode using your existing Stremio addons (TorBox, Real-Debrid, AIOStreams, etc.). No episode browsing, no source selection.

## How It Works (Universal Mode)

1. Configure shows on `/configure` page
2. Set top % filter (default 20%, leave empty for 100% all episodes)
3. Install in Stremio Web/App
4. Click tile → addon picks random episode from cached list → returns single video with `defaultVideoId` → Stremio jumps to that episode's streams from *your* other installed addons → auto-play

**True 1-Click:** Uses `behaviorHints.defaultVideoId` so Stremio opens directly to the random episode. No season/episode selector.

### Caching (No Lag)

- Episodes list fetched once per series from TVmaze, cached persistently on disk (`~/.cache/sitcom-shuffle/episodes.json`, 30 days TTL)
- In-memory cache for ultra-fast random picks (<1ms after first fetch)
- Completed series ratings rarely change — cache is long-lived per your request

### Universal (No AIO Required)

- Works with whatever stream addons you already have in Stremio (TorBox, Real-Debrid, etc.)
- Optional AIOStreams URL: if provided, addon itself proxies streams and enables direct `<video>` player at `/player/` and direct URL for celluloid/mpv at `/play/` (302 redirect)

## Endpoints

- `/:config/manifest.json` - addon manifest
- `/:config/catalog/series/shuffle_series.json` - one tile per show
- `/:config/meta/series/shuffle:ttXXX.json` - returns single random video `ttXXX:S:E` with `defaultVideoId`
- `/:config/player/shuffle:ttXXX` - HTML5 player (needs AIO for streams) — direct play in Chrome, pass to celluloid via copy URL
- `/:config/play/shuffle:ttXXX` - 302 redirect to first stream URL (for `celluloid <url>` or `mpv <url>`)

## Config Encoding

Config is base64url-encoded JSON in URL path:

```json
{
  "shows": [{ "id": "tt0898266", "name": "The Big Bang Theory" }],
  "topPercent": 20,          // 1-100, if not set → 100% (all episodes)
  "aio": "https://... (optional)"
}
```

## Development

```bash
npm install
npm run dev   # watch mode
npm test
PORT=3000 node src/index.js
```

## Deploy (Secure Free Hosting)

### Option 1: Vercel (Recommended, HTTPS auto)

```bash
npx vercel --prod
# Domain: https://your-project.vercel.app
# Manifest: https://your-project.vercel.app/<config>/manifest.json
```

Secure: Vercel provides auto HTTPS, custom domain, DDoS protection.

### Option 2: Beamup (Stremio's own free hosting, HTTPS)

```bash
npm i -g beamup-cli
beamup config  # host: a.baby-beamup.club
beamup
```

### Option 3: Cloudflare Workers (Edge, ultra-fast, free 100k req/day)

Adapt `src/index.js` to worker format or use `wrangler`. KV for persistent cache.

### Option 4: Render / Fly.io / Railway

All support Node + Express + `PORT` env. Free tier HTTPS.

## Success Criteria

- Load addon in Stremio Web with Big Bang Theory → tile appears → click → random episode streams from user's existing addons (no AIO needed) or direct in Chrome via `/player/`
- For celluloid: `celluloid $(curl .../play/shuffle:tt0898266?format=json | jq -r .url)`
- Tests pass: `npm test`

## Security

- No secrets in code, stateless config in URL
- HTTPS required by Stremio (`manifest.json` must be HTTPS except localhost)
- CORS open (`*`) as required by Stremio protocol
- No DB, no auth, no user tracking
