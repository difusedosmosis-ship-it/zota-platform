import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "test_secret";

const { generatePaymentReference, verifyPaystackSignature } = await import("../dist/modules/payments/payments.service.js");

test("generatePaymentReference prefixes references", async () => {
  const ref = generatePaymentReference("booking");
  assert.equal(ref.startsWith("booking_"), true);
});

test("verifyPaystackSignature validates correct signature", async () => {
  const body = Buffer.from(JSON.stringify({ event: "charge.success" }));
  const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(body).digest("hex");

  assert.equal(verifyPaystackSignature(body, signature), true);
  assert.equal(verifyPaystackSignature(body, "bad_signature"), false);
});
