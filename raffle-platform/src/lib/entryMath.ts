import { computeTicketsFromBonuses, DEFAULT_BONUS_RULES } from "@/lib/bonusDefaults";

export { computeTicketsFromBonuses, DEFAULT_BONUS_RULES, resolveBonusRules } from "@/lib/bonusDefaults";

/** @deprecated use DEFAULT_BONUS_RULES + computeTicketsFromBonuses */
export const BONUS_WEIGHTS = {
  instagram: 2,
  review: 5,
  referral: 3,
} as const;

/** @deprecated use computeTicketsFromBonuses with resolveBonusRules(event) */
export function computeTicketCount(input: {
  bonusInstagram: boolean;
  bonusReview: boolean;
  bonusReferral: boolean;
}): number {
  return computeTicketsFromBonuses(
    {
      instagram: input.bonusInstagram,
      review: input.bonusReview,
      referral: input.bonusReferral,
    },
    DEFAULT_BONUS_RULES,
  );
}
