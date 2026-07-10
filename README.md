# 🎁 Sitcom Surprise

One tile per TV show in Stremio. Single click → surprise random episode plays directly. No browsing, no picking.

![Logo](public/logo.png)

**Hosted securely at:** https://sitcom-shuffle-surprise.vercel.app (will be renamed to sitcom-surprise.vercel.app)

> Renamed from Sitcom Shuffle to Sitcom Surprise to avoid conflict. Logo by Gemini Nano Banana (cropped to tight badge, transparent corners, 19KB).

## Features

- **One Tile Per Show** — single row in Stremio, one tile per series
- **True Single Click** — `defaultVideoId` jumps directly to random episode's streams from your existing addons (TorBox, RD, etc.)
- **Top % Filter** — leave empty for 100% all episodes, or 1-100% by rating (no 7.5 threshold)
- **Universal — No AIO** — works with whatever you already have
- **Persistent Cache** — 30 days, instant random after first load
- **Logo:** 256x256 PNG 19KB, 512x512 60KB, transparent corners, soft shadow for visibility on white/dark

## Quick Start

- Configurator: `/configure/`
- Manifest: `/<base64config>/manifest.json`
- Catalog: `shuffle` (series only)

## Hosting

- Vercel: auto HTTPS, current `sitcom-shuffle-surprise.vercel.app` → will alias to `sitcom-surprise.vercel.app` after rename
- GitHub: https://github.com/vkr1729/sitcom-surprise

MIT
