export type RaffleOption = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
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
  raffleId: string;
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
  entriesByRaffle: Record<string, { raffleTitle: string; tickets: number; people: number }>;
  lastUpdated: string;
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
