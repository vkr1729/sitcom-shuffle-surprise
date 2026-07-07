// src/tvmaze.js
'use strict';
const fetch = require('node-fetch');

// In-memory cache: { [imdbId]: { episodes: [...], cachedAt: timestamp } }
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function lookupShowId(imdbId) {
  const res = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`);
  if (!res.ok) {
    throw new Error(`TVmaze lookup failed for ${imdbId}: ${res.status}`);
  }
  const show = await res.json();
  return show.id;
}

async function fetchAllEpisodes(tvmazeId) {
  const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/episodes`);
  if (!res.ok) {
    throw new Error(`TVmaze episodes fetch failed for show ${tvmazeId}: ${res.status}`);
  }
  return res.json();
}

function filterTopEpisodes(episodes) {
  // Step 1: Filter episodes that have ratings
  const rated = episodes.filter(
    (ep) => ep.rating && ep.rating.average != null && ep.type === 'regular'
  );

  if (rated.length === 0) return [];

  // Step 2: Try hybrid filter — minimum 7.5 AND top 20%
  const aboveThreshold = rated.filter((ep) => ep.rating.average >= 7.5);

  let pool;
  if (aboveThreshold.length === 0) {
    // Fallback: top 20% regardless of rating
    pool = rated;
  } else {
    pool = aboveThreshold;
  }

  // Step 3: Sort descending by rating, take top 20%
  pool.sort((a, b) => b.rating.average - a.rating.average);
  const cutoff = Math.max(1, Math.ceil(pool.length * 0.2));
  const topEpisodes = pool.slice(0, cutoff);

  return topEpisodes.map((ep) => ({
    season: ep.season,
    number: ep.number,
    name: ep.name || `Episode ${ep.number}`,
    rating: ep.rating.average,
  }));
}

async function getTopEpisodes(imdbId) {
  // Check cache
  const cached = cache.get(imdbId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.episodes;
  }

  const tvmazeId = await lookupShowId(imdbId);
  const allEpisodes = await fetchAllEpisodes(tvmazeId);
  const top = filterTopEpisodes(allEpisodes);

  cache.set(imdbId, { episodes: top, cachedAt: Date.now() });
  return top;
}

async function pickRandomEpisode(imdbId) {
  const top = await getTopEpisodes(imdbId);
  if (top.length === 0) {
    throw new Error(`No rated episodes found for ${imdbId}`);
  }
  const idx = Math.floor(Math.random() * top.length);
  return top[idx];
}

// Exported for testing
module.exports = { getTopEpisodes, pickRandomEpisode, filterTopEpisodes, _cache: cache };
