import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../utils/http.js";
import {
  initializePaystackTransaction,
  generatePaymentReference,
  finalizeVerifiedPayment,
  verifyPaystackSignature,
} from "./payments.service.js";

export function paymentsRoutes() {
  const r = Router();

  r.post("/webhook/paystack", async (req: any, res, next) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
      const signature = req.headers["x-paystack-signature"];

      if (!verifyPaystackSignature(rawBody, signature)) {
        throw new HttpError(401, "Invalid webhook signature");
      }

      const event = JSON.parse(rawBody.toString("utf8")) as {
        event?: string;
        data?: {
          reference?: string;
          metadata?: { userId?: string };
        };
      };

      if (event.event === "charge.success" && event.data?.reference && event.data.metadata?.userId) {
        await finalizeVerifiedPayment(event.data.reference, event.data.metadata.userId);
      }

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.use(authMiddleware);

  r.post("/topup/init", async (req: any, res, next) => {
    try {
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < 100) throw new HttpError(400, "amount must be at least 100");

      const email =
        (typeof req.body?.email === "string" && req.body.email.trim()) ||
        req.user.email ||
        `${req.user.id}@users.zota.app`;

      const reference = generatePaymentReference("topup");
      const callbackUrl = typeof req.body?.callbackUrl === "string" ? req.body.callbackUrl : undefined;

      const payment = await initializePaystackTransaction({
        email,
        amount,
        reference,
        callbackUrl,
        metadata: { type: "topup", userId: req.user.id },
      });

      const tx = await prisma.transaction.create({
        data: {
          userId: req.user.id,
          amount,
          currency: "NGN",
          status: "PENDING",
          provider: "paystack_topup",
          providerRef: reference,
        },
      });

      res.json({ ok: true, transaction: tx, payment });
    } catch (e) {
      next(e);
    }
  });

  r.post("/verify", async (req: any, res, next) => {
    try {
      const reference = typeof req.body?.reference === "string" ? req.body.reference : "";
      if (!reference) throw new HttpError(400, "reference is required");

      const result = await finalizeVerifiedPayment(reference, req.user.id);
      res.json({ ok: true, result });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
