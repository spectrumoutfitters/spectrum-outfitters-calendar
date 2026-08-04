import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBarcode,
  pickCategoryNameFromItemName,
} from '../utils/inventoryClassify.js';

describe('normalizeBarcode', () => {
  it('returns null for missing / blank values', () => {
    assert.equal(normalizeBarcode(undefined), null);
    assert.equal(normalizeBarcode(null), null);
    assert.equal(normalizeBarcode(''), null);
    assert.equal(normalizeBarcode('   '), null);
  });

  it('trims and keeps non-empty barcodes', () => {
    assert.equal(normalizeBarcode('  ABC-123  '), 'ABC-123');
    assert.equal(normalizeBarcode(12345), '12345');
  });
});

describe('pickCategoryNameFromItemName', () => {
  it('classifies oils and fluids (including oil filter via oil keyword)', () => {
    assert.equal(pickCategoryNameFromItemName('Motorcraft Oil Filter'), 'Oils & Fluids');
    assert.equal(pickCategoryNameFromItemName('Brake Fluid DOT 3'), 'Oils & Fluids');
    assert.equal(pickCategoryNameFromItemName('ATF Mercon LV'), 'Oils & Fluids');
    assert.equal(pickCategoryNameFromItemName('5 qt coolant'), 'Oils & Fluids');
  });

  it('classifies cleaning products', () => {
    assert.equal(pickCategoryNameFromItemName('Fabuloso All Purpose'), 'Cleaning');
    assert.equal(pickCategoryNameFromItemName('Engine Degreaser'), 'Cleaning');
  });

  it('classifies spray paint and coatings', () => {
    assert.equal(pickCategoryNameFromItemName('Rustoleum Flat Black'), 'Spray Paint & Coatings');
    assert.equal(pickCategoryNameFromItemName('Clear Coat Aerosol'), 'Spray Paint & Coatings');
  });

  it('classifies filters that do not contain oil keywords', () => {
    assert.equal(pickCategoryNameFromItemName('Cabin Air Filter'), 'Filters');
    assert.equal(pickCategoryNameFromItemName('Fuel Filter'), 'Filters');
  });

  it('prefers Parts over Fasteners for washer pump', () => {
    assert.equal(pickCategoryNameFromItemName('Washer Pump'), 'Parts');
    assert.equal(pickCategoryNameFromItemName('ABS Sensor'), 'Parts');
  });

  it('classifies fasteners and belts/hoses', () => {
    assert.equal(pickCategoryNameFromItemName('Flat Washer 8mm'), 'Fasteners');
    assert.equal(pickCategoryNameFromItemName('M8 Bolt'), 'Fasteners');
    assert.equal(pickCategoryNameFromItemName('Serpentine Belt'), 'Belts & Hoses');
    assert.equal(pickCategoryNameFromItemName('Radiator Hose'), 'Belts & Hoses');
  });

  it('falls back to Other for unknown names', () => {
    assert.equal(pickCategoryNameFromItemName('Mystery Widget'), 'Other');
    assert.equal(pickCategoryNameFromItemName(''), 'Other');
    assert.equal(pickCategoryNameFromItemName(null), 'Other');
  });
});
