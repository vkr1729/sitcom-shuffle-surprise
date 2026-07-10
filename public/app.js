// public/app.js v2 - universal, configurable topPercent
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
  const percentSlider = document.getElementById('percent-slider');
  const percentInput = document.getElementById('percent-input');
  const percentDesc = document.getElementById('percent-desc');
  const percentClearBtn = document.getElementById('percent-clear');
  const testPlayerUrl = document.getElementById('test-player-url');
  const testPlayerBtn = document.getElementById('test-player-btn');

  const favorites = new Map(); // id -> { id, name, poster }

  // --- topPercent handling ---
  let topPercent = 20; // default per user request
  let topPercentIsAll = false;

  function updatePercentDesc() {
    if (topPercentIsAll) {
      percentDesc.textContent = '100% — all episodes, fully random';
      return;
    }
    if (topPercent === 100) {
      percentDesc.textContent = '100% — all rated episodes (★ filtered)';
    } else if (topPercent >= 50) {
      percentDesc.textContent = `Top ${topPercent}% — wide selection, mostly high rated`;
    } else if (topPercent >= 20) {
      percentDesc.textContent = `Top ${topPercent}% rated — minimum 7.5★, then top ${topPercent}%`;
    } else {
      percentDesc.textContent = `Top ${topPercent}% — only the very best episodes`;
    }
  }

  function setTopPercent(v, isAllFlag = false) {
    if (isAllFlag) {
      topPercentIsAll = true;
      topPercent = 100;
      percentSlider.value = 100;
      percentInput.value = '';
      percentInput.placeholder = 'all (100)';
      updatePercentDesc();
      updateInstallBtn();
      return;
    }
    topPercentIsAll = false;
    let num = parseInt(v, 10);
    if (isNaN(num) || num === 0) {
      // empty input => 100% per user requirement: if not populated include all 100%
      if (v === '' || v == null) {
        topPercent = 100;
        percentInput.placeholder = '100';
      } else {
        topPercent = 20;
      }
    } else {
      topPercent = Math.max(1, Math.min(100, num));
    }
    percentSlider.value = topPercent;
    if (document.activeElement !== percentInput) {
      percentInput.value = topPercent;
    }
    updatePercentDesc();
    updateInstallBtn();
  }

  percentSlider.addEventListener('input', (e) => {
    setTopPercent(e.target.value);
    percentInput.value = e.target.value;
  });

  percentInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val === '') {
      setTopPercent(100);
      return;
    }
    setTopPercent(val);
  });

  percentClearBtn.addEventListener('click', () => {
    setTopPercent(null, true);
  });

  updatePercentDesc();

  // --- AIO optional ---
  function getAioBase() {
    let url = aioInput.value.trim();
    if (!url) {
      aioError.textContent = '';
      return null;
    }
    url = url.replace(/\/manifest\.json\s*$/i, '');
    try {
      new URL(url);
      aioError.textContent = '';
      return url;
    } catch {
      aioError.textContent = 'Invalid URL (leave empty for universal mode)';
      return undefined; // invalid
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
        const safeName = escapeHtml(show.name);
        const safePoster = poster.replace(/'/g, '%27');
        return `
          <div class="show-card ${isAdded ? 'added' : ''}" data-id="${imdbId}">
            <div class="poster-wrap">
              ${poster ? `<img src="${poster}" alt="${safeName}" loading="lazy">` : '<div class="no-poster">No Image</div>'}
            </div>
            <div class="show-info">
              <span class="show-title">${safeName}</span>
              <span class="show-year">${year}</span>
            </div>
            <button class="btn-add" onclick="window.__addShow('${imdbId}', '${safeName.replace(/'/g, "\\'")}', '${safePoster}')">
              ${isAdded ? '✓ Added' : '+ Add'}
            </button>
          </div>
        `;
      })
      .join('');
  }

  window.__addShow = function (id, name, poster) {
    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.set(id, { id, name, poster });
    }
    renderFavorites();
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
          <button class="btn-remove" onclick="window.__addShow('${show.id}', '${escapeHtml(show.name).replace(/'/g, "\\'")}', '${show.poster}')">✕ Remove</button>
        </div>
      `
      )
      .join('');
  }

  function updateInstallBtn() {
    const aio = getAioBase();
    const invalidAio = aio === undefined;
    const hasShows = favorites.size > 0;
    installBtn.disabled = !hasShows || invalidAio;
    if (!invalidAio) installOutput.classList.add('hidden');
  }

  installBtn.addEventListener('click', () => {
    const aioBase = getAioBase();
    if (aioBase === undefined) return;
    if (favorites.size === 0) return;

    const config = {
      shows: Array.from(favorites.values()).map((s) => ({ id: s.id, name: s.name })),
      topPercent: topPercentIsAll ? 100 : (topPercent || 100),
    };
    if (aioBase) config.aio = aioBase;

    const encoded = btoa(JSON.stringify(config))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const base = window.location.origin;
    const manifestUrl = `${base}/${encoded}/manifest.json`;
    const stremioUrl = `stremio://${base.replace(/^https?:\/\//, '')}/${encoded}/manifest.json`;

    installLink.href = stremioUrl;
    installUrl.value = manifestUrl;

    // Also generate player test link for first show
    const firstShow = config.shows[0];
    if (firstShow) {
      testPlayerUrl.value = `${base}/${encoded}/player/shuffle:${firstShow.id}`;
    }

    installOutput.classList.remove('hidden');
  });

  copyBtn.addEventListener('click', () => {
    installUrl.select();
    navigator.clipboard.writeText(installUrl.value);
    copyBtn.textContent = '✓ Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
  });

  testPlayerBtn.addEventListener('click', () => {
    if (testPlayerUrl.value) window.open(testPlayerUrl.value, '_blank');
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
