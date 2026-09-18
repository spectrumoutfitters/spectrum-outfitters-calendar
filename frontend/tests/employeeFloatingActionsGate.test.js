import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPublicCustomerPath,
  shouldShowClockFab,
  isInventoryPath,
} from '../src/utils/employeeFloatingActionsGate.js';

describe('isPublicCustomerPath', () => {
  it('hides employee FABs on public booking, quote, and pay links', () => {
    assert.equal(isPublicCustomerPath('/book'), true);
    assert.equal(isPublicCustomerPath('/new-client'), true);
    assert.equal(isPublicCustomerPath('/new-customer'), true);
    assert.equal(isPublicCustomerPath('/quote'), true);
    assert.equal(isPublicCustomerPath('/pay/abc123'), true);
    assert.equal(isPublicCustomerPath('/PAY/Token'), true);
  });

  it('does not treat /pay without a token slash or staff routes as public', () => {
    assert.equal(isPublicCustomerPath('/pay'), false);
    assert.equal(isPublicCustomerPath('/dashboard'), false);
    assert.equal(isPublicCustomerPath('/login'), false);
    assert.equal(isPublicCustomerPath('/status/tok'), false);
    assert.equal(isPublicCustomerPath(''), false);
    assert.equal(isPublicCustomerPath(null), false);
  });
});

describe('shouldShowClockFab', () => {
  it('hides clock on login, customer status, and dispatch', () => {
    assert.equal(shouldShowClockFab('/login'), false);
    assert.equal(shouldShowClockFab('/status/abc'), false);
    assert.equal(shouldShowClockFab('/STATUS/abc'), false);
    assert.equal(shouldShowClockFab('/dispatch'), false);
  });

  it('shows clock on staff pages including dashboard and tasks', () => {
    assert.equal(shouldShowClockFab('/dashboard'), true);
    assert.equal(shouldShowClockFab('/tasks'), true);
    assert.equal(shouldShowClockFab('/inventory'), true);
  });
});

describe('isInventoryPath', () => {
  it('matches inventory routes and admin inventory tab', () => {
    assert.equal(isInventoryPath('/inventory'), true);
    assert.equal(isInventoryPath('/Inventory'), true);
    assert.equal(isInventoryPath('/admin', 'tab=inventory'), true);
    assert.equal(isInventoryPath('/admin', '?tab=inventory'), true);
  });

  it('does not match other admin tabs or staff pages', () => {
    assert.equal(isInventoryPath('/admin', 'tab=payroll'), false);
    assert.equal(isInventoryPath('/admin'), false);
    assert.equal(isInventoryPath('/dashboard'), false);
  });
});
