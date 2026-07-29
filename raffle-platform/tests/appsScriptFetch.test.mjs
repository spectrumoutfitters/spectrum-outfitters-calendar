import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  APPS_SCRIPT_TIMEOUT_MS,
  fetchAppsScriptPost,
} from "../src/lib/appsScriptFetch.ts";

describe("fetchAppsScriptPost", () => {
  /** @type {ReturnType<typeof mock.fn> | null} */
  let fetchMock = null;
  /** @type {((ms: number) => AbortSignal) | undefined} */
  let originalTimeout = undefined;
  /** @type {number[]} */
  let timeoutArgs = [];

  beforeEach(() => {
    timeoutArgs = [];
    originalTimeout = AbortSignal.timeout;
    AbortSignal.timeout = (ms) => {
      timeoutArgs.push(ms);
      return originalTimeout(ms);
    };

    fetchMock = mock.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    mock.method(globalThis, "fetch", fetchMock);
  });

  afterEach(() => {
    if (originalTimeout) AbortSignal.timeout = originalTimeout;
    mock.restoreAll();
  });

  it("uses a 90s AbortSignal.timeout under the nginx proxy budget", async () => {
    assert.equal(APPS_SCRIPT_TIMEOUT_MS, 90_000);

    await fetchAppsScriptPost("https://script.example/exec", {
      action: "getAdminStats",
      slug: "demo",
    });

    assert.deepEqual(timeoutArgs, [90_000]);
    assert.equal(fetchMock.mock.callCount(), 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, "https://script.example/exec");
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "text/plain;charset=utf-8");
    assert.equal(
      init.body,
      JSON.stringify({ action: "getAdminStats", slug: "demo" }),
    );
    assert.ok(init.signal instanceof AbortSignal);
  });
});
