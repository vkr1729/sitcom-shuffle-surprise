// tests/tvmaze.test.js
'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { filterTopEpisodes } = require('../src/tvmaze');

function makeEp(season, number, rating, type = 'regular') {
  return {
    season,
    number,
    name: `S${season}E${number}`,
    type,
    rating: { average: rating },
  };
}

describe('filterTopEpisodes', () => {
  it('returns top 20% of episodes rated >= 7.5', () => {
    // 10 episodes: ratings 6.0, 6.5, 7.0, 7.5, 8.0, 8.2, 8.5, 8.8, 9.0, 9.5
    const episodes = [
      makeEp(1, 1, 6.0),
      makeEp(1, 2, 6.5),
      makeEp(1, 3, 7.0),
      makeEp(1, 4, 7.5),
      makeEp(1, 5, 8.0),
      makeEp(1, 6, 8.2),
      makeEp(1, 7, 8.5),
      makeEp(1, 8, 8.8),
      makeEp(1, 9, 9.0),
      makeEp(1, 10, 9.5),
    ];

    const result = filterTopEpisodes(episodes);

    // 7 episodes are >= 7.5, top 20% of 7 = ceil(1.4) = 2
    assert.equal(result.length, 2);
    assert.equal(result[0].rating, 9.5);
    assert.equal(result[1].rating, 9.0);
  });

  it('falls back to top 20% when no episodes >= 7.5', () => {
    const episodes = [
      makeEp(1, 1, 5.0),
      makeEp(1, 2, 5.5),
      makeEp(1, 3, 6.0),
      makeEp(1, 4, 6.5),
      makeEp(1, 5, 7.0),
    ];

    const result = filterTopEpisodes(episodes);

    // All below 7.5 → fallback to top 20% of all 5 = ceil(1) = 1
    assert.equal(result.length, 1);
    assert.equal(result[0].rating, 7.0);
  });

  it('excludes specials (non-regular episodes)', () => {
    const episodes = [
      makeEp(0, 1, 9.5, 'special'),
      makeEp(1, 1, 8.0),
      makeEp(1, 2, 8.5),
    ];

    const result = filterTopEpisodes(episodes);

    // Special excluded, 2 regular eps >= 7.5, top 20% of 2 = ceil(0.4) = 1
    assert.equal(result.length, 1);
    assert.equal(result[0].rating, 8.5);
    assert.equal(result[0].season, 1);
  });

  it('returns empty array when no rated episodes', () => {
    const episodes = [
      { season: 1, number: 1, name: 'Pilot', type: 'regular', rating: { average: null } },
    ];

    const result = filterTopEpisodes(episodes);
    assert.equal(result.length, 0);
  });

  it('returns at least 1 episode even for small pools', () => {
    const episodes = [makeEp(1, 1, 9.0)];
    const result = filterTopEpisodes(episodes);
    assert.equal(result.length, 1);
  });
});
