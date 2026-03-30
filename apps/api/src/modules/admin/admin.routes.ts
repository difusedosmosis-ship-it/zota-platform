import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../utils/http.js";

export function adminRoutes() {
  const r = Router();
  r.use(authMiddleware, requireRole("ADMIN"));

  r.get("/kyc/submissions", async (_req, res) => {
    const rows = await prisma.kycSubmission.findMany({
      orderBy: { createdAt: "desc" },
      include: { vendor: { include: { user: true } } }
    });
    res.json({ ok: true, submissions: rows });
  });

  r.post("/kyc/:submissionId/approve", async (req, res, next) => {
    try {
      const id = req.params.submissionId;
      const sub = await prisma.kycSubmission.findUnique({ where: { id } });
      if (!sub) throw new HttpError(404, "Submission not found");

      await prisma.kycSubmission.update({ where: { id }, data: { status: "APPROVED", reviewerNote: req.body?.note ?? null } });
      await prisma.vendorProfile.update({ where: { id: sub.vendorId }, data: { kycStatus: "APPROVED", kycNote: req.body?.note ?? null } });

      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.post("/kyc/:submissionId/reject", async (req, res, next) => {
    try {
      const id = req.params.submissionId;
      const note = String(req.body?.note ?? "Rejected");
      const sub = await prisma.kycSubmission.findUnique({ where: { id } });
      if (!sub) throw new HttpError(404, "Submission not found");

      await prisma.kycSubmission.update({ where: { id }, data: { status: "REJECTED", reviewerNote: note } });
      await prisma.vendorProfile.update({ where: { id: sub.vendorId }, data: { kycStatus: "REJECTED", kycNote: note } });

      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get("/finance/vendors", async (_req, res, next) => {
    try {
      const vendors = await prisma.vendorProfile.findMany({
        include: {
          user: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });

      const rows = await Promise.all(
        vendors.map(async (vendor) => {
          const ledger = await prisma.walletLedger.findMany({
            where: { userId: vendor.userId },
            orderBy: { createdAt: "desc" },
            take: 200,
          });

          const balance = ledger.reduce((sum, row) => sum + row.amount, 0);
          const earnings = ledger.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
          const payouts = ledger.filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0);

          return {
            vendorId: vendor.id,
            userId: vendor.userId,
            businessName: vendor.businessName,
            email: vendor.user.email,
            kycStatus: vendor.kycStatus,
            balance,
            earnings,
            payouts,
          };
        }),
      );

      res.json({ ok: true, vendors: rows });
    } catch (e) {
      next(e);
    }
  });

  r.post("/finance/payouts/manual", async (req, res, next) => {
    try {
      const vendorId = String(req.body?.vendorId ?? "");
      const amount = Number(req.body?.amount);
      const note = String(req.body?.note ?? "Manual vendor payout");

      if (!vendorId) throw new HttpError(400, "vendorId is required");
      if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "amount must be greater than 0");

      const vendor = await prisma.vendorProfile.findUnique({
        where: { id: vendorId },
        include: { user: true },
      });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      const ledger = await prisma.walletLedger.findMany({
        where: { userId: vendor.userId },
        take: 500,
      });
      const balance = ledger.reduce((sum, row) => sum + row.amount, 0);
      if (balance < amount) throw new HttpError(400, "Vendor balance is lower than payout amount");

      const result = await prisma.$transaction(async (tx) => {
        const entry = await tx.walletLedger.create({
          data: {
            userId: vendor.userId,
            amount: -amount,
            currency: "NGN",
            reason: note,
            refType: "manual_payout",
            refId: vendor.id,
          },
        });

        const transaction = await tx.transaction.create({
          data: {
            userId: vendor.userId,
            amount,
            currency: "NGN",
            status: "PAID",
            provider: "manual_payout",
            providerRef: entry.id,
          },
        });

        return { entry, transaction };
      });

      res.json({ ok: true, payout: result });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
