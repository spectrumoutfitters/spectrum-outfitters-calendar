import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function readRepoFile(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function indexOfOrThrow(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `Expected source to contain ${needle}`);
  return index;
}

test("raffle refund route authorizes before touching Stripe", () => {
  const source = readRepoFile("src/app/api/admin/[slug]/refund/route.ts");

  const verifyIndex = indexOfOrThrow(source, "verifyRaffleAdminKey(slug, adminKey)");
  const retrieveIndex = indexOfOrThrow(source, "stripe.checkout.sessions.retrieve");
  const refundIndex = indexOfOrThrow(source, "stripe.refunds.create");

  assert.ok(verifyIndex < retrieveIndex, "admin key must be verified before Stripe session lookup");
  assert.ok(verifyIndex < refundIndex, "admin key must be verified before creating a Stripe refund");
});

test("raffle refund route rejects sessions from other raffles before refunding", () => {
  const source = readRepoFile("src/app/api/admin/[slug]/refund/route.ts");

  const slugMismatchIndex = indexOfOrThrow(source, "session_slug_mismatch");
  const refundIndex = indexOfOrThrow(source, "stripe.refunds.create");

  assert.ok(slugMismatchIndex < refundIndex, "slug mismatch guard must run before Stripe refund creation");
});

test("Apps Script applies paid tickets only from the signed payload string", () => {
  const source = readRepoFile("google-apps-script/Code.gs");

  const mismatchIndex = indexOfOrThrow(source, "payload_mismatch");
  const verifyIndex = indexOfOrThrow(source, "verifyPaidPurchaseSignature_(payloadString, sig)");

  assert.ok(mismatchIndex < verifyIndex, "payload object must match payloadString before signature verification");
});

test("Apps Script validates replacement split rows before deleting old rows", () => {
  const source = readRepoFile("google-apps-script/Code.gs");
  const updateBody = source.slice(indexOfOrThrow(source, "function handleUpdateEntryByToken_(data)"));

  const preflightIndex = indexOfOrThrow(updateBody, "var preflightPlan = buildTicketSplitPlan_");
  const deleteIndex = indexOfOrThrow(updateBody, "deleteEntrySheetRowsDescending_(editableRowNums)");

  assert.ok(preflightIndex < deleteIndex, "split validation must happen before editable rows are deleted");
});
