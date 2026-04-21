export type RaffleOption = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  /** Shown on the entry page (e.g. "$450+ retail · No purchase necessary"). */
  valueLabel?: string;
  sortOrder: number;
  /** Optional ISO datetime when this pool is drawn (locks magic-link edits at T−10 minutes). */
  drawAt?: string;
};

/** One optional field when a bonus is checked (for staff verification; stored in sheet `extrasJson.__bonusProof`). */
export type BonusProofField = {
  id: string;
  label: string;
  placeholder?: string;
  /** default "text" */
  input?: "text" | "textarea" | "url";
  /** If true, entrant must fill this before submit when the bonus is on. */
  requiredWhenBonus?: boolean;
};

/** Optional ticket multipliers — configure per event in Sheet column `bonusRulesJson` (JSON array). */
export type BonusRule = {
  id: string;
  label: string;
  description?: string;
  tickets: number;
  /** Shown when the bonus is checked; answers saved for manual verification (no Instagram API in this build). */
  proofFields?: BonusProofField[];
  /** Opens in a new tab — e.g. your Instagram profile. */
  actionUrl?: string;
  actionLabel?: string;
};

export type EventBranding = {
  name: string;
  description?: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  /** "dark" | "light" — page chrome */
  theme: "dark" | "light";
};

export type EventConfig = EventBranding & {
  slug: string;
  active: boolean;
  defaultTestMode: boolean;
  raffles: RaffleOption[];
  /** From Apps Script when Events.bonusRulesJson is set; else client uses defaults. */
  bonuses?: BonusRule[];
};

export type EntryPayload = {
  slug: string;
  name: string;
  phone: string;
  email: string;
  /** Required when ticketMode is "single" (or omitted). */
  raffleId?: string;
  /** "single" = one pool (default). "split" = one sheet row per active pool with fractional tickets. */
  ticketMode?: "single" | "split";
  /** With ticketMode "split": true = equal split; false = use ticketSplit (legacy). */
  splitEvenly?: boolean;
  /**
   * When ticketMode is "split": optional subset of raffle ids to split across (even weights only).
   * Omit to split across all active pools (legacy). Must include at least two valid ids when set.
   */
  splitRaffleIds?: string[];
  /** Pool id → ticket weight; must sum to full ticket count when splitEvenly is false. */
  ticketSplit?: Record<string, number>;
  /** Per bonus id from event rules — preferred for dynamic bonuses */
  bonusById?: Record<string, boolean>;
  /** Optional answers keyed by bonus rule id, then proof field id. */
  bonusProof?: Record<string, Record<string, string>>;
  bonusInstagram?: boolean;
  bonusReview?: boolean;
  bonusReferral?: boolean;
  /** Honeypot — must be empty */
  company?: string;
  termsAccepted: boolean;
  testMode: boolean;
};

export type SubmitEntryResult =
  | {
      ok: true;
      totalEntries: number;
      message?: string;
      magicLinkSent?: boolean;
      poolsEntered?: number;
      ticketMode?: string;
      testMode?: boolean;
    }
  | { ok: false; error: string; code?: string };

/** Row returned by getEntryByToken (magic link). */
export type MyEntryPoolRow = {
  raffleId: string;
  title: string;
  tickets: number;
  drawAt: string;
};

export type MyEntrySnapshot = {
  slug: string;
  eventName: string;
  name: string;
  emailMasked: string;
  phoneLast4: string;
  ticketMode: "single" | "split";
  splitRaffleIds: string[];
  singleRaffleId: string;
  pools: MyEntryPoolRow[];
  totalTickets: number;
  bonusById: Record<string, boolean>;
  bonusProof: Record<string, Record<string, string>>;
  editLocked: boolean;
  bonuses?: BonusRule[];
};

export type AdminStats = {
  slug: string;
  totalParticipants: number;
  /** Distinct people (by phone) */
  uniqueParticipants: number;
  /** Rows in Entries for this slug (can exceed participants when tickets are split across pools). */
  entryRowCount?: number;
  entriesByRaffle: Record<string, { raffleTitle: string; tickets: number; people: number }>;
  lastUpdated: string;
};

/** Editable raffle row returned by getAdminEventConfig / saveEventConfig. */
export type AdminRaffleRow = {
  id: string;
  raffleId: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  /** Prize “sticker” value — what entrants could win (free). */
  valueLabel: string;
  sortOrder: number;
  active: boolean;
  /** ISO datetime text when this pool is drawn (optional). */
  drawAt: string;
  /**
   * Stable key for React lists only — not sent to the sheet API.
   * Must not change when the user edits `raffleId`, or inputs lose focus.
   */
  _clientListKey: string;
};

/** Event fields editable from admin (no adminKey). */
export type AdminEventEditable = {
  name: string;
  description: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  theme: "dark" | "light";
  active: boolean;
  defaultTestMode: boolean;
  blockTestWrite: boolean;
  bonusRulesJson: string;
};

export type DrawWinnerResult =
  | {
      ok: true;
      winner: {
        name: string;
        phone: string;
        email: string;
        raffleId: string;
        ticketsInPool: number;
        drawId: string;
      };
    }
  | { ok: false; error: string };
