import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coercePhotoType,
  coercePhotoCaption,
  parsePhotoRouteId,
  isInvalidTaskPhotoReadId,
  isInvalidTaskPhotoDeleteIds,
} from '../utils/taskPhotoUploadMath.js';

describe('coercePhotoType', () => {
  it('keeps only the exact whitelist and otherwise stores other', () => {
    assert.equal(coercePhotoType('before'), 'before');
    assert.equal(coercePhotoType('after'), 'after');
    assert.equal(coercePhotoType('progress'), 'progress');
    assert.equal(coercePhotoType('other'), 'other');
    assert.equal(coercePhotoType('Before'), 'other');
    assert.equal(coercePhotoType('AFTER'), 'other');
    assert.equal(coercePhotoType(''), 'other');
    assert.equal(coercePhotoType(undefined), 'other');
    assert.equal(coercePhotoType('damage'), 'other');
  });
});

describe('coercePhotoCaption', () => {
  it('nulls falsy captions and clamps truthy values to 500 trimmed chars', () => {
    assert.equal(coercePhotoCaption('  cracked bumper  '), 'cracked bumper');
    assert.equal(coercePhotoCaption(''), null);
    assert.equal(coercePhotoCaption(null), null);
    assert.equal(coercePhotoCaption(undefined), null);
    assert.equal(coercePhotoCaption(0), null);
    assert.equal(coercePhotoCaption('   '), '');
    const long = 'x'.repeat(600);
    assert.equal(coercePhotoCaption(long).length, 500);
  });
});

describe('parsePhotoRouteId', () => {
  it('uses Number() coercion including hex and scientific notation', () => {
    assert.equal(parsePhotoRouteId('12'), 12);
    assert.equal(parsePhotoRouteId('0'), 0);
    assert.equal(Number.isNaN(parsePhotoRouteId('abc')), true);
    assert.equal(parsePhotoRouteId('1e2'), 100);
    assert.equal(parsePhotoRouteId('0x10'), 16);
    assert.equal(parsePhotoRouteId(''), 0);
  });
});

describe('isInvalidTaskPhotoReadId', () => {
  it('rejects falsy or non-finite ids on GET/POST', () => {
    assert.equal(isInvalidTaskPhotoReadId(12), false);
    assert.equal(isInvalidTaskPhotoReadId(0), true);
    assert.equal(isInvalidTaskPhotoReadId(NaN), true);
    assert.equal(isInvalidTaskPhotoReadId(Infinity), true);
    assert.equal(isInvalidTaskPhotoReadId(-3), false);
  });
});

describe('isInvalidTaskPhotoDeleteIds', () => {
  it('only checks truthiness, so Infinity would pass unlike GET/POST', () => {
    assert.equal(isInvalidTaskPhotoDeleteIds(12, 4), false);
    assert.equal(isInvalidTaskPhotoDeleteIds(0, 4), true);
    assert.equal(isInvalidTaskPhotoDeleteIds(12, 0), true);
    assert.equal(isInvalidTaskPhotoDeleteIds(NaN, 4), true);
    assert.equal(isInvalidTaskPhotoDeleteIds(Infinity, 4), false);
    assert.equal(isInvalidTaskPhotoDeleteIds(12, Infinity), false);
  });
});
