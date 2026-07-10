# 🎁 Sitcom Surprise

One tile per TV show in Stremio. Single click → surprise random episode plays directly. No browsing, no picking.

**Hosted securely at:** https://sitcom-shuffle-surprise.vercel.app *(will rename to sitcom-surprise after Vercel project update)*

> **Note:** Previously named "Sitcom Shuffle: Single Click Surprise" — renamed to **Sitcom Surprise** to avoid conflict with existing Sitcom Shuffle app. Logo placeholder: drop your Gemini Nano Banana `logo.png` (512x512) into `public/`.

## Features

- **One Tile Per Show** — each series is one tile, single row in Stremio (no duplicate Movie/Series rows)
- **True Single Click** — `defaultVideoId` makes Stremio jump directly to random episode's streams from your existing addons
- **Top % Filter** — leave empty for 100% all episodes, or set 1-100% by IMDb rating (no 7.5 threshold)
- **Universal — No AIO** — works with whatever you already have (TorBox, Real-Debrid, etc.)
- **Persistent Cache** — episodes fetched once per series from TVmaze, cached 30 days (`~/.cache/sitcom-shuffle/episodes.json`), instant random after
- **Logo:** Replace `public/logo.png` with your Gemini Nano Banana artwork (gift box surprise theme recommended)

## Quick Start

Configurator: https://sitcom-shuffle-surprise.vercel.app/configure/

1. Search and add shows (e.g. Big Bang Theory)
2. Set Top % (default 20%, empty = 100% all)
3. Generate install link → Install in Stremio Web or App

## Hosting

- **Vercel:** HTTPS auto, current `sitcom-shuffle-surprise.vercel.app`
- Custom domain suggestion: `sitcom-surprise.vercel.app` (rename project in Vercel dashboard)
- Also supports: Beamup, Cloudflare Workers, Render/Fly

## Development

```bash
npm install
npm run dev
npm test   # 16 tests
```

Drop your logo: `public/logo.png` (512x512 PNG). Server will serve it automatically.

## How Single Click Works

1. Catalog returns tiles: `shuffle:ttXXX`
2. Meta handler picks random episode from cache → returns single video `tt:S:E` + `behaviorHints.defaultVideoId`
3. Stremio auto-opens that video and calls `stream/series/tt:S:E.json` on all your other addons → streams ready
4. `cacheMaxAge:0` ensures new surprise every open

## Success Criteria

- 3 series → 3 tiles, single row
- Click tile → no "No metadata found", goes directly to random episode player (using your TorBox etc)
- No AIO config, no 7.5 filter
- Logo placeholder ready for Gemini image

MIT
