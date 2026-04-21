import type { BonusRule } from "@/lib/types";

/** Used when the Google Sheet Events row has no `bonusRulesJson`. */
export const DEFAULT_BONUS_RULES: BonusRule[] = [
  {
    id: "instagram",
    label: "Instagram follow or story mention",
    description: "Follow us and tag the shop.",
    tickets: 2,
  },
  {
    id: "review",
    label: "Leave a review",
    description: "Google or Facebook review for the business.",
    tickets: 5,
  },
  {
    id: "referral",
    label: "Refer a friend",
    description: "Friend must mention your name on their entry.",
    tickets: 3,
  },
];

export function resolveBonusRules(event: { bonuses?: BonusRule[] | null }): BonusRule[] {
  const b = event.bonuses;
  if (Array.isArray(b) && b.length > 0) return b;
  return DEFAULT_BONUS_RULES;
}

export function computeTicketsFromBonuses(
  selections: Record<string, boolean>,
  rules: { id: string; tickets: number }[],
): number {
  let n = 1;
  for (const r of rules) {
    if (selections[r.id]) n += r.tickets;
  }
  return n;
}
