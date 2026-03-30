import { prisma } from "../../prisma.js";
import { env } from "../../env.js";
import { HttpError } from "../../utils/http.js";
import { createHmac } from "node:crypto";

type PaystackInitArgs = {
  email: string;
  amount: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

type PaystackVerifyData = {
  status: string;
  reference: string;
  amount: number;
  metadata?: Record<string, unknown>;
};

function paystackHeaders() {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new HttpError(500, "Missing PAYSTACK_SECRET_KEY");
  }
  return {
    Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

export function generatePaymentReference(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function initializePaystackTransaction(args: PaystackInitArgs) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: paystackHeaders(),
    body: JSON.stringify({
      email: args.email,
      amount: args.amount * 100,
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
      currency: "NGN",
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | {
        status?: boolean;
        message?: string;
        data?: {
          authorization_url: string;
          access_code: string;
          reference: string;
        };
      }
    | null;

  if (!res.ok || !data?.status || !data.data?.authorization_url) {
    throw new HttpError(502, data?.message ?? "Failed to initialize payment");
  }

  return data.data;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyData> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: paystackHeaders(),
  });

  const data = (await res.json().catch(() => null)) as
    | {
        status?: boolean;
        message?: string;
        data?: {
          status: string;
          reference: string;
          amount: number;
          metadata?: Record<string, unknown>;
        };
      }
    | null;

  if (!res.ok || !data?.status || !data.data) {
    throw new HttpError(502, data?.message ?? "Failed to verify payment");
  }

  return {
    status: data.data.status,
    reference: data.data.reference,
    amount: Math.round(data.data.amount / 100),
    metadata: data.data.metadata,
  };
}

export function verifyPaystackSignature(rawBody: Buffer, signature?: string | string[]) {
  if (!signature || Array.isArray(signature) || !env.PAYSTACK_SECRET_KEY) return false;
  const hash = createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  return hash === signature;
}

export async function finalizeVerifiedPayment(reference: string, userId: string) {
  const tx = await prisma.transaction.findFirst({
    where: { providerRef: reference, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!tx) throw new HttpError(404, "Transaction not found");

  if (tx.status === "PAID") {
    return { type: tx.provider, transaction: tx };
  }

  const verification = await verifyPaystackTransaction(reference);
  if (verification.status !== "success") {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { status: "FAILED" },
    });
    throw new HttpError(400, `Payment verification returned ${verification.status}`);
  }

  if (tx.provider === "paystack_topup") {
    const existingCredit = await prisma.walletLedger.findFirst({
      where: { userId, refType: "topup", refId: tx.id },
    });

    await prisma.$transaction(async (db) => {
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: "PAID" },
      });

      if (!existingCredit) {
        await db.walletLedger.create({
          data: {
            userId,
            amount: tx.amount,
            currency: tx.currency,
            reason: "Wallet top-up",
            refType: "topup",
            refId: tx.id,
          },
        });
      }
    });

    return { type: "topup", transaction: { ...tx, status: "PAID" } };
  }

  if (tx.provider === "paystack_booking") {
    const order = await prisma.bookingOrder.findFirst({
      where: { providerRef: reference, userId },
      orderBy: { createdAt: "desc" },
      include: { listing: { include: { vendor: true } } },
    });
    if (!order) throw new HttpError(404, "Booking order not found");

    await prisma.$transaction(async (db) => {
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: "PAID" },
      });

      await db.bookingOrder.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });

      const vendorUserId = order.listing?.vendor?.userId;
      if (vendorUserId) {
        const existingCredit = await db.walletLedger.findFirst({
          where: { userId: vendorUserId, refType: "booking_earning", refId: order.id },
        });

        if (!existingCredit) {
          const vendorAmount = Math.round(order.amount * (1 - env.BOOKING_VENDOR_COMMISSION_RATE));
          await db.walletLedger.create({
            data: {
              userId: vendorUserId,
              amount: vendorAmount,
              currency: order.currency,
              reason: `Booking earning (${order.kind})`,
              refType: "booking_earning",
              refId: order.id,
            },
          });
        }
      }
    });

    return { type: "booking", transaction: { ...tx, status: "PAID" }, orderId: order.id };
  }

  throw new HttpError(400, "Unknown payment transaction type");
}
