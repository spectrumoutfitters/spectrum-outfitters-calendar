import type { BonusRule } from "@/lib/types";

/**
 * Free bonus ladder.
 *
 * As of v3 the only free-ticket bonus is the email newsletter opt-in, and that one is intentionally
 * NOT modelled as a `BonusRule` — it uses a dedicated checkbox on the entry form; when opted in,
 * bonus tickets apply immediately server-side (`totalEntries` includes them on submit/update).
 *
 * `DEFAULT_BONUS_RULES` is therefore an empty array. Older versions of this app shipped Instagram
 * follow / TikTok follow / Facebook follow / story tag / public review / refer-a-friend rules
 * that turned out to be unverifiable at scale. We keep the ID list around so legacy sheet rows
 * that just echo old defaults can be cleanly stripped (see `isLegacyBonusRulesFingerprint`).
 *
 * Operators who want a custom bonus ladder can still set Events.bonusRulesJson to a JSON array of
 * `BonusRule` objects in the sheet — those are honoured as-is.
 */
export const DEFAULT_BONUS_RULES: BonusRule[] = [];

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
 * Old Events.bonusRulesJson rows often still hold one of the previously-shipped default lists.
 * Detecting that fingerprint lets us swap to the current defaults (now empty) automatically,
 * without the operator having to clear the JSON manually.
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

/**
 * Sum the ticket count for an entry: a configurable base plus any selected (custom) bonus rules.
 * The default base is 2 — operators can override per event via `baseTicketsPerEntry`.
 *
 * NOTE: Newsletter opt-in tickets are added in the UI preview (`EventEntryClient` combines this
 * helper plus the checkbox) and persisted by the Apps Script submit/update handlers — not inside
 * this function.
 */
export function computeTicketsFromBonuses(
  selections: Record<string, boolean>,
  rules: { id: string; tickets: number }[],
  baseTickets: number = 2,
): number {
  let n = Math.max(1, Math.floor(Number(baseTickets) || 2));
  for (const r of rules) {
    if (selections[r.id]) n += r.tickets;
  }
  return n;
}
