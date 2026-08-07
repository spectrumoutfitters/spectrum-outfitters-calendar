import test from "node:test";
import assert from "node:assert/strict";
import { isAnyPoolDrawLocked, DRAW_LOCK_MARGIN_MS } from "../src/lib/poolDrawLock.js";

const pools = [
  { id: "pool-a", drawAt: "2026-08-07T18:00:00.000Z" },
  { id: "pool-b", drawAt: "2026-08-20T18:00:00.000Z" },
  { id: "pool-c", drawAt: "" },
];

test("unlocked when destination draw is more than 10 minutes away", () => {
  const now = new Date("2026-08-07T17:49:00.000Z").getTime();
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-a"], now), false);
});

test("locked at exactly T−10m for destination pool", () => {
  const draw = new Date("2026-08-07T18:00:00.000Z").getTime();
  const now = draw - DRAW_LOCK_MARGIN_MS;
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-a"], now), true);
});

test("locked after draw time", () => {
  const now = new Date("2026-08-07T18:01:00.000Z").getTime();
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-a"], now), true);
});

test("existing unlocked pool does not mask a locked destination", () => {
  // Entrant only holds pool-b (far away); crafted checkout targets locked pool-a.
  const now = new Date("2026-08-07T17:55:00.000Z").getTime();
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-a"], now), true);
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-b"], now), false);
});

test("pools without drawAt are never locked", () => {
  const now = new Date("2026-08-07T20:00:00.000Z").getTime();
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-c"], now), false);
});
