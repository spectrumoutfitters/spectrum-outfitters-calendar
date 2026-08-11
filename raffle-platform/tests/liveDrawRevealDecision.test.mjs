import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideLiveDrawPollAction } from '../src/lib/liveDrawRevealDecision.js';

function winner(drawId, name = 'Alex') {
  return {
    drawId,
    drewAt: '2026-08-11T05:00:00.000Z',
    raffleId: 'pool-1',
    raffleTitle: 'Main raffle',
    winnerName: name,
    ticketsInPool: 42,
  };
}

describe('decideLiveDrawPollAction', () => {
  it('marks empty when winners list is empty or missing', () => {
    assert.deepEqual(
      decideLiveDrawPollAction({
        winners: [],
        lastSeenDrawId: null,
        hadEmptyWinners: false,
      }),
      { type: 'mark_empty' },
    );
    assert.equal(
      decideLiveDrawPollAction({
        winners: null,
        lastSeenDrawId: 'd1',
        hadEmptyWinners: true,
      }).type,
      'mark_empty',
    );
  });

  it('noops when newest row has no drawId', () => {
    assert.deepEqual(
      decideLiveDrawPollAction({
        winners: [{ winnerName: 'No id' }],
        lastSeenDrawId: null,
        hadEmptyWinners: true,
      }),
      { type: 'noop' },
    );
  });

  it('seeds quietly on first poll when board never saw empty winners', () => {
    const newest = winner('draw-seed');
    const action = decideLiveDrawPollAction({
      winners: [newest, winner('older')],
      lastSeenDrawId: null,
      hadEmptyWinners: false,
    });
    assert.equal(action.type, 'seed_winner');
    assert.equal(action.drawId, 'draw-seed');
    assert.equal(action.winner, newest);
  });

  it('reveals after empty → first winner (live draw join mid-ceremony)', () => {
    const newest = winner('draw-live');
    const action = decideLiveDrawPollAction({
      winners: [newest],
      lastSeenDrawId: null,
      hadEmptyWinners: true,
    });
    assert.equal(action.type, 'reveal');
    assert.equal(action.drawId, 'draw-live');
    assert.equal(action.winner, newest);
  });

  it('reveals when drawId changes after a prior seed/reveal', () => {
    const newest = winner('draw-2', 'Blake');
    const action = decideLiveDrawPollAction({
      winners: [newest],
      lastSeenDrawId: 'draw-1',
      hadEmptyWinners: false,
    });
    assert.equal(action.type, 'reveal');
    assert.equal(action.drawId, 'draw-2');
  });

  it('noops when newest drawId matches lastSeen (idempotent poll)', () => {
    assert.deepEqual(
      decideLiveDrawPollAction({
        winners: [winner('draw-1')],
        lastSeenDrawId: 'draw-1',
        hadEmptyWinners: true,
      }),
      { type: 'noop' },
    );
  });

  it('uses winners[0] as newest even when older draws follow', () => {
    const newest = winner('newest');
    const action = decideLiveDrawPollAction({
      winners: [newest, winner('mid'), winner('old')],
      lastSeenDrawId: 'mid',
      hadEmptyWinners: false,
    });
    assert.equal(action.type, 'reveal');
    assert.equal(action.winner, newest);
  });
});
