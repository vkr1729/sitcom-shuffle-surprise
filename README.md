# 🎲 Sitcom Shuffle: Single Click Surprise

One tile per TV show in Stremio. Single click → surprise random episode plays directly. No browsing, no picking.

![Logo](public/logo.png)

**Hosted securely at:** https://sitcom-shuffle-surprise.vercel.app

## Features

- **One Tile Per Show** — each series appears as one tile in Stremio
- **True Single Click** — `defaultVideoId` makes Stremio jump directly to random episode, no season selector
- **Configurable Top %** — default 20% top rated, leave empty for 100% all episodes (per requirement)
- **Universal — No AIO Required** — works with your existing TorBox, Real-Debrid, AIOStreams installations
- **Persistent Cache** — episodes fetched once per series from TVmaze, cached 30 days on disk + memory (`~/.cache/sitcom-shuffle/episodes.json`), instant random picks (<1ms)
- **Amazing Logo** — dice inside TV + gift box surprise theme, NOT a series logo

## Quick Start (Big Bang Theory)

Universal (all episodes):
```
https://sitcom-shuffle-surprise.vercel.app/eyJzaG93cyI6W3siaWQiOiJ0dDA4OTgyNjYiLCJuYW1lIjoiVGhlIEJpZyBCYW5nIFRoZW9yeSJ9XX0/manifest.json
```

Top 20% rated (your original criteria):
```
https://sitcom-shuffle-surprise.vercel.app/eyJzaG93cyI6W3siaWQiOiJ0dDA4OTgyNjYiLCJuYW1lIjoiVGhlIEJpZyBCYW5nIFRoZW9yeSJ9XSwidG9wUGVyY2VudCI6MjB9/manifest.json
```

- **Configurator:** https://sitcom-shuffle-surprise.vercel.app/configure/
- **Stremio Web Install:** `https://web.stremio.com/#/addons?addon=<encoded manifest url>`
- **Stremio App:** Paste `stremio://sitcom-shuffle-surprise.vercel.app/.../manifest.json`

## How It Works

1. Catalog returns one `series` tile per show: `shuffle:tt0898266`
2. Meta handler picks random episode from persistent cache: returns single video `tt0898266:S:E` + `behaviorHints.defaultVideoId`
3. Stremio sees `defaultVideoId` and jumps directly to that video's streams from *your other installed addons* (TorBox, etc.) → one click play
4. `cacheMaxAge: 0` ensures new random on every tile open

## Endpoints

- `/:config/manifest.json` — manifest with themed dice logo (HTTPS)
- `/:config/catalog/series/shuffle_series.json` — one tile per show
- `/:config/meta/series/shuffle:ttXXX.json` — single random video + defaultVideoId
- `/:config/player/shuffle:ttXXX` — direct HTML5 player (requires AIO), playable in Chrome, copy URL for celluloid/mpv
- `/:config/play/shuffle:ttXXX?format=json` — returns stream URL for `celluloid` or `mpv`

## Celluloid / MPV Direct Play

With AIO configured:
```bash
# Get direct URL
curl "https://sitcom-shuffle-surprise.vercel.app/<config>/play/shuffle:tt0898266?format=json" | jq -r .url
# Play in celluloid
celluloid $(curl -s ... | jq -r .url)
# Or mpv
mpv $(curl -s ... | jq -r .url)
```

Universal mode: video ID `tt0898266:S:E` is returned, use your Stremio addons or player endpoint which shows video ID.

## Development

```bash
npm install
npm run dev
npm test   # 22 tests pass
```

## Secure Hosting

- **Vercel (current):** https://sitcom-shuffle-surprise.vercel.app — free, HTTPS auto, managed TLS, DDoS protection
- **Beamup (Stremio):** `a.baby-beamup.club` — free, designed for Stremio addons, HTTPS
- **Cloudflare Workers:** free 100k req/day, edge cache, KV for persistent cache
- **Render / Fly / Railway:** all support Node + Express + PORT env, free HTTPS

Repo: https://github.com/vkr1729/sitcom-shuffle-surprise

## Top % Filter Logic

- If not populated → 100% all episodes (per your requirement)
- 20% (default in UI) → filter ≥7.5★, then top 20% by rating
- 100% → include all regular episodes including unrated, sorted by rating desc
- Configurable via slider 1-100 or clear to all

## License

MIT
