import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  looksLikeScheduleAddress,
  scheduleEntryLabel,
  scheduleEventAddress,
  scheduleTypeLabel,
} from '../src/utils/scheduleEntryLabel.js';

describe('scheduleEntryLabel', () => {
  it('labels shop-closed ahead of status, including sqlite 1 / 0', () => {
    assert.equal(
      scheduleEntryLabel({ is_shop_wide: 1, status: 'rejected', type: 'vacation' }),
      'Shop Closed'
    );
    assert.equal(
      scheduleEntryLabel({ is_shop_wide: 0, status: 'rejected', type: 'vacation' }),
      'Rejected'
    );
  });

  it('prefixes pending requests and shows the approved type without the reason', () => {
    assert.equal(
      scheduleEntryLabel({ status: 'pending', type: 'sick_leave', reason: 'flu' }),
      'Pending Sick Leave'
    );
    assert.equal(
      scheduleEntryLabel({ status: 'approved', type: 'vacation', reason: 'beach' }),
      'Vacation'
    );
  });

  it('uses the reason for other statuses, and the raw type when it is unknown', () => {
    assert.equal(
      scheduleEntryLabel({ status: 'cancelled', type: 'meeting', reason: 'moved' }),
      'moved'
    );
    assert.equal(scheduleEntryLabel({ status: 'cancelled', type: 'meeting', reason: '' }), 'Meeting');
    assert.equal(scheduleTypeLabel('custom_shift'), 'custom_shift');
    assert.equal(
      scheduleEntryLabel({ status: 'pending', type: 'custom_shift' }),
      'Pending custom_shift'
    );
  });
});

describe('looksLikeScheduleAddress', () => {
  it('requires a trimmed length of at least 8 and a digit', () => {
    assert.equal(looksLikeScheduleAddress('  123 Main  '), true);
    assert.equal(looksLikeScheduleAddress('1234567'), false);
    assert.equal(looksLikeScheduleAddress('Main Street'), false);
    assert.equal(looksLikeScheduleAddress(''), false);
    assert.equal(looksLikeScheduleAddress(null), false);
  });
});

describe('scheduleEventAddress', () => {
  it('prefers a trimmed location over notes', () => {
    assert.equal(
      scheduleEventAddress({
        location: '  100 Main St  ',
        notes: 'Location: 9 Other Rd',
      }),
      '100 Main St'
    );
  });

  it('reads the first Location line from notes when location is blank or not a string', () => {
    assert.equal(
      scheduleEventAddress({
        location: '   ',
        notes: 'Bring parts\nLocation:  500 West St  \nGate code 9',
      }),
      '500 West St'
    );
    assert.equal(
      scheduleEventAddress({ location: 0, notes: 'Location: 500 West St' }),
      '500 West St'
    );
  });

  it('returns null when notes have no address line or are not a string', () => {
    assert.equal(scheduleEventAddress({ notes: 'Location:' }), null);
    assert.equal(scheduleEventAddress({ notes: 'No address here' }), null);
    assert.equal(scheduleEventAddress({ notes: null }), null);
    assert.equal(scheduleEventAddress({}), null);
    assert.equal(scheduleEventAddress(null), null);
  });
});
