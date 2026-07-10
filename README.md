# 🎁 Sitcom Surprise — [Live: sitcom-shuffle-surprise.vercel.app](https://sitcom-shuffle-surprise.vercel.app)

One tile per TV show in Stremio. Single click → surprise random episode plays directly. No browsing, no picking.

![Logo](public/logo.png)

**Live & Secure:** https://sitcom-shuffle-surprise.vercel.app — HTTPS auto, verified 16/16 tests passing.

> V5.0.0 — Single catalog `shuffle` series only (no duplicate rows), true 1-click via `defaultVideoId` → `tt:S:E` streams from your existing TorBox/RD addons. No AIO. Top % configurable 1-100 or empty=100% all episodes, no 7.5 threshold.

## Features

- **One Tile Per Show** — single row, `org.stremio.sitcomsurprise`
- **True Single Click** — meta returns `videos=[tt:S:E]` + `behaviorHints.defaultVideoId = tt:S:E` → Stremio fetches streams from other addons, `cacheMaxAge:0` for new surprise every open
- **Top % Filter** — leave empty for 100% fully random, or 1-100% by IMDb/TVMaze rating
- **Universal — No AIO** — dropped entirely, works with whatever you have
- **Persistent Cache** — 30 days at `~/.cache/sitcom-shuffle/episodes.json`, memory + file cache, prefetch on manifest/catalog
- **Logo New:** 3D TV surprise gift box — 256x256 16KB, 512x512 66KB, 128x128 6.4KB, tight crop 466x499→square 557 with 6% pad, quantized P mode, transparent corners
- **Default Examples:** Big Bang Theory `tt0898266`, Silicon Valley `tt2575988`, Friends `tt0108778` pre-populated

## Quick Start

- Configurator: https://sitcom-shuffle-surprise.vercel.app/configure/ — search TVmaze, manage favorites, set top %, generate install link
- Manifest: `/<base64url(JSON shows,topPercent)>/manifest.json` → single catalog `shuffle`
- Catalog: `/.../catalog/series/shuffle.json` → tiles with `shuffle:tt...`
- Meta: `/.../meta/series/shuffle:tt....json` → random episode + defaultVideoId
- Stream: returns [] universal mode (other addons handle tt:S:E)

## Tech

- `src/index.js` — express, single catalog handler, meta random picker, logo HTTPS
- `src/config.js` — no AIO, topPercent empty→100
- `src/tvmaze.js` — lookup imdb→tvmaze id, fetch episodes, `filterTopEpisodes` configurable no 7.5, persistent cache 30d
- `public/` — configurator with DEFAULT_SHOWS, optimized logos, vercel.json routes `/logo.png` `/logo-512.png` `/logo-128.png` `/configure/(.*)` → `/public/$1`, catch-all → `src/index.js`
- Tests: 16 pass (config roundtrip, single catalog, no duplicate rows, extra args skip/search, filterTopEpisodes percentages, e2e universal true 1-click)

## Hosting

- Vercel: `sitcom-shuffle-surprise.vercel.app` (project `sitcom-shuffle-surprise`), auto HTTPS, `dpl_5zTgjsUeh9eWsDi4PQq1jbS5bpXK` live verified — manifest 620B, logo.png 16KB, app.js 7.6KB, style.css 6.5KB, favicon.ico → logo.png
- GitHub: https://github.com/vkr1729/sitcom-surprise main `acb006d`

MIT
