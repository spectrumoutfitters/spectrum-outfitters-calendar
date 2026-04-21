import type { BonusRule } from "@/lib/types";

const IG =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_RAFFLE_INSTAGRAM_URL) ||
  "https://www.instagram.com/spectrum.outfitters/";
const TT =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_RAFFLE_TIKTOK_URL) ||
  "https://www.tiktok.com/@spectrumoutfitters";
const FB =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_RAFFLE_FACEBOOK_URL) ||
  "https://www.facebook.com/spectrumoutfitters";

/**
 * Default bonus ladder when Events.bonusRulesJson is empty.
 * Proof fields are stored for staff to verify (no OAuth to Meta/TikTok in this app — see Official Rules).
 */
export const DEFAULT_BONUS_RULES: BonusRule[] = [
  {
    id: "instagram",
    label: "Instagram — follow us",
    description: "Follow the shop, then leave your @ so we can match your account before prizes.",
    tickets: 3,
    actionUrl: IG,
    actionLabel: "Open Instagram",
    proofFields: [
      {
        id: "handle",
        input: "text",
        label: "Your Instagram @username",
        placeholder: "@yourhandle",
        requiredWhenBonus: true,
      },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok — follow us",
    description: "Follow on TikTok for extra entries. We verify follows manually if you win.",
    tickets: 2,
    actionUrl: TT,
    actionLabel: "Open TikTok",
    proofFields: [
      {
        id: "handle",
        input: "text",
        label: "Your TikTok @username",
        placeholder: "@yourhandle",
        requiredWhenBonus: true,
      },
    ],
  },
  {
    id: "facebook",
    label: "Facebook — like our page",
    description: "Like Spectrum Outfitters on Facebook (public page). Optional note helps us verify.",
    tickets: 2,
    actionUrl: FB,
    actionLabel: "Open Facebook",
    proofFields: [
      {
        id: "note",
        input: "text",
        label: "First name on Facebook (optional)",
        placeholder: "So we can spot your like",
        requiredWhenBonus: false,
      },
    ],
  },
  {
    id: "story_tag",
    label: "Story or reel — tag us",
    description: "Post a public story or reel tagging the shop. Link helps us verify faster.",
    tickets: 4,
    proofFields: [
      {
        id: "handle",
        input: "text",
        label: "Your @ on that post",
        placeholder: "@yourhandle",
        requiredWhenBonus: true,
      },
      {
        id: "postUrl",
        input: "url",
        label: "Link to the post (optional)",
        placeholder: "https://…",
        requiredWhenBonus: false,
      },
    ],
  },
  {
    id: "review",
    label: "Leave a review",
    description: "Google, Facebook, Yelp, etc. Tell us where and (if you can) paste the review link.",
    tickets: 6,
    proofFields: [
      {
        id: "platform",
        input: "text",
        label: "Where did you review?",
        placeholder: "e.g. Google Maps, Facebook",
        requiredWhenBonus: true,
      },
      {
        id: "reviewUrl",
        input: "url",
        label: "Link to your review (optional)",
        placeholder: "https://…",
        requiredWhenBonus: false,
      },
    ],
  },
  {
    id: "referral",
    label: "Refer a friend",
    description: "They must submit their own entry and type your full name when asked.",
    tickets: 4,
    proofFields: [
      {
        id: "friendName",
        input: "text",
        label: "Friend's full name (as they'll enter it)",
        placeholder: "First Last",
        requiredWhenBonus: true,
      },
    ],
  },
];

/**
 * Events sheet often still has the original JSON: exactly instagram + review + referral, no proofFields.
 * That should not override the current default ladder (TikTok, Facebook, story tag, verification fields).
 */
export function isLegacyBonusRulesFingerprint(rules: BonusRule[]): boolean {
  if (!Array.isArray(rules) || rules.length !== 3) return false;
  const ids = new Set(rules.map((r) => String(r.id || "").trim()));
  if (!ids.has("instagram") || !ids.has("review") || !ids.has("referral")) return false;
  if (ids.size !== 3) return false;
  return !rules.some((r) => (r.proofFields?.length ?? 0) > 0);
}

export function resolveBonusRules(event: { bonuses?: BonusRule[] | null }): BonusRule[] {
  const b = event.bonuses;
  if (Array.isArray(b) && b.length > 0) {
    if (isLegacyBonusRulesFingerprint(b)) return DEFAULT_BONUS_RULES;
    return b;
  }
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
