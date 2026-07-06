import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ADMIN_MAIN_TABS_ADMIN, ADMIN_SUB_TABS } from '../src/config/adminNavRegistry.js';
import {
  buildAdminCommands,
  getFocusableElements,
  JUMP_RECENT_KEY,
  loadRecentIds,
  MAX_RECENT,
  matchesQuery,
  pushRecentId,
  scoreCommand,
  subsequenceMatch,
} from '../src/components/Layout/jumpPaletteUtils.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('admin navigation registry', () => {
  it('keeps every sub-tab attached to an admin main tab', () => {
    const mainIds = new Set(ADMIN_MAIN_TABS_ADMIN.map((tab) => tab.id));

    for (const mainId of Object.keys(ADMIN_SUB_TABS)) {
      assert.equal(mainIds.has(mainId), true, `${mainId} is not an admin main tab`);
    }
  });

  it('builds one unique admin command for each reachable main tab or sub-tab', () => {
    const commands = buildAdminCommands(() => {});
    const commandIds = new Set(commands.map((cmd) => cmd.id));
    const mainWithoutSubs = ADMIN_MAIN_TABS_ADMIN.filter((tab) => !ADMIN_SUB_TABS[tab.id]).length;
    const subTabCount = Object.values(ADMIN_SUB_TABS).reduce((sum, tabs) => sum + tabs.length, 0);

    assert.equal(commandIds.size, commands.length, 'command ids should not collide');
    assert.equal(commands.filter((cmd) => cmd.id.startsWith('admin:')).length, mainWithoutSubs + subTabCount);
  });
});

describe('jump palette search and command routing', () => {
  let navigateCalls;

  beforeEach(() => {
    navigateCalls = [];
  });

  it('routes finance sub-tab commands through the adm/adsub deep-link contract', () => {
    const commands = buildAdminCommands((to) => navigateCalls.push(to));
    const payStub = commands.find((cmd) => cmd.id === 'admin:finance:paystub_maker');

    assert.ok(payStub, 'Pay stub PDF command should exist');
    payStub.run();

    assert.deepEqual(navigateCalls, [
      { pathname: '/admin', search: '?adm=finance&adsub=paystub_maker' },
    ]);
  });

  it('routes main admin destinations without stale sub-tab params', () => {
    const commands = buildAdminCommands((to) => navigateCalls.push(to));
    const overview = commands.find((cmd) => cmd.id === 'admin:overview');

    assert.ok(overview, 'Overview command should exist');
    overview.run();

    assert.deepEqual(navigateCalls, [{ pathname: '/admin', search: '?adm=overview' }]);
  });

  it('keeps cross-app shortcuts as direct route navigations', () => {
    const commands = buildAdminCommands((to) => navigateCalls.push(to));
    const crm = commands.find((cmd) => cmd.id === 'route:/crm');

    assert.ok(crm, 'CRM route command should exist');
    crm.run();

    assert.deepEqual(navigateCalls, ['/crm']);
  });

  it('ranks Pay stub PDF ahead of unrelated destinations for payroll voucher searches', () => {
    const commands = buildAdminCommands(() => {});
    const sorted = commands
      .map((cmd) => ({ cmd, score: scoreCommand('pay stub pdf', cmd) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    assert.equal(sorted[0]?.cmd.id, 'admin:finance:paystub_maker');
    assert.equal(matchesQuery('pay stub', 'Pay stub PDF Finance Admin'), true);
    assert.equal(subsequenceMatch('pspdf', 'Pay stub PDF'), true);
    assert.equal(subsequenceMatch('zzqx', 'Pay stub PDF'), false);
  });
});

describe('jump palette recent destinations', () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('recovers from corrupt or unexpected stored recent ids', () => {
    localStorage.setItem(JUMP_RECENT_KEY, '{not-json');
    assert.deepEqual(loadRecentIds(), []);

    localStorage.setItem(JUMP_RECENT_KEY, JSON.stringify(['admin:overview', 42, null, 'route:/crm']));
    assert.deepEqual(loadRecentIds(), ['admin:overview', 'route:/crm']);
  });

  it('dedupes, moves the selected command to the front, and caps recent ids', () => {
    const insertedIds = Array.from({ length: MAX_RECENT + 2 }, (_, idx) => `cmd-${idx + 1}`);
    insertedIds.forEach((id) => pushRecentId(id));

    const cappedNewestFirst = insertedIds.slice().reverse().slice(0, MAX_RECENT);
    assert.deepEqual(loadRecentIds(), cappedNewestFirst);

    const repeatedId = cappedNewestFirst[Math.floor(cappedNewestFirst.length / 2)];
    pushRecentId(repeatedId);

    assert.deepEqual(loadRecentIds(), [
      repeatedId,
      ...cappedNewestFirst.filter((id) => id !== repeatedId),
    ]);
  });
});

describe('jump palette focusable filtering', () => {
  const previousHTMLElement = globalThis.HTMLElement;
  const previousHTMLInputElement = globalThis.HTMLInputElement;

  class FakeHTMLElement {
    constructor(attrs = {}) {
      this.attrs = attrs;
    }

    getAttribute(name) {
      return this.attrs[name] ?? null;
    }
  }

  class FakeHTMLInputElement extends FakeHTMLElement {
    constructor(attrs = {}, type = 'text') {
      super(attrs);
      this.type = type;
    }
  }

  beforeEach(() => {
    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.HTMLInputElement = FakeHTMLInputElement;
  });

  afterEach(() => {
    globalThis.HTMLElement = previousHTMLElement;
    globalThis.HTMLInputElement = previousHTMLInputElement;
  });

  it('drops hidden, aria-hidden, and non-element nodes from dialog focus targets', () => {
    const visibleButton = new FakeHTMLElement();
    const ariaHiddenButton = new FakeHTMLElement({ 'aria-hidden': 'true' });
    const hiddenInput = new FakeHTMLInputElement({}, 'hidden');
    const visibleInput = new FakeHTMLInputElement();
    const root = {
      querySelectorAll() {
        return [visibleButton, ariaHiddenButton, hiddenInput, visibleInput, { nodeType: 1 }];
      },
    };

    assert.deepEqual(getFocusableElements(root), [visibleButton, visibleInput]);
  });
});
