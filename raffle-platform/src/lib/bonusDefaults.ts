import type { BonusRule } from "@/lib/types";

/**
 * Free bonus ladder. We only ship rules staff can actually verify before awarding prizes:
 *
 * - review: requires a public review URL the team can click and confirm.
 * - referral: requires the friend's full name; counts only when that friend submits their own
 *   entry and types this entrant back as their referrer.
 *
 * Older rules (instagram / tiktok / facebook follows, story tags) were removed because we cannot
 * verify them at scale without OAuth into Meta/TikTok. Paid tickets are the supported way to add
 * weight to an entry beyond these two.
 */
export const DEFAULT_BONUS_RULES: BonusRule[] = [
  {
    id: "review",
    label: "Leave a public review",
    description: "Post a public Google, Facebook, or Yelp review and paste the link below — we click every link before awarding prizes.",
    tickets: 4,
    proofFields: [
      {
        id: "platform",
        input: "text",
        label: "Where did you review? (Google, Facebook, Yelp, …)",
        placeholder: "e.g. Google Maps",
        requiredWhenBonus: true,
      },
      {
        id: "reviewUrl",
        input: "url",
        label: "Public link to your review",
        placeholder: "https://…",
        requiredWhenBonus: true,
      },
    ],
  },
  {
    id: "referral",
    label: "Refer a friend",
    description: "Your friend must submit their own entry and type your full name in their referral field — that is how we verify it.",
    tickets: 3,
    proofFields: [
      {
        id: "friendName",
        input: "text",
        label: "Friend's full name (must match what they type)",
        placeholder: "First Last",
        requiredWhenBonus: true,
      },
    ],
  },
];

/** IDs we have ever shipped as defaults — used to decide when a sheet is just echoing them back. */
const SHIPPED_DEFAULT_IDS = new Set([
  "instagram",
  "tiktok",
  "facebook",
  "story_tag",
  "review",
  "referral",
]);

const DEFAULT_BONUS_BY_ID: Record<string, BonusRule> = Object.fromEntries(
  DEFAULT_BONUS_RULES.map((r) => [r.id, r]),
);

/**
 * Sheet / admin JSON often sends only id, label, tickets. Fill proofFields, actionUrl, and actionLabel
 * from the built-in template for that id so the entry form can show inputs and links.
 */
export function mergeBonusRulesWithDefaults(rules: BonusRule[]): BonusRule[] {
  return rules.map((r) => {
    const d = DEFAULT_BONUS_BY_ID[r.id];
    if (!d) return r;
    const hasOwnProof = Array.isArray(r.proofFields) && r.proofFields.length > 0;
    return {
      ...d,
      ...r,
      label: r.label?.trim() ? r.label : d.label,
      description: r.description != null && String(r.description).trim() !== "" ? r.description : d.description,
      tickets: Number.isFinite(r.tickets) && r.tickets >= 1 ? r.tickets : d.tickets,
      proofFields: hasOwnProof ? r.proofFields! : d.proofFields,
      actionUrl: r.actionUrl?.trim() ? r.actionUrl : d.actionUrl,
      actionLabel: r.actionLabel?.trim() ? r.actionLabel : d.actionLabel,
    };
  });
}

/**
 * The Events sheet often still has older JSON arrays (3 or 6 rules) that match exactly the IDs
 * we have shipped as defaults in the past. We treat any such row as "use current defaults" so
 * removing unverifiable rules in code automatically removes them in the UI without sheet edits.
 */
export function isLegacyBonusRulesFingerprint(rules: BonusRule[]): boolean {
  if (!Array.isArray(rules) || !rules.length) return false;
  return rules.every((r) => SHIPPED_DEFAULT_IDS.has(String(r.id || "").trim()));
}

export function resolveBonusRules(event: { bonuses?: BonusRule[] | null }): BonusRule[] {
  const b = event.bonuses;
  let rules: BonusRule[];
  if (Array.isArray(b) && b.length > 0) {
    if (isLegacyBonusRulesFingerprint(b)) rules = DEFAULT_BONUS_RULES;
    else rules = b;
  } else {
    rules = DEFAULT_BONUS_RULES;
  }
  return mergeBonusRulesWithDefaults(rules);
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
