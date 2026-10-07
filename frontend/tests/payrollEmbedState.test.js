import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAYROLL_IFRAME_LOAD_TIMEOUT_MS,
  PAYROLL_IFRAME_SRC,
  payrollPanelKind,
} from '../src/utils/payrollEmbedState.js';

describe('payrollPanelKind', () => {
  it('stays on the loading screen until the access check finishes', () => {
    assert.equal(
      payrollPanelKind({ loading: true, hasAccess: false, error: 'denied', iframeLoadFailed: true }),
      'loading',
    );
  });

  it('denies access when the check fails or the user has no payroll flag', () => {
    assert.equal(
      payrollPanelKind({ loading: false, hasAccess: true, error: 'Error checking access', iframeLoadFailed: false }),
      'denied',
    );
    assert.equal(
      payrollPanelKind({ loading: false, hasAccess: false, error: null, iframeLoadFailed: false }),
      'denied',
    );
    assert.equal(
      payrollPanelKind({ loading: false, hasAccess: false, error: null, iframeLoadFailed: true }),
      'denied',
    );
  });

  it('embeds the payroll app only after access is granted and the frame has not failed', () => {
    assert.equal(
      payrollPanelKind({ loading: false, hasAccess: true, error: null, iframeLoadFailed: false }),
      'embed',
    );
    assert.equal(PAYROLL_IFRAME_SRC, '/payroll-system/index.html');
  });

  it('shows the unavailable fallback when the iframe does not load', () => {
    assert.equal(
      payrollPanelKind({ loading: false, hasAccess: true, error: null, iframeLoadFailed: true }),
      'unavailable',
    );
    assert.equal(PAYROLL_IFRAME_LOAD_TIMEOUT_MS, 12000);
  });
});
