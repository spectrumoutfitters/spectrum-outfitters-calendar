import test from "node:test";
import assert from "node:assert/strict";
import { isAnyPoolDrawLocked, DRAW_LOCK_MARGIN_MS } from "../src/lib/poolDrawLock.js";
import { classifyPaidApplyUpstream } from "../src/lib/paidApplyUpstream.js";

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

test("in-flight checkout destination still locks at apply time", () => {
  // Checkout at T−11m would have been allowed; payment at T−5m must still refuse apply.
  const now = new Date("2026-08-07T17:55:00.000Z").getTime();
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-a"], now), true);
});

test("existing unlocked pool does not mask a locked destination", () => {
  const now = new Date("2026-08-07T17:55:00.000Z").getTime();
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-a"], now), true);
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-b"], now), false);
});

test("pools without drawAt are never locked", () => {
  const now = new Date("2026-08-07T20:00:00.000Z").getTime();
  assert.equal(isAnyPoolDrawLocked(pools, ["pool-c"], now), false);
});

test("classifyPaidApplyUpstream: ok true → applied", () => {
  assert.deepEqual(classifyPaidApplyUpstream({ ok: true, alreadyApplied: false }), { kind: "applied" });
});

test("classifyPaidApplyUpstream: code locked → draw_locked (refund+ack)", () => {
  assert.deepEqual(
    classifyPaidApplyUpstream({
      ok: false,
      code: "locked",
      error: "Paid tickets cannot be applied within 10 minutes of a scheduled draw for that prize pool.",
    }),
    {
      kind: "draw_locked",
      code: "locked",
      error: "Paid tickets cannot be applied within 10 minutes of a scheduled draw for that prize pool.",
    },
  );
});

test("classifyPaidApplyUpstream: other failure → retry", () => {
  assert.deepEqual(classifyPaidApplyUpstream({ ok: false, code: "split", error: "ticket_split_mismatch" }), {
    kind: "retry",
    code: "split",
    error: "ticket_split_mismatch",
  });
});

test("classifyPaidApplyUpstream: missing/invalid body → retry", () => {
  assert.equal(classifyPaidApplyUpstream(null).kind, "retry");
  assert.equal(classifyPaidApplyUpstream("nope").kind, "retry");
});
