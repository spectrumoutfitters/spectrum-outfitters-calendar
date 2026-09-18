import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPoolTicketCount,
  parsePoolTicketText,
  digitsOnlyTicketText,
} from '../src/lib/poolTicketClamp.js';

describe('clampPoolTicketCount', () => {
  it('floors and clamps between 0 and max', () => {
    assert.equal(clampPoolTicketCount(3, 5), 3);
    assert.equal(clampPoolTicketCount(0, 5), 0);
    assert.equal(clampPoolTicketCount(5, 5), 5);
    assert.equal(clampPoolTicketCount(9, 5), 5);
    assert.equal(clampPoolTicketCount(-2, 5), 0);
    assert.equal(clampPoolTicketCount(2.9, 5), 2);
  });

  it('treats non-finite values as zero and a missing max as a zero ceiling', () => {
    assert.equal(clampPoolTicketCount(NaN, 5), 0);
    assert.equal(clampPoolTicketCount(undefined, 5), 0);
    assert.equal(clampPoolTicketCount(4, NaN), 0);
    assert.equal(clampPoolTicketCount(4, undefined), 0);
    assert.equal(clampPoolTicketCount(1, 0), 0);
  });
});

describe('parsePoolTicketText', () => {
  it('treats empty or non-numeric text as zero', () => {
    assert.equal(parsePoolTicketText(''), 0);
    assert.equal(parsePoolTicketText(null), 0);
    assert.equal(parsePoolTicketText('12'), 12);
    assert.equal(parsePoolTicketText('08'), 8);
    assert.equal(parsePoolTicketText('abc'), 0);
  });
});

describe('digitsOnlyTicketText', () => {
  it('strips non-digits so the field cannot hold decimals or letters', () => {
    assert.equal(digitsOnlyTicketText('12a3'), '123');
    assert.equal(digitsOnlyTicketText('4.5'), '45');
    assert.equal(digitsOnlyTicketText('-2'), '2');
    assert.equal(digitsOnlyTicketText(''), '');
  });
});
