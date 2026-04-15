import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../utils/http.js";

export function adminRoutes() {
  const r = Router();
  r.use(authMiddleware, requireRole("ADMIN"));

  r.get("/overview", async (_req, res, next) => {
    try {
      const [
        users,
        vendors,
        submissions,
        categories,
        requests,
        conversations,
        latestMessages,
        latestSubmissions,
      ] = await Promise.all([
        prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
        prisma.vendorProfile.findMany({
          select: { id: true, isOnline: true, kycStatus: true, businessName: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 6,
        }),
        prisma.kycSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.category.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.request.findMany({ orderBy: { updatedAt: "desc" }, take: 120 }),
        prisma.conversation.findMany({ orderBy: { lastMessageAt: "desc" }, take: 40 }),
        prisma.chatMessage.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
        prisma.kycSubmission.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { vendor: { include: { user: true } } },
        }),
      ]);

      const roleCount = Object.fromEntries(users.map((row) => [row.role, row._count._all]));
      const requestStatusCounts = requests.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {});

      const kycPending = submissions.filter((row) => row.status === "SUBMITTED" || row.status === "UNDER_REVIEW").length;
      const approvedBusinesses = vendors.filter((row) => row.kycStatus === "APPROVED").length;
      const onlineBusinesses = vendors.filter((row) => row.isOnline).length;
      const activeJobs = requests.filter((row) => row.status === "ACCEPTED" || row.status === "IN_PROGRESS").length;
      const queuedJobs = requests.filter((row) => ["CREATED", "DISPATCHING", "OFFERED"].includes(row.status)).length;

      res.json({
        ok: true,
        overview: {
          users: {
            consumers: roleCount.CONSUMER ?? 0,
            vendors: roleCount.VENDOR ?? 0,
            admins: roleCount.ADMIN ?? 0,
            total: (roleCount.CONSUMER ?? 0) + (roleCount.VENDOR ?? 0) + (roleCount.ADMIN ?? 0),
          },
          vendors: {
            total: vendors.length,
            approved: approvedBusinesses,
            online: onlineBusinesses,
          },
          kyc: {
            total: submissions.length,
            pending: kycPending,
          },
          categories: {
            total: categories.length,
            latest: categories.slice(0, 8),
          },
          requests: {
            total: requests.length,
            activeJobs,
            queuedJobs,
            byStatus: requestStatusCounts,
          },
          communications: {
            conversations: conversations.length,
            messages: latestMessages.length,
          },
          latestKyc: latestSubmissions.map((row) => ({
            id: row.id,
            status: row.status,
            createdAt: row.createdAt,
            businessName: row.vendor.businessName,
            email: row.vendor.user.email,
          })),
          latestVendors: vendors,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  r.get("/notifications", async (_req, res, next) => {
    try {
      const [submissions, requests] = await Promise.all([
        prisma.kycSubmission.findMany({
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { vendor: { include: { user: true } } },
        }),
        prisma.request.findMany({
          orderBy: { updatedAt: "desc" },
          take: 12,
          include: { consumer: { select: { email: true, phone: true, fullName: true } } },
        }),
      ]);

      const items = [
        ...submissions.map((row) => ({
          id: `kyc:${row.id}`,
          type: "KYC_SUBMISSION",
          title: `${row.vendor.businessName ?? "Unnamed business"} submitted verification`,
          body: row.vendor.user.email ?? "Verification submission received.",
          createdAt: row.createdAt,
          href: "/kyc",
          status: row.status,
        })),
        ...requests.map((row) => ({
          id: `request:${row.id}`,
          type: "REQUEST_ACTIVITY",
          title: `${row.category} request is ${row.status.replaceAll("_", " ").toLowerCase()}`,
          body: row.consumer.fullName ?? row.consumer.email ?? row.consumer.phone ?? row.city,
          createdAt: row.updatedAt,
          href: "/dashboard",
          status: row.status,
        })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);

      res.json({ ok: true, notifications: items });
    } catch (e) {
      next(e);
    }
  });

  r.get("/communications", async (_req, res, next) => {
    try {
      const rows = await prisma.conversation.findMany({
        include: {
          consumer: { select: { id: true, email: true, phone: true, fullName: true } },
          vendorUser: { select: { id: true, email: true, phone: true, fullName: true } },
          vendor: { select: { businessName: true, city: true, kycStatus: true } },
          service: { select: { title: true, category: { select: { name: true } } } },
          request: { select: { id: true, category: true, city: true, status: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 50,
      });

      res.json({ ok: true, conversations: rows });
    } catch (e) {
      next(e);
    }
  });

  r.get("/kyc/submissions", async (_req, res) => {
    const rows = await prisma.kycSubmission.findMany({
      orderBy: { createdAt: "desc" },
      include: { vendor: { include: { user: true } } },
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
        include: { user: true },
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
