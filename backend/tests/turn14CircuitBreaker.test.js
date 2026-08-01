import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCircuitBreaker,
  createCircuitBreakerState,
  recordFailure,
  recordSuccess
} from '../utils/turn14CircuitBreaker.js';

describe('turn14CircuitBreaker', () => {
  it('opens after three consecutive failures and blocks calls during cooldown', () => {
    const state = createCircuitBreakerState({ cooldownMs: 60_000, failureThreshold: 3 });
    let now = 1_000_000;

    recordFailure(state, () => now);
    recordFailure(state, () => now);
    assert.equal(state.isOpen, false);

    recordFailure(state, () => now);
    assert.equal(state.isOpen, true);
    assert.equal(state.failures, 3);

    assert.throws(
      () => checkCircuitBreaker(state, () => now),
      /temporarily disabled due to repeated failures/
    );
  });

  it('resets after cooldown elapses so calls can retry', () => {
    const state = createCircuitBreakerState({ cooldownMs: 1_000, failureThreshold: 3 });
    let now = 5_000;
    recordFailure(state, () => now);
    recordFailure(state, () => now);
    recordFailure(state, () => now);
    assert.equal(state.isOpen, true);

    now = 6_001;
    checkCircuitBreaker(state, () => now);
    assert.equal(state.isOpen, false);
    assert.equal(state.failures, 0);
  });

  it('recordSuccess clears an open breaker immediately', () => {
    const state = createCircuitBreakerState({ failureThreshold: 2 });
    recordFailure(state);
    recordFailure(state);
    assert.equal(state.isOpen, true);

    recordSuccess(state);
    assert.equal(state.isOpen, false);
    assert.equal(state.failures, 0);
    assert.doesNotThrow(() => checkCircuitBreaker(state));
  });
});
