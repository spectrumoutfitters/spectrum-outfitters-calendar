import assert from "node:assert/strict";
import test from "node:test";
import { decodeTicketSplitMetadata, encodeTicketSplitMetadata } from "./stripeTicketSplitMetadata.js";

test("ticket split metadata round-trips large multi-pool purchases without truncation", () => {
  const split = {};
  for (let i = 0; i < 80; i++) {
    split[`pool-${String(i).padStart(2, "0")}-with-a-long-id`] = i + 1;
  }

  const metadata = encodeTicketSplitMetadata(split);

  assert.ok(Number(metadata.ticket_split_chunks) > 1);
  for (const value of Object.values(metadata)) {
    assert.ok(value.length <= 480);
  }
  assert.deepEqual(decodeTicketSplitMetadata(metadata), split);
});

test("ticket split metadata decoder remains compatible with legacy single-value metadata", () => {
  assert.deepEqual(decodeTicketSplitMetadata({ ticket_split: '{"a":2,"b":3}' }), { a: 2, b: 3 });
});
