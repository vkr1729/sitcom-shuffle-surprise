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
