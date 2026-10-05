import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffSetupRedirectUrl } from "../src/lib/staffSetupRedirectUrl.ts";

describe("staffSetupRedirectUrl", () => {
  it("defaults to the staff login host when the env value is missing", () => {
    const expected = "https://login.spectrumoutfitters.com/admin?raffleSetup=1";
    assert.equal(staffSetupRedirectUrl(undefined), expected);
    assert.equal(staffSetupRedirectUrl(""), expected);
  });

  it("strips one trailing slash and keeps a configured path", () => {
    assert.equal(
      staffSetupRedirectUrl("https://login.spectrumoutfitters.com/"),
      "https://login.spectrumoutfitters.com/admin?raffleSetup=1",
    );
    assert.equal(
      staffSetupRedirectUrl("https://staff.example/calendar"),
      "https://staff.example/calendar/admin?raffleSetup=1",
    );
    assert.equal(
      staffSetupRedirectUrl("https://staff.example/calendar/"),
      "https://staff.example/calendar/admin?raffleSetup=1",
    );
  });
});
