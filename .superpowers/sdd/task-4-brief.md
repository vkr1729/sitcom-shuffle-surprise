# Task 4: Configurator Web Page

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`

**Interfaces:**
- Consumes: TVmaze search API `https://api.tvmaze.com/search/shows?q=...` (client-side fetch)
- Consumes: `encodeConfig()` logic (reimplemented in browser JS via `btoa()`)
- Produces: A beautiful single-page configurator at `/configure` that generates the Stremio install URL

- [ ] **Step 1: Create `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitcom Shuffle — Configure</title>
  <meta name="description" content="Configure your Sitcom Shuffle Stremio addon. Add your favorite TV shows and get one-click random top-rated episode playback.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header class="hero">
      <h1>🎲 Sitcom Shuffle</h1>
      <p class="tagline">One click. Random top-rated episode. Instant play.</p>
    </header>

    <section class="card" id="aio-section">
      <h2>1. AIOStreams URL</h2>
      <p class="hint">Paste your AIOStreams manifest URL (the one you installed in Stremio).</p>
      <input type="url" id="aio-url" placeholder="https://aiostreams.elfhosted.com/abc123/manifest.json" autocomplete="off">
      <p class="error" id="aio-error"></p>
    </section>

    <section class="card" id="search-section">
      <h2>2. Add TV Shows</h2>
      <input type="search" id="search-input" placeholder="Search for a TV show..." autocomplete="off">
      <div id="search-results" class="results-grid"></div>
    </section>

    <section class="card" id="favorites-section">
      <h2>3. My Sitcoms <span class="badge" id="show-count">0</span></h2>
      <div id="favorites-list" class="favorites-grid">
        <p class="empty-state" id="empty-state">No shows added yet. Search above to add your favorites!</p>
      </div>
    </section>

    <section class="card action-card" id="install-section">
      <h2>4. Install Addon</h2>
      <button id="install-btn" class="btn-primary" disabled>Generate Install Link</button>
      <div id="install-output" class="install-output hidden">
        <p>Your addon is ready! Click below to install:</p>
        <a id="install-link" class="btn-install" href="#" target="_blank">🚀 Install in Stremio</a>
        <div class="url-box">
          <input type="text" id="install-url" readonly>
          <button id="copy-btn" class="btn-copy">Copy</button>
        </div>
      </div>
    </section>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/style.css`**

Create a premium dark-themed, glassmorphism-styled CSS file with these design requirements:

**Design tokens:**
- Background: deep gradient from `#0a0a1a` to `#1a1a3e`
- Card backgrounds: `rgba(255,255,255,0.05)` with `backdrop-filter: blur(12px)` and subtle border `rgba(255,255,255,0.1)`
- Accent gradient: `linear-gradient(135deg, #8b5cf6, #06b6d4)` (purple-to-teal) for buttons and highlights
- Font: `'Inter', sans-serif`
- Text: white for headings, `rgba(255,255,255,0.7)` for body text
- Border radius: 16px for cards, 12px for inputs, 8px for buttons

**Layout:**
- `.container`: max-width 900px, centered, padding 2rem
- `.hero h1`: large text with gradient text effect using `-webkit-background-clip: text`
- `.card`: glassmorphism panels with padding 2rem, margin-bottom 1.5rem, rounded corners, subtle shadow
- `.results-grid` and `.favorites-grid`: CSS Grid with `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))` and gap 1rem
- `.show-card`: rounded card with poster image, title overlay at bottom, subtle shadow, `transition: transform 0.2s` with `hover: scale(1.05)`
- `.poster-wrap img`: width 100%, aspect-ratio 2/3, object-fit cover, rounded top corners
- `.show-info`: padding 0.5rem, show title truncated with ellipsis
- `.btn-add`: small green button, `.btn-remove`: small red button
- `.btn-primary`: full-width gradient button with hover brightness effect
- `.btn-install`: large green gradient button
- `.url-box`: flex row with readonly input and copy button
- Input fields: dark background `rgba(255,255,255,0.08)`, white text, focus glow with box-shadow `0 0 0 2px rgba(139,92,246,0.5)`
- `.badge`: small pill with accent background color, font-size 0.8rem
- `.hidden`: `display: none`
- `.error`: red text
- `.empty-state`: centered gray italic text
- `.no-poster`: placeholder div with gray background and centered text
- Mobile responsive: single column grid below 480px

The CSS should be approximately 200-300 lines. Make it look stunning — premium dark mode with smooth transitions and glassmorphism effects.

- [ ] **Step 3: Create `public/app.js`**

```js
// public/app.js
'use strict';
(function () {
  const aioInput = document.getElementById('aio-url');
  const aioError = document.getElementById('aio-error');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const favoritesList = document.getElementById('favorites-list');
  const showCount = document.getElementById('show-count');
  const installBtn = document.getElementById('install-btn');
  const installOutput = document.getElementById('install-output');
  const installLink = document.getElementById('install-link');
  const installUrl = document.getElementById('install-url');
  const copyBtn = document.getElementById('copy-btn');

  const favorites = new Map(); // id → { id, name, poster }

  // --- AIOStreams URL parsing ---
  function getAioBase() {
    let url = aioInput.value.trim();
    if (!url) return null;
    // Strip /manifest.json if present
    url = url.replace(/\/manifest\.json\s*$/i, '');
    try {
      new URL(url);
      aioError.textContent = '';
      return url;
    } catch {
      aioError.textContent = 'Please enter a valid URL.';
      return null;
    }
  }

  aioInput.addEventListener('input', updateInstallBtn);

  // --- Search ---
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchResults.innerHTML = '';
      return;
    }
    searchTimeout = setTimeout(() => searchShows(query), 350);
  });

  async function searchShows(query) {
    try {
      const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      renderSearchResults(data);
    } catch (err) {
      searchResults.innerHTML = '<p class="error">Search failed. Please try again.</p>';
    }
  }

  function renderSearchResults(results) {
    searchResults.innerHTML = results
      .filter((r) => r.show && r.show.externals && r.show.externals.imdb)
      .slice(0, 12)
      .map((r) => {
        const show = r.show;
        const imdbId = show.externals.imdb;
        const poster = show.image ? show.image.medium : '';
        const year = show.premiered ? show.premiered.slice(0, 4) : '?';
        const isAdded = favorites.has(imdbId);
        return `
          <div class="show-card ${isAdded ? 'added' : ''}" data-id="${imdbId}" data-name="${escapeHtml(show.name)}" data-poster="${poster}">
            <div class="poster-wrap">
              ${poster ? `<img src="${poster}" alt="${escapeHtml(show.name)}" loading="lazy">` : '<div class="no-poster">No Image</div>'}
            </div>
            <div class="show-info">
              <span class="show-title">${escapeHtml(show.name)}</span>
              <span class="show-year">${year}</span>
            </div>
            <button class="btn-add" onclick="window.__addShow('${imdbId}', '${escapeHtml(show.name)}', '${poster}')">
              ${isAdded ? '✓ Added' : '+ Add'}
            </button>
          </div>
        `;
      })
      .join('');
  }

  // --- Favorites ---
  window.__addShow = function (id, name, poster) {
    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.set(id, { id, name, poster });
    }
    renderFavorites();
    // Re-render search results to toggle button state
    const query = searchInput.value.trim();
    if (query.length >= 2) searchShows(query);
    updateInstallBtn();
  };

  function renderFavorites() {
    if (favorites.size === 0) {
      favoritesList.innerHTML = '<p class="empty-state">No shows added yet. Search above to add your favorites!</p>';
      showCount.textContent = '0';
      return;
    }
    showCount.textContent = favorites.size;
    favoritesList.innerHTML = Array.from(favorites.values())
      .map(
        (show) => `
        <div class="show-card favorite" data-id="${show.id}">
          <div class="poster-wrap">
            ${show.poster ? `<img src="${show.poster}" alt="${escapeHtml(show.name)}" loading="lazy">` : '<div class="no-poster">No Image</div>'}
          </div>
          <div class="show-info">
            <span class="show-title">${escapeHtml(show.name)}</span>
          </div>
          <button class="btn-remove" onclick="window.__addShow('${show.id}', '${escapeHtml(show.name)}', '${show.poster}')">✕ Remove</button>
        </div>
      `
      )
      .join('');
  }

  // --- Install ---
  function updateInstallBtn() {
    const hasAio = !!getAioBase();
    const hasShows = favorites.size > 0;
    installBtn.disabled = !(hasAio && hasShows);
    installOutput.classList.add('hidden');
  }

  installBtn.addEventListener('click', () => {
    const aioBase = getAioBase();
    if (!aioBase || favorites.size === 0) return;

    const config = {
      aio: aioBase,
      shows: Array.from(favorites.values()).map((s) => ({ id: s.id, name: s.name })),
    };

    const encoded = btoa(JSON.stringify(config))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const base = window.location.origin;
    const manifestUrl = `${base}/${encoded}/manifest.json`;
    const stremioUrl = `stremio://${base.replace(/^https?:\/\//, '')}/${encoded}/manifest.json`;

    installLink.href = stremioUrl;
    installUrl.value = manifestUrl;
    installOutput.classList.remove('hidden');
  });

  copyBtn.addEventListener('click', () => {
    installUrl.select();
    navigator.clipboard.writeText(installUrl.value);
    copyBtn.textContent = '✓ Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
```

- [ ] **Step 4: Verify the configurator page loads**

```bash
PORT=3000 node src/index.js &
sleep 1
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/configure/
kill %1
```

Expected: HTTP status `200`.

- [ ] **Step 5: Commit**

```bash
git add public/
git commit -m "feat: configurator web page with show search and install link generation"
```
