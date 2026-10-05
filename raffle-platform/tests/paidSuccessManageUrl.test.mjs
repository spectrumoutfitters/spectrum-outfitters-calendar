import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paidSuccessEventLabel, paidSuccessManagePath } from "../src/lib/paidSuccessManageUrl.ts";

describe("paidSuccessEventLabel", () => {
  it("uses the event name after a successful config fetch", () => {
    assert.equal(paidSuccessEventLabel({ ok: true, event: { name: "Grand Opening" } }), "Grand Opening");
  });

  it("falls back when the event could not be loaded", () => {
    assert.equal(paidSuccessEventLabel({ ok: false }), "your raffle");
  });
});

describe("paidSuccessManagePath", () => {
  it("omits the token when checkout did not return one", () => {
    assert.equal(paidSuccessManagePath("grand-opening", undefined), "/e/grand-opening");
    assert.equal(paidSuccessManagePath("grand-opening", ""), "/e/grand-opening");
  });

  it("encodes slug and token so they cannot break the path or query", () => {
    assert.equal(
      paidSuccessManagePath("grand/opening", "tok&en=1"),
      "/e/grand%2Fopening/my-entry?token=tok%26en%3D1",
    );
    assert.equal(
      paidSuccessManagePath("grand opening", "a b"),
      "/e/grand%20opening/my-entry?token=a%20b",
    );
  });
});
