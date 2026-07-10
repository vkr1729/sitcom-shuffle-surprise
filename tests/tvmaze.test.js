'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { filterTopEpisodes } = require('../src/tvmaze');

function makeEp(s, n, r, type = 'regular') {
  return { season: s, number: n, name: `S${s}E${n}`, type, rating: { average: r }, id: s * 100 + n };
}

describe('filterTopEpisodes no 7.5 filter', () => {
  it('returns top 20% by rating only, no 7.5 threshold', () => {
    const eps = [
      makeEp(1, 1, 6.0), makeEp(1, 2, 6.5), makeEp(1, 3, 7.0), makeEp(1, 4, 7.5),
      makeEp(1, 5, 8.0), makeEp(1, 6, 8.2), makeEp(1, 7, 8.5), makeEp(1, 8, 8.8),
      makeEp(1, 9, 9.0), makeEp(1, 10, 9.5),
    ];
    const result = filterTopEpisodes(eps, 20);
    // 10 eps, top 20% = 2 highest rated 9.5, 9.0
    assert.equal(result.length, 2);
    assert.equal(result[0].rating, 9.5);
    assert.equal(result[1].rating, 9.0);
  });

  it('returns 100% when not populated', () => {
    const eps = [makeEp(1, 1, 5), makeEp(1, 2, 6)];
    assert.equal(filterTopEpisodes(eps).length, 2);
    assert.equal(filterTopEpisodes(eps, null).length, 2);
    assert.equal(filterTopEpisodes(eps, '').length, 2);
  });

  it('includes unrated when 100%', () => {
    const eps = [makeEp(1, 1, 9.0), makeEp(1, 2, null)];
    const result = filterTopEpisodes(eps, 100);
    assert.equal(result.length, 2);
  });

  it('configurable percentages', () => {
    const eps = [];
    for (let i = 1; i <= 10; i++) eps.push(makeEp(1, i, i));
    assert.equal(filterTopEpisodes(eps, 20).length, 2);
    assert.equal(filterTopEpisodes(eps, 50).length, 5);
    assert.equal(filterTopEpisodes(eps, 100).length, 10);
  });

  it('excludes specials', () => {
    const eps = [makeEp(0, 1, 9.5, 'special'), makeEp(1, 1, 8.0), makeEp(1, 2, 8.5)];
    const result = filterTopEpisodes(eps, 50);
    assert.equal(result.length, 1);
  });
});
