import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBookingSlotMinutesFromSetting,
  clampBookingHorizonDaysFromSetting,
  clampBookingBufferMinutesFromSetting
} from '../utils/bookingConfigClamp.js';

describe('clampBookingSlotMinutesFromSetting', () => {
  it('clamps to 15–480 and treats 0/NaN/empty as fallback 30', () => {
    assert.equal(clampBookingSlotMinutesFromSetting('45'), 45);
    assert.equal(clampBookingSlotMinutesFromSetting('5'), 15);
    assert.equal(clampBookingSlotMinutesFromSetting('999'), 480);
    assert.equal(clampBookingSlotMinutesFromSetting('0'), 30);
    assert.equal(clampBookingSlotMinutesFromSetting('abc'), 30);
    assert.equal(clampBookingSlotMinutesFromSetting(''), 30);
    assert.equal(clampBookingSlotMinutesFromSetting(undefined), 30);
  });
});

describe('clampBookingHorizonDaysFromSetting', () => {
  it('clamps to 1–60; 0/NaN fall back to 21; negatives are truthy so min-clamp to 1', () => {
    assert.equal(clampBookingHorizonDaysFromSetting('14'), 14);
    assert.equal(clampBookingHorizonDaysFromSetting('0'), 21);
    assert.equal(clampBookingHorizonDaysFromSetting('-3'), 1);
    assert.equal(clampBookingHorizonDaysFromSetting('90'), 60);
    assert.equal(clampBookingHorizonDaysFromSetting('nope'), 21);
  });
});

describe('clampBookingBufferMinutesFromSetting', () => {
  it('clamps to 0–120; 0 is a valid stored value (|| 0 fallback)', () => {
    assert.equal(clampBookingBufferMinutesFromSetting('0'), 0);
    assert.equal(clampBookingBufferMinutesFromSetting('15'), 15);
    assert.equal(clampBookingBufferMinutesFromSetting('200'), 120);
    assert.equal(clampBookingBufferMinutesFromSetting('abc'), 0);
    assert.equal(clampBookingBufferMinutesFromSetting(''), 0);
  });
});
