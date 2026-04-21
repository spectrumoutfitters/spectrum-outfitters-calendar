export type RaffleOption = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  /** Shown on the entry page (e.g. "$450+ retail · No purchase necessary"). */
  valueLabel?: string;
  sortOrder: number;
};

/** Optional ticket multipliers — configure per event in Sheet column `bonusRulesJson` (JSON array). */
export type BonusRule = {
  id: string;
  label: string;
  description?: string;
  tickets: number;
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
  /** With ticketMode "split": true = equal split across all pools; false = use ticketSplit. */
  splitEvenly?: boolean;
  /** Pool id → ticket weight; must sum to full ticket count when splitEvenly is false. */
  ticketSplit?: Record<string, number>;
  /** Per bonus id from event rules — preferred for dynamic bonuses */
  bonusById?: Record<string, boolean>;
  bonusInstagram?: boolean;
  bonusReview?: boolean;
  bonusReferral?: boolean;
  /** Honeypot — must be empty */
  company?: string;
  termsAccepted: boolean;
  testMode: boolean;
};

export type SubmitEntryResult =
  | { ok: true; totalEntries: number; message?: string }
  | { ok: false; error: string; code?: string };

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
