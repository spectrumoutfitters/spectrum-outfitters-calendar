/** Whether a public raffle URL should render, 404, or show a setup/load error. */

type FailedFetch = { ok: false; error: string };
type EventWithRaffles = { raffles: readonly unknown[] };
type EventWithActive = EventWithRaffles & { active: unknown };

export type LiveDrawPageGate =
  | { kind: "missing_apps_script" }
  | { kind: "cannot_load"; error: string }
  | { kind: "no_active_pools" }
  | { kind: "board" };

export type EventEntryPageGate =
  | { kind: "missing_apps_script" }
  | { kind: "not_found" }
  | { kind: "entry" };

export type MyEntryPageGate =
  | { kind: "not_found" }
  | { kind: "manage"; initialToken: string };

/** Live board stays up for an inactive event as long as at least one pool exists. */
export function liveDrawPageGate(
  res: { ok: true; event: EventWithRaffles } | FailedFetch,
): LiveDrawPageGate {
  if (!res.ok) {
    if (res.error === "missing_apps_script_url") {
      return { kind: "missing_apps_script" };
    }
    return { kind: "cannot_load", error: res.error };
  }
  if (res.event.raffles.length === 0) {
    return { kind: "no_active_pools" };
  }
  return { kind: "board" };
}

/** Entry form requires an active event and at least one pool. */
export function eventEntryPageGate(
  res: { ok: true; event: EventWithActive } | FailedFetch,
): EventEntryPageGate {
  if (!res.ok) {
    if (res.error === "missing_apps_script_url") {
      return { kind: "missing_apps_script" };
    }
    return { kind: "not_found" };
  }
  if (!res.event.active || res.event.raffles.length === 0) {
    return { kind: "not_found" };
  }
  return { kind: "entry" };
}

/** Same visibility as the entry form. Only a string token is forwarded to the client. */
export function myEntryPageGate(
  res: { ok: true; event: EventWithActive } | FailedFetch,
  tokenParam: unknown,
): MyEntryPageGate {
  if (!res.ok) return { kind: "not_found" };
  if (!res.event.active || res.event.raffles.length === 0) {
    return { kind: "not_found" };
  }
  const initialToken = typeof tokenParam === "string" ? tokenParam : "";
  return { kind: "manage", initialToken };
}
