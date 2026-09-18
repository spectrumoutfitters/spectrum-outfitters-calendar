import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichContent } from '../src/utils/updatesRichContent.js';

describe('parseRichContent', () => {
  it('returns an empty list for missing text', () => {
    assert.deepEqual(parseRichContent(''), []);
    assert.deepEqual(parseRichContent(null), []);
    assert.deepEqual(parseRichContent(undefined), []);
  });

  it('parses headings, rules, callouts, and bold paragraphs', () => {
    const blocks = parseRichContent(
      '## Heading\n### Sub\n---\n> Note **now**\nA **bold** word',
    );
    assert.equal(blocks[0].type, 'h2');
    assert.equal(blocks[0].text, 'Heading');
    assert.equal(blocks[1].type, 'h3');
    assert.equal(blocks[1].text, 'Sub');
    assert.equal(blocks[2].type, 'hr');
    assert.equal(blocks[3].type, 'callout');
    assert.equal(blocks[3].text, 'Note **now**');
    assert.deepEqual(
      blocks[3].parts.filter((p) => p.bold).map((p) => p.text),
      ['now'],
    );
    assert.equal(blocks[4].type, 'p');
    assert.deepEqual(
      blocks[4].parts.map((p) => ({ text: p.text, bold: p.bold })),
      [
        { text: 'A ', bold: false },
        { text: 'bold', bold: true },
        { text: ' word', bold: false },
      ],
    );
  });

  it('groups bullets and numbered items, including two-space indent', () => {
    const blocks = parseRichContent('- one\n  - nested\n1. first\n2. second\n\nAfter');
    assert.equal(blocks[0].type, 'list');
    assert.equal(blocks[0].items.length, 4);
    assert.equal(blocks[0].items[0].text, 'one');
    assert.equal(blocks[0].items[0].indent, 0);
    assert.equal(blocks[0].items[1].text, 'nested');
    assert.equal(blocks[0].items[1].indent, 1);
    assert.equal(blocks[0].items[2].num, '1');
    assert.equal(blocks[0].items[2].text, 'first');
    assert.equal(blocks[0].items[3].num, '2');
    assert.equal(blocks[1].type, 'spacer');
    assert.equal(blocks[2].type, 'p');
    assert.equal(blocks[2].text, 'After');
  });

  it('does not treat IMMEDIATE-style hashes or lone dashes as headings', () => {
    const blocks = parseRichContent('# not a heading\n-not a bullet\n1.not numbered');
    assert.equal(blocks.length, 3);
    assert.equal(blocks[0].type, 'p');
    assert.equal(blocks[0].text, '# not a heading');
    assert.equal(blocks[1].type, 'p');
    assert.equal(blocks[2].type, 'p');
  });
});
