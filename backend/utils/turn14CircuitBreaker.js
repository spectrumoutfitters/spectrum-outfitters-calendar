/**
 * Turn14 API circuit breaker — pure state machine with injectable clock.
 * After `failureThreshold` consecutive failures, opens for `cooldownMs`.
 */

export const DEFAULT_COOLDOWN_MS = 60_000;
export const DEFAULT_FAILURE_THRESHOLD = 3;

export function createCircuitBreakerState({
  cooldownMs = DEFAULT_COOLDOWN_MS,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD
} = {}) {
  return {
    failures: 0,
    lastFailure: null,
    isOpen: false,
    cooldownMs,
    failureThreshold
  };
}

/**
 * If open and still cooling down, throws. If cooldown elapsed, resets to closed.
 * @param {ReturnType<typeof createCircuitBreakerState>} state
 * @param {() => number} [nowFn]
 */
export function checkCircuitBreaker(state, nowFn = Date.now) {
  if (state.isOpen) {
    const timeSinceLastFailure = nowFn() - state.lastFailure;
    if (timeSinceLastFailure < state.cooldownMs) {
      throw new Error(
        `Turn14 API is temporarily disabled due to repeated failures. Please wait ${Math.ceil(
          (state.cooldownMs - timeSinceLastFailure) / 1000
        )} seconds or check your API configuration.`
      );
    }
    state.isOpen = false;
    state.failures = 0;
  }
}

export function recordFailure(state, nowFn = Date.now) {
  state.failures++;
  state.lastFailure = nowFn();
  if (state.failures >= state.failureThreshold) {
    state.isOpen = true;
  }
}

export function recordSuccess(state) {
  state.failures = 0;
  state.isOpen = false;
}
