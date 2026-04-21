export type RaffleOption = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  sortOrder: number;
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
};

export type EntryPayload = {
  slug: string;
  name: string;
  phone: string;
  email: string;
  raffleId: string;
  bonusInstagram: boolean;
  bonusReview: boolean;
  bonusReferral: boolean;
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
