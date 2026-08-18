import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeQuery,
  isGeocodeAddressTooShort,
  isSuggestQueryTooShort,
  parseNominatimLocation,
  mapNominatimSuggestions,
  parseStreetViewCoords,
  isStreetViewJsonContentType,
} from '../utils/geocodeQueryParse.js';

describe('normalizeQuery', () => {
  it('trims and treats nullish as empty string', () => {
    assert.equal(normalizeQuery('  123 Main St  '), '123 Main St');
    assert.equal(normalizeQuery(undefined), '');
    assert.equal(normalizeQuery(null), '');
  });
});

describe('isGeocodeAddressTooShort', () => {
  it('rejects empty or under 5 characters after trim', () => {
    assert.equal(isGeocodeAddressTooShort('123 Main Street'), false);
    assert.equal(isGeocodeAddressTooShort('1234'), true);
    assert.equal(isGeocodeAddressTooShort('12345'), false);
    assert.equal(isGeocodeAddressTooShort('  ab  '), true);
    assert.equal(isGeocodeAddressTooShort('     '), true);
    assert.equal(isGeocodeAddressTooShort(''), true);
    assert.equal(isGeocodeAddressTooShort(undefined), true);
  });
});

describe('isSuggestQueryTooShort', () => {
  it('rejects empty or under 2 characters after trim (looser than geocode)', () => {
    assert.equal(isSuggestQueryTooShort('H'), true);
    assert.equal(isSuggestQueryTooShort('Ho'), false);
    assert.equal(isSuggestQueryTooShort('  H  '), true);
    assert.equal(isSuggestQueryTooShort(''), true);
    assert.equal(isSuggestQueryTooShort('Houston'), false);
  });
});

describe('parseNominatimLocation', () => {
  it('parses lat/lon and falls back display_name to empty string', () => {
    assert.deepEqual(
      parseNominatimLocation({ lat: '29.76', lon: '-95.36', display_name: 'Houston' }),
      { lat: 29.76, lng: -95.36, display_name: 'Houston' }
    );
    assert.deepEqual(
      parseNominatimLocation({ lat: '0', lon: '0' }),
      { lat: 0, lng: 0, display_name: '' }
    );
  });

  it('returns null when lat or lon is missing or non-numeric', () => {
    assert.equal(parseNominatimLocation({ lat: '29.76', lon: 'west' }), null);
    assert.equal(parseNominatimLocation({ lat: 'north', lon: '-95.36' }), null);
    assert.equal(parseNominatimLocation({ lat: '29.76' }), null);
    assert.equal(parseNominatimLocation(undefined), null);
  });
});

describe('mapNominatimSuggestions', () => {
  it('maps arrays and drops empty names or NaN coords; keeps 0,0', () => {
    const mapped = mapNominatimSuggestions([
      { display_name: 'Houston', lat: '29.76', lon: '-95.36' },
      { display_name: '', lat: '1', lon: '2' },
      { display_name: 'Bad', lat: 'x', lon: '2' },
      { display_name: 'Origin', lat: '0', lon: '0' },
    ]);
    assert.deepEqual(mapped, [
      { display_name: 'Houston', lat: 29.76, lon: -95.36 },
      { display_name: 'Origin', lat: 0, lon: 0 },
    ]);
  });

  it('treats non-arrays as no suggestions', () => {
    assert.deepEqual(mapNominatimSuggestions(null), []);
    assert.deepEqual(mapNominatimSuggestions({ display_name: 'x' }), []);
  });
});

describe('parseStreetViewCoords', () => {
  it('requires both lat and lng to parse as numbers (0 is allowed)', () => {
    assert.deepEqual(parseStreetViewCoords('29.76', '-95.36'), { lat: 29.76, lng: -95.36 });
    assert.deepEqual(parseStreetViewCoords('0', '0'), { lat: 0, lng: 0 });
    assert.equal(parseStreetViewCoords('29.76', undefined), null);
    assert.equal(parseStreetViewCoords('', '-95.36'), null);
    assert.equal(parseStreetViewCoords('lat', 'lng'), null);
    // parseFloat is greedy: trailing junk is ignored
    assert.deepEqual(parseStreetViewCoords('29.76abc', '-95.36'), { lat: 29.76, lng: -95.36 });
  });
});

describe('isStreetViewJsonContentType', () => {
  it('matches application/json case-insensitively as a substring', () => {
    assert.equal(isStreetViewJsonContentType('application/json'), true);
    assert.equal(isStreetViewJsonContentType('Application/JSON; charset=utf-8'), true);
    assert.equal(isStreetViewJsonContentType('image/jpeg'), false);
    assert.equal(isStreetViewJsonContentType(''), false);
    assert.equal(isStreetViewJsonContentType(undefined), false);
  });
});
