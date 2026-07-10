// tests/tvmaze.test.js v2
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
    id: season * 100 + number,
  };
}

describe('filterTopEpisodes', () => {
  it('returns top 20% of episodes rated >= 7.5 (default behavior)', () => {
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

    const result = filterTopEpisodes(episodes, 20);

    // 7 episodes are >= 7.5, top 20% of 7 = ceil(1.4) = 2
    assert.equal(result.length, 2);
    assert.equal(result[0].rating, 9.5);
    assert.equal(result[1].rating, 9.0);
  });

  it('returns 100% when topPercent not populated (user requirement)', () => {
    const episodes = [
      makeEp(1, 1, 5.0),
      makeEp(1, 2, 6.0),
      makeEp(1, 3, 7.0),
      makeEp(1, 4, 8.0),
    ];

    const resultUndef = filterTopEpisodes(episodes);
    const resultNull = filterTopEpisodes(episodes, null);
    const resultEmpty = filterTopEpisodes(episodes, '');

    assert.equal(resultUndef.length, 4);
    assert.equal(resultNull.length, 4);
    assert.equal(resultEmpty.length, 4);
  });

  it('returns 100% including unrated when topPercent=100', () => {
    const episodes = [
      makeEp(1, 1, 9.0),
      makeEp(1, 2, null),
      { season: 1, number: 3, name: 'Pilot', type: 'regular', rating: { average: null }, id: 3 },
    ];

    const result = filterTopEpisodes(episodes, 100);
    assert.equal(result.length, 3); // all regular including null rating
    assert.equal(result[0].rating, 9.0); // highest first
  });

  it('falls back to top 20% when no episodes >= 7.5', () => {
    const episodes = [
      makeEp(1, 1, 5.0),
      makeEp(1, 2, 5.5),
      makeEp(1, 3, 6.0),
      makeEp(1, 4, 6.5),
      makeEp(1, 5, 7.0),
    ];

    const result = filterTopEpisodes(episodes, 20);

    assert.equal(result.length, 1);
    assert.equal(result[0].rating, 7.0);
  });

  it('excludes specials (non-regular episodes)', () => {
    const episodes = [
      makeEp(0, 1, 9.5, 'special'),
      makeEp(1, 1, 8.0),
      makeEp(1, 2, 8.5),
    ];

    const result = filterTopEpisodes(episodes, 20);

    assert.equal(result.length, 1);
    assert.equal(result[0].rating, 8.5);
    assert.equal(result[0].season, 1);
  });

  it('returns empty array when no rated episodes and topPercent <100', () => {
    const episodes = [
      { season: 1, number: 1, name: 'Pilot', type: 'regular', rating: { average: null }, id: 1 },
    ];

    const result = filterTopEpisodes(episodes, 20);
    assert.equal(result.length, 0);
  });

  it('returns at least 1 episode even for small pools', () => {
    const episodes = [makeEp(1, 1, 9.0)];
    const result = filterTopEpisodes(episodes, 20);
    assert.equal(result.length, 1);
  });

  it('supports configurable percentage', () => {
    const episodes = [];
    for (let i = 1; i <= 10; i++) episodes.push(makeEp(1, i, i));

    const top20 = filterTopEpisodes(episodes, 20);
    const top50 = filterTopEpisodes(episodes, 50);
    const top100 = filterTopEpisodes(episodes, 100);

    // rated all, >=7.5 are 8,9,10 => pool 3, 20% => ceil(0.6)=1
    assert.equal(top20.length, 1);
    // 50% of 3 => ceil(1.5)=2
    assert.equal(top50.length, 2);
    // 100% of 10? Actually after hybrid filter fallback? Let's use 100% includes all
    // For 100% path we include all 10
    assert.equal(top100.length, 10);
  });
});
