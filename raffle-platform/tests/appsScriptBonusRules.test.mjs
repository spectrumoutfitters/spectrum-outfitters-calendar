import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Loads the sheet bonus parser from Apps Script. Code.gs is not an ES module,
 * and open bugfix PRs already edit it, so these tests execute the functions
 * in place. The Next.js bonus helper now ships an empty ladder; the spreadsheet
 * still grants the current review and referral defaults and must keep ignoring
 * old social-follow rules stored on the event row.
 */
const codePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../google-apps-script/Code.gs',
);
const source = fs.readFileSync(codePath, 'utf8');

function endOfFunction(text, openBrace) {
  let depth = 0;
  let state = 'code';
  for (let i = openBrace; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (state === 'line') {
      if (c === '\n') state = 'code';
      continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
      continue;
    }
    if (state === 'sq' || state === 'dq') {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"')) state = 'code';
      continue;
    }
    if (c === '/' && next === '/') {
      state = 'line';
      i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      state = 'block';
      i += 1;
      continue;
    }
    if (c === "'") {
      state = 'sq';
      continue;
    }
    if (c === '"') {
      state = 'dq';
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('unterminated function body');
}

function sliceFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Code.gs is missing ${name}`);
  assert.equal(source.indexOf(marker, start + marker.length), -1, `Code.gs defines ${name} twice`);
  const open = source.indexOf('{', start);
  const end = endOfFunction(source, open);
  return source.slice(start, end + 1);
}

function loadBonusRules() {
  const names = [
    'getDefaultBonuses_',
    'cloneProofFieldsFromBonus_',
    'isLegacyThreeRuleBonusConfig_',
    'getDefaultBonusById_',
    'mergeParsedBonusWithDefaults_',
    'parseBonusRulesFromRow_',
    'computeTicketsFromBonuses_',
    'legacyBonusBooleans_',
  ];
  const declMarker = 'var SHIPPED_DEFAULT_BONUS_IDS_';
  const declAt = source.indexOf(declMarker);
  assert.notEqual(declAt, -1, 'Code.gs is missing SHIPPED_DEFAULT_BONUS_IDS_');
  assert.equal(source.indexOf(declMarker, declAt + declMarker.length), -1, 'SHIPPED_DEFAULT_BONUS_IDS_ is defined twice');
  const declEnd = source.indexOf('\n', declAt);
  const decl = source.slice(declAt, declEnd);
  const body = [
    decl,
    ...names.map(sliceFunction),
    'return {',
    '  getDefaultBonuses: getDefaultBonuses_,',
    '  parseBonusRulesFromRow: parseBonusRulesFromRow_,',
    '  computeTicketsFromBonuses: computeTicketsFromBonuses_,',
    '  legacyBonusBooleans: legacyBonusBooleans_,',
    '};',
  ].join('\n');
  return new Function(body)();
}

const {
  getDefaultBonuses,
  parseBonusRulesFromRow,
  computeTicketsFromBonuses,
  legacyBonusBooleans,
} = loadBonusRules();

function idsOf(rules) {
  return rules.map((rule) => rule.id);
}

describe('parseBonusRulesFromRow_', () => {
  it('ships review (4) and referral (3) when the event row has no bonus JSON', () => {
    const fromMissing = parseBonusRulesFromRow({});
    const fromBlank = parseBonusRulesFromRow({ bonusRulesJson: '   ', bonus_rules_json: '' });
    for (const rules of [fromMissing, fromBlank, getDefaultBonuses()]) {
      assert.deepEqual(idsOf(rules), ['review', 'referral']);
      assert.equal(rules[0].tickets, 4);
      assert.equal(rules[1].tickets, 3);
      assert.deepEqual(
        rules[0].proofFields.map((field) => field.id),
        ['platform', 'reviewUrl'],
      );
      assert.equal(rules[0].proofFields[1].input, 'url');
      assert.equal(rules[0].proofFields[1].requiredWhenBonus, true);
      assert.deepEqual(
        rules[1].proofFields.map((field) => field.id),
        ['friendName'],
      );
    }
  });

  it('restores those defaults when the cell is not a non-empty rule array', () => {
    const broken = ['{', 'null', '{}', '[]', '[null,"x",1]', '[{"id":"  "}]'];
    for (const bonusRulesJson of broken) {
      assert.deepEqual(idsOf(parseBonusRulesFromRow({ bonusRulesJson })), ['review', 'referral']);
    }
    assert.deepEqual(
      idsOf(parseBonusRulesFromRow({ bonus_rules_json: '[{"id":"instagram","tickets":9}]' })),
      ['review', 'referral'],
    );
  });

  it('drops a sheet that only echoes previously shipped bonus ids, including a single old social rule', () => {
    const echoed = [
      { id: 'instagram', tickets: 20 },
      { id: 'tiktok', tickets: 20 },
      { id: 'facebook', tickets: 20 },
      { id: 'story_tag', tickets: 20 },
      { id: 'review', tickets: 99 },
      { id: 'referral', tickets: 99 },
    ];
    const replaced = parseBonusRulesFromRow({ bonusRulesJson: JSON.stringify(echoed) });
    assert.deepEqual(idsOf(replaced), ['review', 'referral']);
    assert.equal(replaced[0].tickets, 4);
    assert.equal(replaced[1].tickets, 3);

    const onlyInstagram = parseBonusRulesFromRow({
      bonusRulesJson: JSON.stringify([{ id: ' instagram ', tickets: 8 }]),
    });
    assert.deepEqual(idsOf(onlyInstagram), ['review', 'referral']);

    const selectedOldLadder = {
      instagram: true,
      tiktok: true,
      facebook: true,
      story_tag: true,
      review: true,
      referral: true,
    };
    assert.equal(computeTicketsFromBonuses(selectedOldLadder, replaced, 2), 9);
  });

  it('keeps a custom bonus and fills omitted proof fields on a current default id', () => {
    const rules = parseBonusRulesFromRow({
      bonusRulesJson: JSON.stringify([
        {
          id: 'review',
          tickets: 8,
          description: '',
          proofFields: [],
        },
        {
          id: 'veteran',
          label: ' Veteran ',
          tickets: '5',
          description: 'Bring ID',
          actionUrl: '  https://example.com/vet  ',
          actionLabel: ' Details ',
          proofFields: [
            null,
            { id: '', label: 'skip' },
            { id: 'note', label: 'Note', requiredWhenBonus: 1 },
            'nope',
          ],
        },
      ]),
    });

    assert.deepEqual(idsOf(rules), ['review', 'veteran']);
    assert.equal(rules[0].tickets, 8);
    assert.equal(rules[0].description.includes('Google'), true);
    assert.deepEqual(
      rules[0].proofFields.map((field) => [field.id, field.requiredWhenBonus]),
      [
        ['platform', true],
        ['reviewUrl', true],
      ],
    );
    assert.equal(rules[1].label, ' Veteran ');
    assert.equal(rules[1].tickets, 5);
    assert.equal(rules[1].description, 'Bring ID');
    assert.equal(rules[1].actionUrl, 'https://example.com/vet');
    assert.equal(rules[1].actionLabel, 'Details');
    assert.deepEqual(rules[1].proofFields, [
      {
        id: 'note',
        input: 'text',
        label: 'Note',
        placeholder: '',
        requiredWhenBonus: true,
      },
    ]);
    assert.equal(
      computeTicketsFromBonuses({ review: true, veteran: true, instagram: true }, rules, 2),
      15,
    );
  });

  it('clamps a custom rule ticket count outside 1..100 to one ticket', () => {
    const rules = parseBonusRulesFromRow({
      bonusRulesJson: JSON.stringify([
        { id: 'zero', tickets: 0 },
        { id: 'over', tickets: 101 },
        { id: 'missing' },
        { id: 'words', tickets: 'nope' },
        { id: 'max', tickets: 100 },
        { id: 'min', tickets: 1 },
        { id: 'text', tickets: '6' },
      ]),
    });
    assert.deepEqual(
      rules.map((rule) => [rule.id, rule.tickets]),
      [
        ['zero', 1],
        ['over', 1],
        ['missing', 1],
        ['words', 1],
        ['max', 100],
        ['min', 1],
        ['text', 6],
      ],
    );
  });
});

describe('computeTicketsFromBonuses_', () => {
  const rules = [
    { id: 'review', tickets: 4 },
    { id: 'referral', tickets: 'nope' },
  ];

  it('starts from two tickets and adds only selected numeric bonuses', () => {
    assert.equal(computeTicketsFromBonuses({}, rules), 2);
    assert.equal(computeTicketsFromBonuses({}, rules, 0), 2);
    assert.equal(computeTicketsFromBonuses({}, rules, ''), 2);
    assert.equal(computeTicketsFromBonuses({}, rules, 1.9), 1);
    assert.equal(computeTicketsFromBonuses({}, rules, -4), 1);
    assert.equal(computeTicketsFromBonuses({ review: true }, rules, 2), 6);
    assert.equal(computeTicketsFromBonuses({ review: false, referral: true }, rules, 2), 2);
    assert.equal(computeTicketsFromBonuses({ review: 'TRUE' }, rules, '3'), 7);
  });
});

describe('legacyBonusBooleans_', () => {
  it('maps only the three legacy column ids onto TRUE or FALSE', () => {
    assert.deepEqual(legacyBonusBooleans(null), ['FALSE', 'FALSE', 'FALSE']);
    assert.deepEqual(legacyBonusBooleans({}), ['FALSE', 'FALSE', 'FALSE']);
    assert.deepEqual(
      legacyBonusBooleans({ instagram: 1, review: 'yes', referral: 0, veteran: true }),
      ['TRUE', 'TRUE', 'FALSE'],
    );
  });
});
