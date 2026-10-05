import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventEntryPageGate,
  liveDrawPageGate,
  myEntryPageGate,
} from "../src/lib/rafflePublicPageGate.ts";

const pool = { id: "wheels" };

describe("liveDrawPageGate", () => {
  it("shows the setup screen only when Apps Script is missing", () => {
    assert.deepEqual(liveDrawPageGate({ ok: false, error: "missing_apps_script_url" }), {
      kind: "missing_apps_script",
    });
  });

  it("keeps other load failures on the cannot-load screen with the error code", () => {
    assert.deepEqual(liveDrawPageGate({ ok: false, error: "invalid_response" }), {
      kind: "cannot_load",
      error: "invalid_response",
    });
  });

  it("asks for pools when the event loaded with none", () => {
    assert.deepEqual(liveDrawPageGate({ ok: true, event: { raffles: [] } }), {
      kind: "no_active_pools",
    });
  });

  it("shows the board when a pool exists, including an inactive event", () => {
    assert.deepEqual(
      liveDrawPageGate({ ok: true, event: { active: false, raffles: [pool] } }),
      { kind: "board" },
    );
  });
});

describe("eventEntryPageGate", () => {
  it("shows setup when Apps Script is missing and 404s other load failures", () => {
    assert.deepEqual(eventEntryPageGate({ ok: false, error: "missing_apps_script_url" }), {
      kind: "missing_apps_script",
    });
    assert.deepEqual(eventEntryPageGate({ ok: false, error: "invalid_response" }), {
      kind: "not_found",
    });
  });

  it("404s an inactive event or an event with no pools", () => {
    assert.deepEqual(eventEntryPageGate({ ok: true, event: { active: false, raffles: [pool] } }), {
      kind: "not_found",
    });
    assert.deepEqual(eventEntryPageGate({ ok: true, event: { active: 0, raffles: [pool] } }), {
      kind: "not_found",
    });
    assert.deepEqual(eventEntryPageGate({ ok: true, event: { active: true, raffles: [] } }), {
      kind: "not_found",
    });
  });

  it("renders the form for an active event with pools, including numeric 1", () => {
    assert.deepEqual(eventEntryPageGate({ ok: true, event: { active: true, raffles: [pool] } }), {
      kind: "entry",
    });
    assert.deepEqual(eventEntryPageGate({ ok: true, event: { active: 1, raffles: [pool] } }), {
      kind: "entry",
    });
  });
});

describe("myEntryPageGate", () => {
  const open = { ok: true, event: { active: true, raffles: [pool] } };

  it("404s failed, inactive, and empty events even when a token is present", () => {
    assert.deepEqual(myEntryPageGate({ ok: false, error: "invalid_response" }, "tok"), {
      kind: "not_found",
    });
    assert.deepEqual(myEntryPageGate({ ok: true, event: { active: false, raffles: [pool] } }, "tok"), {
      kind: "not_found",
    });
    assert.deepEqual(myEntryPageGate({ ok: true, event: { active: true, raffles: [] } }, "tok"), {
      kind: "not_found",
    });
  });

  it("forwards only a string token", () => {
    assert.deepEqual(myEntryPageGate(open, "magic+tok"), {
      kind: "manage",
      initialToken: "magic+tok",
    });
    assert.deepEqual(myEntryPageGate(open, ""), { kind: "manage", initialToken: "" });
    assert.deepEqual(myEntryPageGate(open, undefined), { kind: "manage", initialToken: "" });
    assert.deepEqual(myEntryPageGate(open, ["magic", "other"]), { kind: "manage", initialToken: "" });
    assert.deepEqual(myEntryPageGate(open, 1), { kind: "manage", initialToken: "" });
  });
});
