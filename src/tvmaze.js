// src/tvmaze.js - Persistent cache + configurable top%
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Config ---
// For completed series ratings rarely change, so cache for 30 days
// But keep a short memory for active shows? We use 30 days to satisfy user's "load once and forget"
let CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days persistent
const MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // same in memory

// Persistent cache location: ~/.cache/sitcom-shuffle/episodes.json or project ./cache/
function getCacheFilePath() {
  try {
    const xdg = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
    const dir = path.join(xdg, 'sitcom-shuffle');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'episodes.json');
  } catch {
    const fallbackDir = path.join(__dirname, '..', 'cache');
    try { fs.mkdirSync(fallbackDir, { recursive: true }); } catch {}
    return path.join(fallbackDir, 'episodes.json');
  }
}

const CACHE_FILE = getCacheFilePath();

// In-memory cache: Map<imdbId: "ttXXX:tp", { episodes, cachedAt, topPercent, allEpisodesRawCount? }>
const memoryCache = new Map();
let fileCacheLoaded = false;

// Load file cache into memory on startup
function loadFileCache() {
  if (fileCacheLoaded) return;
  fileCacheLoaded = true;
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const now = Date.now();
    let loaded = 0, expired = 0;
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry || !Array.isArray(entry.episodes)) continue;
      // Keep if not expired (30 days)
      if (now - (entry.cachedAt || 0) < CACHE_TTL_MS) {
        memoryCache.set(key, entry);
        loaded++;
      } else {
        expired++;
      }
    }
    console.log(`[TVMaze] Loaded ${loaded} entries from persistent cache (${expired} expired) — ${CACHE_FILE}`);
  } catch (e) {
    console.warn(`[TVMaze] Failed to load file cache: ${e.message}`);
  }
}

function saveFileCache() {
  try {
    // Convert memoryCache to plain object, but filter only valid entries
    const obj = {};
    for (const [k, v] of memoryCache.entries()) {
      if (v && v.episodes && v.cachedAt) obj[k] = v;
    }
    // Atomic write: write to temp then rename
    const tmp = CACHE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, CACHE_FILE);
  } catch (e) {
    console.warn(`[TVMaze] Failed to save file cache: ${e.message}`);
  }
}

// Debounced save to avoid frequent disk writes
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveFileCache();
  }, 1000);
}

async function lookupShowId(imdbId) {
  const res = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`TVmaze lookup failed for ${imdbId}: ${res.status}`);
  const show = await res.json();
  return show.id;
}

async function fetchAllEpisodes(tvmazeId) {
  const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/episodes`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`TVmaze episodes fetch failed for show ${tvmazeId}: ${res.status}`);
  return res.json();
}

/**
 * Filter episodes to top X% by rating.
 * If topPercent is null/undefined/100 -> include 100% of videos (per user request)
 * @param {Array} episodes - raw TVmaze episode objects
 * @param {number|null|undefined} topPercent - 1-100, default 20, null/undefined => 100%
 */
function filterTopEpisodes(episodes, topPercent) {
  // If not populated, include all 100%
  let tp;
  if (topPercent == null || topPercent === '' || String(topPercent).toLowerCase() === 'all') {
    tp = 100;
  } else {
    tp = Math.round(Number(topPercent));
    if (!Number.isFinite(tp) || tp < 1) tp = 20;
    if (tp > 100) tp = 100;
  }

  const pct = tp / 100;

  // Step 1: Only rated regular episodes, unless tp=100 where we include unrated too? User said 100% of videos -> include all regular
  let rated = episodes.filter(ep => ep.type === 'regular');
  // For <100%, we still require rating
  if (tp < 100) {
    rated = rated.filter(ep => ep.rating && ep.rating.average != null);
    if (rated.length === 0) return [];
    // Hybrid: prefer >=7.5 fallback to all rated
    const above = rated.filter(ep => ep.rating.average >= 7.5);
    let pool = above.length > 0 ? above : rated;
    pool.sort((a, b) => b.rating.average - a.rating.average);
    const cutoff = Math.max(1, Math.ceil(pool.length * pct));
    const top = pool.slice(0, cutoff);
    return top.map(ep => ({
      season: ep.season,
      number: ep.number,
      name: ep.name || `Episode ${ep.number}`,
      rating: ep.rating.average,
      id: ep.id,
    }));
  } else {
    // tp=100: include ALL regular episodes, sorted by rating desc but include unrated at end
    // Still provide rating field even if null
    rated.sort((a, b) => {
      const ra = a.rating?.average ?? -1;
      const rb = b.rating?.average ?? -1;
      return rb - ra;
    });
    return rated.map(ep => ({
      season: ep.season,
      number: ep.number,
      name: ep.name || `Episode ${ep.number}`,
      rating: ep.rating?.average ?? null,
      id: ep.id,
    }));
  }
}

function cacheKey(imdbId, topPercent) {
  let tp;
  if (topPercent == null || topPercent === '') tp = 100;
  else {
    tp = Math.round(Number(topPercent));
    if (!Number.isFinite(tp)) tp = 20;
    if (tp < 1) tp = 1;
    if (tp > 100) tp = 100;
  }
  return `${imdbId}:${tp}`;
}

async function getTopEpisodes(imdbId, topPercent = 20) {
  loadFileCache();

  let tp;
  if (topPercent == null || topPercent === '') tp = 100;
  else {
    tp = Math.round(Number(topPercent));
    if (!Number.isFinite(tp) || tp < 1) tp = 1;
    if (tp > 100) tp = 100;
    if (topPercent == null) tp = 20;
  }
  // Actually per latest: if not populated include 100%
  // The caller for undefined should be 100. Only default 20 when explicitly set via UI.
  // We'll treat 20 as default only when no config at all. If caller passes undefined we treat as 100 to satisfy user.
  // To differentiate: getTopEpisodes called with undefined => 100%
  // But we still support 20 default in wrapper
  if (arguments.length === 1 || topPercent === undefined) {
    tp = 100;
  }

  const key = cacheKey(imdbId, tp);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.cachedAt < MEMORY_TTL_MS) {
    return cached.episodes;
  }

  // Cache miss -> fetch
  console.log(`[TVMaze] CACHE MISS for ${imdbId} top=${tp}% — fetching from API`);
  const tvmazeId = await lookupShowId(imdbId);
  const allEpisodes = await fetchAllEpisodes(tvmazeId);
  const top = filterTopEpisodes(allEpisodes, tp);

  const entry = { episodes: top, cachedAt: Date.now(), topPercent: tp, totalEpisodes: allEpisodes.length };
  memoryCache.set(key, entry);
  scheduleSave();

  console.log(`[TVMaze] Cached ${top.length}/${allEpisodes.length} episodes for ${imdbId} (top ${tp}%)`);

  // Also populate caches for other common percentages proactively? No, to save API calls we only cache requested
  // But we can pre-cache 100% alongside 20% if someone requested 20% — we already have allEpisodes
  // So we can generate 100% cache for free
  if (tp !== 100) {
    const allKey = cacheKey(imdbId, 100);
    if (!memoryCache.has(allKey)) {
      const allTop = filterTopEpisodes(allEpisodes, 100);
      memoryCache.set(allKey, { episodes: allTop, cachedAt: Date.now(), topPercent: 100, totalEpisodes: allEpisodes.length });
      scheduleSave();
    }
  }

  return top;
}

async function pickRandomEpisode(imdbId, topPercent) {
  // If topPercent not provided => 100% per user request
  const effectiveTp = topPercent == null || topPercent === '' ? 100 : topPercent;
  const top = await getTopEpisodes(imdbId, effectiveTp);
  if (top.length === 0) throw new Error(`No episodes found for ${imdbId}`);
  const idx = Math.floor(Math.random() * top.length);
  return top[idx];
}

// Pre-warm helper for server startup - loads from file cache sync, no network
function preloadCache(showIds = []) {
  loadFileCache();
  // Return which ids are missing from cache and need fetching
  const missing = [];
  for (const id of showIds) {
    // Check if we have at least 100% cached
    const key = cacheKey(id, 100);
    if (!memoryCache.has(key)) missing.push(id);
  }
  return missing;
}

module.exports = {
  getTopEpisodes,
  pickRandomEpisode,
  filterTopEpisodes,
  _cache: memoryCache,
  _loadFileCache: loadFileCache,
  _saveFileCache: saveFileCache,
  _preloadCache: preloadCache,
  _getCacheFile: getCacheFilePath,
};
