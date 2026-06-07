import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAdminDeepLink } from './adminNavRegistry.js';

test('resolves legacy admin tab links to the current tab model', () => {
  const target = resolveAdminDeepLink(new URLSearchParams('tab=worklist&refills=1'));

  assert.deepEqual(target, {
    main: 'people',
    sub: 'worklist',
    paramsToDelete: ['tab'],
  });
});

test('resolves Jump Palette admin links to the current tab model', () => {
  const target = resolveAdminDeepLink(
    new URLSearchParams('adm=finance&adsub=shop_financing'),
  );

  assert.deepEqual(target, {
    main: 'finance',
    sub: 'shop_financing',
    paramsToDelete: ['adm', 'adsub'],
  });
});

test('ignores invalid admin deep links', () => {
  assert.equal(resolveAdminDeepLink(new URLSearchParams('tab=missing')), null);
  assert.equal(resolveAdminDeepLink(new URLSearchParams('adm=missing')), null);
});
