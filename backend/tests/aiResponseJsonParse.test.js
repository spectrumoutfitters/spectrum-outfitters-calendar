import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFirstJsonArrayText,
  extractFirstJsonObjectText,
  parseFirstJsonArray,
  parseFirstJsonObject,
  normalizeAiWorkItems,
  parseAiWorkItemsResponse,
  parseAiCategoryResponse,
} from '../utils/aiResponseJsonParse.js';

describe('extractFirstJsonArrayText / extractFirstJsonObjectText', () => {
  it('returns the greedy first bracket / brace span', () => {
    assert.equal(extractFirstJsonArrayText('prefix [1,2] suffix'), '[1,2]');
    assert.equal(extractFirstJsonObjectText('prefix {"a":1} suffix'), '{"a":1}');
    assert.equal(extractFirstJsonArrayText('no array here'), null);
    assert.equal(extractFirstJsonObjectText('no object here'), null);
  });

  it('uses a greedy match from the first opener to the last closer', () => {
    assert.equal(extractFirstJsonArrayText('[1] extra [2]'), '[1] extra [2]');
    assert.equal(extractFirstJsonObjectText('{ "a": 1 } xx { "b": 2 }'), '{ "a": 1 } xx { "b": 2 }');
  });
});

describe('parseFirstJsonArray / parseFirstJsonObject', () => {
  it('parses a fenced reply and ignores surrounding prose', () => {
    assert.deepEqual(parseFirstJsonArray('Here you go:\n[{"title":"PPF"}]\nThanks'), [{ title: 'PPF' }]);
    assert.deepEqual(parseFirstJsonObject('Result: {"category":"PPF"} done'), { category: 'PPF' });
  });

  it('returns null when there is no JSON span', () => {
    assert.equal(parseFirstJsonArray('sorry, no'), null);
    assert.equal(parseFirstJsonObject('sorry, no'), null);
  });

  it('throws when the greedy span is not valid JSON', () => {
    assert.throws(() => parseFirstJsonArray('[1] extra [2]'), SyntaxError);
    assert.throws(() => parseFirstJsonObject('{ "a": 1 } xx { "b": 2 }'), SyntaxError);
  });
});

describe('normalizeAiWorkItems / parseAiWorkItemsResponse', () => {
  it('prefers title over name and defaults missing order to 0', () => {
    assert.deepEqual(
      normalizeAiWorkItems([
        { title: 'Tint', name: 'ignored', order: 2 },
        { name: 'PPF only' },
        { order: 0 },
      ]),
      [
        { title: 'Tint', order: 2 },
        { title: 'PPF only', order: 0 },
        { title: '', order: 0 },
      ]
    );
  });

  it('maps a model array reply into work items', () => {
    const text = '```json\n[{"title":"Oil change","order":1},{"name":"Filter"}]\n```';
    assert.deepEqual(parseAiWorkItemsResponse(text), [
      { title: 'Oil change', order: 1 },
      { title: 'Filter', order: 0 },
    ]);
  });

  it('returns null when the reply has no array', () => {
    assert.equal(parseAiWorkItemsResponse('I could not extract items'), null);
  });
});

describe('parseAiCategoryResponse', () => {
  const categories = ['PPF', 'Tinting', 'Wraps', 'Maintenance', 'Upfitting', 'Signs', 'Body Work', 'Admin', 'Other'];

  it('returns the object when category is on the allowlist', () => {
    assert.deepEqual(
      parseAiCategoryResponse('{"category":"Tinting","confidence":"high"}', categories),
      { category: 'Tinting', confidence: 'high' }
    );
  });

  it('rejects unknown / missing category (case-sensitive allowlist)', () => {
    assert.equal(parseAiCategoryResponse('{"category":"tinting"}', categories), null);
    assert.equal(parseAiCategoryResponse('{"category":"Detailing"}', categories), null);
    assert.equal(parseAiCategoryResponse('{"confidence":"high"}', categories), null);
  });
});
