import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ADMIN_MAIN_TABS_ADMIN,
  ADMIN_SUB_TABS,
} from '../src/config/adminNavRegistry.js';
import { resolveAdminDeepLink } from '../src/utils/adminDeepLinkApply.js';

const tabs = {
  mainTabs: ADMIN_MAIN_TABS_ADMIN,
  subTabs: ADMIN_SUB_TABS,
};

describe('resolveAdminDeepLink', () => {
  it('no-ops for non-admin, missing adm, or unknown main (query stays)', () => {
    assert.deepEqual(
      resolveAdminDeepLink({ adm: 'finance', adsub: 'payroll', isAdmin: false, ...tabs }),
      { applied: false, clearQuery: false },
    );
    assert.deepEqual(
      resolveAdminDeepLink({ adm: '', adsub: 'payroll', isAdmin: true, ...tabs }),
      { applied: false, clearQuery: false },
    );
    assert.deepEqual(
      resolveAdminDeepLink({ adm: 'not_a_tab', adsub: 'payroll', isAdmin: true, ...tabs }),
      { applied: false, clearQuery: false },
    );
    assert.deepEqual(
      resolveAdminDeepLink({ adm: 'Finance', adsub: 'payroll', isAdmin: true, ...tabs }),
      { applied: false, clearQuery: false },
    );
  });

  it('applies known main + valid sub and clears query', () => {
    assert.deepEqual(
      resolveAdminDeepLink({
        adm: 'finance',
        adsub: 'paystub_maker',
        isAdmin: true,
        ...tabs,
      }),
      { applied: true, clearQuery: true, mainTab: 'finance', subTab: 'paystub_maker' },
    );
  });

  it('applies known main with invalid / missing sub; still clears query', () => {
    assert.deepEqual(
      resolveAdminDeepLink({ adm: 'finance', adsub: 'nope', isAdmin: true, ...tabs }),
      { applied: true, clearQuery: true, mainTab: 'finance', subTab: undefined },
    );
    assert.deepEqual(
      resolveAdminDeepLink({ adm: 'overview', adsub: 'status', isAdmin: true, ...tabs }),
      { applied: true, clearQuery: true, mainTab: 'overview', subTab: undefined },
    );
    assert.deepEqual(
      resolveAdminDeepLink({ adm: 'people', adsub: '', isAdmin: true, ...tabs }),
      { applied: true, clearQuery: true, mainTab: 'people', subTab: undefined },
    );
  });
});
