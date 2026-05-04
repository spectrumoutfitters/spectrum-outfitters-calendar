import crypto from "node:crypto";

/** HMAC-SHA256 hex of payload string with the shared secret used by Apps Script applyPaidTickets. */
export function signPaidPurchasePayload(payloadString: string): {
  signature: string;
  payloadString: string;
} {
  const secret = process.env.RAFFLE_PAID_PURCHASE_SECRET?.trim();
  if (!secret) {
    throw new Error("missing_paid_purchase_secret");
  }
  const signature = crypto.createHmac("sha256", secret).update(payloadString, "utf8").digest("hex");
  return { signature, payloadString };
}
