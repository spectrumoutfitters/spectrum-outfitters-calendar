import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminUpstreamFromBody,
  adminUpstreamFromThrow,
  adminUpstreamPreflight,
} from "../src/lib/adminUpstreamProxy.ts";

describe("adminUpstreamPreflight", () => {
  it("rejects a missing key before reporting a missing Apps Script URL", () => {
    for (const header of [null, undefined, "", "   ", "\n\t"]) {
      const result = adminUpstreamPreflight(header, null);
      assert.deepEqual(result, {
        ok: false,
        status: 401,
        body: { ok: false, error: "missing_admin_key" },
      });
    }
  });

  it("rejects a present key when Apps Script is not configured", () => {
    for (const url of [null, undefined, ""]) {
      const result = adminUpstreamPreflight("secret", url);
      assert.deepEqual(result, {
        ok: false,
        status: 503,
        body: { ok: false, error: "server_misconfigured" },
      });
    }
  });

  it("forwards the trimmed key and the configured URL", () => {
    const result = adminUpstreamPreflight("  secret  ", "https://script.google.com/macros/s/abc/exec");
    assert.deepEqual(result, {
      ok: true,
      adminKey: "secret",
      appsScriptUrl: "https://script.google.com/macros/s/abc/exec",
    });
  });
});

describe("adminUpstreamFromThrow", () => {
  it("maps timeout and abort to 504", () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    const abort = new Error("aborted");
    abort.name = "AbortError";
    assert.deepEqual(adminUpstreamFromThrow(timeout), {
      status: 504,
      body: { ok: false, error: "apps_script_timeout" },
    });
    assert.deepEqual(adminUpstreamFromThrow(abort), {
      status: 504,
      body: { ok: false, error: "apps_script_timeout" },
    });
  });

  it("maps other failures to unreachable, including non-Error throws", () => {
    assert.deepEqual(adminUpstreamFromThrow(new Error("reset")), {
      status: 502,
      body: { ok: false, error: "upstream_unreachable" },
    });
    assert.deepEqual(adminUpstreamFromThrow("down"), {
      status: 502,
      body: { ok: false, error: "upstream_unreachable" },
    });
  });
});

describe("adminUpstreamFromBody", () => {
  it("rejects bodies that are not JSON", () => {
    for (const text of ["", "not-json", "<html>"]) {
      assert.deepEqual(adminUpstreamFromBody(true, 200, text), {
        status: 502,
        body: { ok: false, error: "upstream_not_json" },
      });
    }
  });

  it("returns 2xx JSON as HTTP 200 without rewriting the payload", () => {
    const body = { ok: true, pools: [{ id: "wheels" }], created: true };
    assert.deepEqual(adminUpstreamFromBody(true, 201, JSON.stringify(body)), {
      status: 200,
      body,
    });
  });

  it("passes through upstream error status and body", () => {
    const body = { ok: false, error: "bad_admin_key" };
    assert.deepEqual(adminUpstreamFromBody(false, 401, JSON.stringify(body)), {
      status: 401,
      body,
    });
    assert.deepEqual(adminUpstreamFromBody(false, 500, JSON.stringify({ ok: false })), {
      status: 500,
      body: { ok: false },
    });
  });
});
