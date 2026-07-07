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
