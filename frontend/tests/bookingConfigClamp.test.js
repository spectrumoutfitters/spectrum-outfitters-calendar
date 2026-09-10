import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBookingSlotMinutesFromConfig,
  clampBookingHorizonDaysFromConfig,
  clampBookingBufferMinutesFromConfig
} from '../src/utils/bookingConfigClamp.js';

describe('booking config hydrate clamps (`??` then min/max)', () => {
  it('slot: 0 stays then min-clamps to 15 (unlike backend parseInt|| 30)', () => {
    assert.equal(clampBookingSlotMinutesFromConfig(45), 45);
    assert.equal(clampBookingSlotMinutesFromConfig(0), 15);
    assert.equal(clampBookingSlotMinutesFromConfig(null), 30);
    assert.equal(clampBookingSlotMinutesFromConfig(undefined), 30);
    assert.equal(clampBookingSlotMinutesFromConfig(5), 15);
    assert.equal(clampBookingSlotMinutesFromConfig(999), 480);
  });

  it('horizon: 0 min-clamps to 1; null/undefined fallback 21', () => {
    assert.equal(clampBookingHorizonDaysFromConfig(14), 14);
    assert.equal(clampBookingHorizonDaysFromConfig(0), 1);
    assert.equal(clampBookingHorizonDaysFromConfig(null), 21);
    assert.equal(clampBookingHorizonDaysFromConfig(90), 60);
  });

  it('buffer: 0 is valid; null/undefined fallback 0; max 120', () => {
    assert.equal(clampBookingBufferMinutesFromConfig(0), 0);
    assert.equal(clampBookingBufferMinutesFromConfig(null), 0);
    assert.equal(clampBookingBufferMinutesFromConfig(15), 15);
    assert.equal(clampBookingBufferMinutesFromConfig(200), 120);
  });
});
