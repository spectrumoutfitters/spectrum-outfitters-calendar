export const BONUS_WEIGHTS = {
  instagram: 2,
  review: 5,
  referral: 3,
} as const;

export function computeTicketCount(input: {
  bonusInstagram: boolean;
  bonusReview: boolean;
  bonusReferral: boolean;
}): number {
  let n = 1;
  if (input.bonusInstagram) n += BONUS_WEIGHTS.instagram;
  if (input.bonusReview) n += BONUS_WEIGHTS.review;
  if (input.bonusReferral) n += BONUS_WEIGHTS.referral;
  return n;
}
