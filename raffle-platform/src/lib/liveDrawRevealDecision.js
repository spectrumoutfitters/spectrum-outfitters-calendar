/**
 * Pure poll → UI decision for the public live draw board.
 * Mirrors LiveDrawBoardClient winners-feed handling:
 * first non-empty poll seeds quietly; empty-then-winner (or drawId change) reveals.
 */

/**
 * @typedef {{ drawId?: string }} LiveDrawWinnerLike
 *
 * @typedef {{
 *   winners: LiveDrawWinnerLike[] | null | undefined,
 *   lastSeenDrawId: string | null,
 *   hadEmptyWinners: boolean,
 * }} LiveDrawPollInput
 *
 * @typedef {'mark_empty' | 'noop' | 'seed_winner' | 'reveal'} LiveDrawPollActionType
 *
 * @typedef {{
 *   type: LiveDrawPollActionType,
 *   winner?: LiveDrawWinnerLike,
 *   drawId?: string,
 * }} LiveDrawPollAction
 */

/**
 * Decide how the live board should react to one public-winners poll.
 *
 * @param {LiveDrawPollInput} input
 * @returns {LiveDrawPollAction}
 */
export function decideLiveDrawPollAction({ winners, lastSeenDrawId, hadEmptyWinners }) {
  if (!Array.isArray(winners) || winners.length === 0) {
    return { type: 'mark_empty' };
  }

  const newest = winners[0];
  if (!newest?.drawId) {
    return { type: 'noop' };
  }

  if (lastSeenDrawId === null) {
    if (hadEmptyWinners) {
      return { type: 'reveal', winner: newest, drawId: newest.drawId };
    }
    return { type: 'seed_winner', winner: newest, drawId: newest.drawId };
  }

  if (newest.drawId !== lastSeenDrawId) {
    return { type: 'reveal', winner: newest, drawId: newest.drawId };
  }

  return { type: 'noop' };
}
