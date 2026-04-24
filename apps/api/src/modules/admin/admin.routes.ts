import { Router } from "express";
import { Prisma } from "@prisma/client";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../utils/http.js";
import { hashPassword } from "../auth/auth.service.js";
import { newId } from "../../utils/ids.js";

const OFFICE_AREAS = ["OVERVIEW", "KYC", "CATALOG", "FINANCE", "TEAM", "MESSAGES", "NOTIFICATIONS"] as const;
type OfficeArea = (typeof OFFICE_AREAS)[number];

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

async function safeQuery<T>(query: Promise<T>, fallback: T) {
  try {
    return await query;
  } catch (error) {
    if (isMissingTableError(error)) {
      return fallback;
    }
    throw error;
  }
}

function normalizeOfficePermissions(input: unknown): OfficeArea[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((value): value is OfficeArea => typeof value === "string" && OFFICE_AREAS.includes(value as OfficeArea))));
}

async function resolveOfficeActor(userId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      fullName: true,
      email: true,
      isSuperAdmin: true,
      isDisabled: true,
      officePermissions: true,
    },
  });
  if (!actor || actor.role !== "ADMIN") throw new HttpError(403, "Office access is restricted");
  if (actor.isDisabled) throw new HttpError(403, "This office account has been disabled");
  return actor;
}

async function hasOfficeSuperAdmin() {
  const count = await prisma.user.count({
    where: {
      role: "ADMIN",
      isDisabled: false,
      isSuperAdmin: true,
    },
  });
  return count > 0;
}

async function assertOfficeAccess(userId: string, area: OfficeArea) {
  const actor = await resolveOfficeActor(userId);
  const superAdminExists = await hasOfficeSuperAdmin();
  const hasArea = actor.officePermissions.includes(area);
  if (actor.isSuperAdmin || !superAdminExists || hasArea) return actor;
  throw new HttpError(403, `You do not have access to ${area.toLowerCase()} controls`);
}

async function assertSuperAdmin(userId: string) {
  const actor = await resolveOfficeActor(userId);
  const superAdminExists = await hasOfficeSuperAdmin();
  if (actor.isSuperAdmin || !superAdminExists) return actor;
  throw new HttpError(403, "Only the super admin can manage office users");
}

async function logOfficeEvent(args: {
  actorId?: string | null;
  targetUserId?: string | null;
  action: string;
  route?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await safeQuery(
    prisma.officeAuditLog.create({
      data: {
        id: newId("audit"),
        actorId: args.actorId ?? null,
        targetUserId: args.targetUserId ?? null,
        action: args.action,
        route: args.route ?? null,
        metadata: args.metadata,
      },
    }),
    null,
  );
}

function requestArea(path: string): OfficeArea | null {
  if (path.startsWith("/users")) return "TEAM";
  if (path.startsWith("/kyc")) return "KYC";
  if (path.startsWith("/catalog")) return "CATALOG";
  if (path.startsWith("/finance")) return "FINANCE";
  if (path.startsWith("/communications")) return "MESSAGES";
  if (path.startsWith("/notifications")) return "NOTIFICATIONS";
  if (path.startsWith("/overview")) return "OVERVIEW";
  return null;
}

export function adminRoutes() {
  const r = Router();
  r.use(authMiddleware, requireRole("ADMIN"));
  r.use(async (req: any, _res, next) => {
    try {
      if (req.path.startsWith("/users/me/activity") || req.path.startsWith("/users/me/logout")) {
        await resolveOfficeActor(req.user.id);
        return next();
      }

      const area = requestArea(req.path);
      if (area) {
        req.officeActor = await assertOfficeAccess(req.user.id, area);
      } else {
        req.officeActor = await resolveOfficeActor(req.user.id);
      }
      next();
    } catch (error) {
      next(error);
    }
  });

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
        latestCalls,
        officeUsers,
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
        safeQuery(prisma.conversation.findMany({ orderBy: { lastMessageAt: "desc" }, take: 40 }), []),
        safeQuery(prisma.chatMessage.findMany({ orderBy: { createdAt: "desc" }, take: 40 }), []),
        safeQuery(
          prisma.callSession.findMany({
            include: {
              initiator: { select: { fullName: true, email: true, phone: true } },
              recipient: { select: { fullName: true, email: true, phone: true } },
              conversation: {
                select: {
                  request: { select: { id: true, category: true, status: true } },
                  vendor: { select: { businessName: true } },
                },
              },
            },
            orderBy: { startedAt: "desc" },
            take: 12,
          }),
          [],
        ),
        prisma.user.findMany({
          where: { role: "ADMIN", isDisabled: false },
          select: {
            id: true,
            fullName: true,
            email: true,
            officeTitle: true,
            isSuperAdmin: true,
            lastSeenAt: true,
            lastRoute: true,
          },
          orderBy: [{ isSuperAdmin: "desc" }, { updatedAt: "desc" }],
          take: 12,
        }),
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
      const activeRequestRows = requests.filter((row) => row.status === "ACCEPTED" || row.status === "IN_PROGRESS").slice(0, 8);
      const expiredRequestRows = requests.filter((row) => row.status === "EXPIRED").slice(0, 8);

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
            detail: {
              active: activeRequestRows.map((row) => ({
                id: row.id,
                category: row.category,
                city: row.city,
                status: row.status,
                updatedAt: row.updatedAt,
              })),
              expired: expiredRequestRows.map((row) => ({
                id: row.id,
                category: row.category,
                city: row.city,
                status: row.status,
                updatedAt: row.updatedAt,
              })),
            },
          },
          communications: {
            conversations: conversations.length,
            messages: latestMessages.length,
            calls: latestCalls.length,
          },
          officeUsers: officeUsers.map((row) => ({
            id: row.id,
            name: row.fullName,
            email: row.email,
            officeTitle: row.officeTitle,
            isSuperAdmin: row.isSuperAdmin,
            isOnline: Boolean(row.lastSeenAt && Date.now() - new Date(row.lastSeenAt).getTime() < 2 * 60 * 1000),
            lastSeenAt: row.lastSeenAt,
            lastRoute: row.lastRoute,
          })),
          recentCalls: latestCalls.map((row) => ({
            id: row.id,
            type: row.type,
            status: row.status,
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            initiator: row.initiator.fullName ?? row.initiator.email ?? row.initiator.phone ?? "Unknown",
            recipient: row.recipient.fullName ?? row.recipient.email ?? row.recipient.phone ?? "Unknown",
            requestId: row.conversation?.request?.id ?? null,
            requestCategory: row.conversation?.request?.category ?? null,
            businessName: row.conversation?.vendor?.businessName ?? null,
          })),
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
      const rows = await safeQuery(prisma.conversation.findMany({
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
      }), []);

      res.json({ ok: true, conversations: rows });
    } catch (e) {
      next(e);
    }
  });

  r.get("/catalog/review", async (_req, res, next) => {
    try {
      const [services, listings] = await Promise.all([
        prisma.vendorService.findMany({
          include: {
            category: true,
            vendor: { include: { user: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        }),
        prisma.bookingListing.findMany({
          where: { provider: "LOCAL" },
          include: {
            vendor: { include: { user: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        }),
      ]);

      res.json({ ok: true, services, listings });
    } catch (e) {
      next(e);
    }
  });

  r.get("/users", async (_req, res, next) => {
    try {
      const [rows, audits] = await Promise.all([
        prisma.user.findMany({
        where: { role: "ADMIN" },
        orderBy: [{ isDisabled: "asc" }, { isSuperAdmin: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          officeTitle: true,
          officePermissions: true,
          isSuperAdmin: true,
          isDisabled: true,
          lastSeenAt: true,
          lastLoginAt: true,
          lastLogoutAt: true,
          lastRoute: true,
          createdAt: true,
        },
      }),
        safeQuery(
          prisma.officeAuditLog.findMany({
            where: {
              OR: [
                { actor: { role: "ADMIN" } },
                { targetUser: { role: "ADMIN" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 250,
          }),
          [],
        ),
      ]);

      const activityByUser = new Map<string, Array<{
        id: string;
        action: string;
        route: string | null;
        createdAt: Date;
        metadata: Prisma.JsonValue | null;
      }>>();

      for (const row of audits) {
        const keys = [row.actorId, row.targetUserId].filter(Boolean) as string[];
        for (const key of keys) {
          const bucket = activityByUser.get(key) ?? [];
          bucket.push({
            id: row.id,
            action: row.action,
            route: row.route,
            createdAt: row.createdAt,
            metadata: row.metadata,
          });
          activityByUser.set(key, bucket.slice(0, 12));
        }
      }

      res.json({
        ok: true,
        users: rows.map((row) => ({
          ...row,
          isOnline: Boolean(row.lastSeenAt && Date.now() - new Date(row.lastSeenAt).getTime() < 2 * 60 * 1000),
          recentActivity: (activityByUser.get(row.id) ?? []).slice(0, 8),
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/users", async (req: any, res, next) => {
    try {
      await assertSuperAdmin(req.user.id);
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      const fullName = String(req.body?.fullName ?? "").trim();
      const officeTitle = String(req.body?.officeTitle ?? "").trim();
      const requestedPermissions = normalizeOfficePermissions(req.body?.officePermissions);
      const isSuperAdmin = Boolean(req.body?.isSuperAdmin);

      if (!email || !email.includes("@")) throw new HttpError(400, "Valid email is required");
      if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
      if (!fullName) throw new HttpError(400, "Full name is required");
      if (!officeTitle) throw new HttpError(400, "Job position is required");

      const existing = await prisma.user.findFirst({
        where: { email },
      });
      if (existing) throw new HttpError(409, "This office email already exists");

      const officePermissions = isSuperAdmin ? [...OFFICE_AREAS] : requestedPermissions;
      if (!officePermissions.length) throw new HttpError(400, "At least one office permission is required");

      const user = await prisma.user.create({
        data: {
          id: newId("usr"),
          role: "ADMIN",
          email,
          passwordHash: await hashPassword(password),
          fullName,
          officeTitle,
          officePermissions,
          isSuperAdmin,
          lastLoginAt: null,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          officeTitle: true,
          officePermissions: true,
          isSuperAdmin: true,
          isDisabled: true,
          lastSeenAt: true,
          lastLoginAt: true,
          lastLogoutAt: true,
          lastRoute: true,
          createdAt: true,
        },
      });

      await logOfficeEvent({
        actorId: req.user.id,
        targetUserId: user.id,
        action: "office_user_created",
        route: "/team",
        metadata: {
          officeTitle,
          officePermissions,
          isSuperAdmin,
        },
      });

      res.json({ ok: true, user });
    } catch (e) {
      next(e);
    }
  });

  r.patch("/users/:id", async (req: any, res, next) => {
    try {
      await assertSuperAdmin(req.user.id);
      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true, isSuperAdmin: true, email: true },
      });
      if (!target || target.role !== "ADMIN") throw new HttpError(404, "Office user not found");

      const officeTitle = String(req.body?.officeTitle ?? "").trim();
      const requestedPermissions = normalizeOfficePermissions(req.body?.officePermissions);
      const isSuperAdmin = Boolean(req.body?.isSuperAdmin);
      const isDisabled = Boolean(req.body?.isDisabled);

      const superAdminCount = await prisma.user.count({ where: { role: "ADMIN", isSuperAdmin: true, isDisabled: false } });
      if (target.isSuperAdmin && !isSuperAdmin && superAdminCount <= 1) {
        throw new HttpError(400, "At least one active super admin must remain");
      }

      const officePermissions = isSuperAdmin ? [...OFFICE_AREAS] : requestedPermissions;
      if (!officePermissions.length) throw new HttpError(400, "At least one office permission is required");
      if (!officeTitle) throw new HttpError(400, "Job position is required");

      const user = await prisma.user.update({
        where: { id: target.id },
        data: {
          officeTitle,
          officePermissions,
          isSuperAdmin,
          isDisabled,
          passwordHash: isDisabled ? null : undefined,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          officeTitle: true,
          officePermissions: true,
          isSuperAdmin: true,
          isDisabled: true,
          lastSeenAt: true,
          lastLoginAt: true,
          lastLogoutAt: true,
          lastRoute: true,
          createdAt: true,
        },
      });

      await logOfficeEvent({
        actorId: req.user.id,
        targetUserId: user.id,
        action: "office_user_updated",
        route: "/team",
        metadata: {
          officeTitle,
          officePermissions,
          isSuperAdmin,
          isDisabled,
        },
      });

      res.json({ ok: true, user });
    } catch (e) {
      next(e);
    }
  });

  r.delete("/users/:id", async (req: any, res, next) => {
    try {
      await assertSuperAdmin(req.user.id);
      if (req.params.id === req.user.id) throw new HttpError(400, "Super admin cannot remove their own account here");

      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true, isSuperAdmin: true, email: true },
      });
      if (!target || target.role !== "ADMIN") throw new HttpError(404, "Office user not found");

      const superAdminCount = await prisma.user.count({ where: { role: "ADMIN", isSuperAdmin: true, isDisabled: false } });
      if (target.isSuperAdmin && superAdminCount <= 1) {
        throw new HttpError(400, "At least one active super admin must remain");
      }

      const disabledUser = await prisma.user.update({
        where: { id: target.id },
        data: {
          isDisabled: true,
          passwordHash: null,
          officePermissions: [],
          lastRoute: null,
          lastSeenAt: null,
          lastLogoutAt: new Date(),
          email: target.email ? `removed+${target.id}@zota.office` : null,
        },
        select: { id: true },
      });

      await logOfficeEvent({
        actorId: req.user.id,
        targetUserId: disabledUser.id,
        action: "office_user_removed",
        route: "/team",
        metadata: { targetId: disabledUser.id },
      });

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post("/users/me/activity", async (req: any, res, next) => {
    try {
      const actor = await resolveOfficeActor(req.user.id);
      const route = typeof req.body?.route === "string" ? req.body.route.slice(0, 180) : null;
      const action = typeof req.body?.action === "string" ? req.body.action.slice(0, 120) : "office_activity";
      const details = req.body?.details && typeof req.body.details === "object" ? req.body.details : undefined;

      await prisma.user.update({
        where: { id: actor.id },
        data: {
          lastSeenAt: new Date(),
          lastRoute: route ?? undefined,
        },
      });

      await logOfficeEvent({
        actorId: actor.id,
        action,
        route,
        metadata: details as Prisma.InputJsonValue | undefined,
      });

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post("/users/me/logout", async (req: any, res, next) => {
    try {
      const actor = await resolveOfficeActor(req.user.id);
      await prisma.user.update({
        where: { id: actor.id },
        data: {
          lastSeenAt: null,
          lastLogoutAt: new Date(),
        },
      });
      await logOfficeEvent({
        actorId: actor.id,
        action: "office_logout",
        route: req.body?.route ?? null,
      });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post("/catalog/services/:id/publish", async (req: any, res, next) => {
    try {
      const row = await prisma.vendorService.update({
        where: { id: req.params.id },
        data: { isActive: true },
      });
      await logOfficeEvent({
        actorId: req.user.id,
        action: "catalog_service_published",
        route: "/catalog",
        metadata: { serviceId: row.id, title: row.title },
      });
      res.json({ ok: true, service: row });
    } catch (e) {
      next(e);
    }
  });

  r.post("/catalog/services/:id/unpublish", async (req: any, res, next) => {
    try {
      const row = await prisma.vendorService.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      await logOfficeEvent({
        actorId: req.user.id,
        action: "catalog_service_unpublished",
        route: "/catalog",
        metadata: { serviceId: row.id, title: row.title },
      });
      res.json({ ok: true, service: row });
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

  r.post("/kyc/:submissionId/approve", async (req: any, res, next) => {
    try {
      const id = req.params.submissionId;
      const sub = await prisma.kycSubmission.findUnique({ where: { id } });
      if (!sub) throw new HttpError(404, "Submission not found");

      await prisma.kycSubmission.update({ where: { id }, data: { status: "APPROVED", reviewerNote: req.body?.note ?? null } });
      await prisma.vendorProfile.update({ where: { id: sub.vendorId }, data: { kycStatus: "APPROVED", kycNote: req.body?.note ?? null } });
      await logOfficeEvent({
        actorId: req.user.id,
        action: "kyc_approved",
        route: "/kyc",
        metadata: { submissionId: id, vendorId: sub.vendorId },
      });

      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.post("/kyc/:submissionId/reject", async (req: any, res, next) => {
    try {
      const id = req.params.submissionId;
      const note = String(req.body?.note ?? "Rejected");
      const sub = await prisma.kycSubmission.findUnique({ where: { id } });
      if (!sub) throw new HttpError(404, "Submission not found");

      await prisma.kycSubmission.update({ where: { id }, data: { status: "REJECTED", reviewerNote: note } });
      await prisma.vendorProfile.update({ where: { id: sub.vendorId }, data: { kycStatus: "REJECTED", kycNote: note } });
      await logOfficeEvent({
        actorId: req.user.id,
        action: "kyc_rejected",
        route: "/kyc",
        metadata: { submissionId: id, vendorId: sub.vendorId, note },
      });

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

      const userIds = vendors.map((vendor) => vendor.userId);
      const ledgerRows = userIds.length
        ? await prisma.walletLedger.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, amount: true },
          })
        : [];

      const ledgerByUser = new Map<string, { balance: number; earnings: number; payouts: number }>();
      for (const row of ledgerRows) {
        const current = ledgerByUser.get(row.userId) ?? { balance: 0, earnings: 0, payouts: 0 };
        current.balance += row.amount;
        if (row.amount > 0) current.earnings += row.amount;
        if (row.amount < 0) current.payouts += Math.abs(row.amount);
        ledgerByUser.set(row.userId, current);
      }

      const rows = vendors.map((vendor) => {
        const totals = ledgerByUser.get(vendor.userId) ?? { balance: 0, earnings: 0, payouts: 0 };
        return {
          vendorId: vendor.id,
          userId: vendor.userId,
          businessName: vendor.businessName,
          email: vendor.user.email,
          kycStatus: vendor.kycStatus,
          balance: totals.balance,
          earnings: totals.earnings,
          payouts: totals.payouts,
        };
      });

      res.json({ ok: true, vendors: rows });
    } catch (e) {
      next(e);
    }
  });

  r.post("/finance/payouts/manual", async (req: any, res, next) => {
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

      await logOfficeEvent({
        actorId: req.user.id,
        action: "manual_vendor_payout",
        route: "/finance",
        metadata: { vendorId, amount, note },
      });

      res.json({ ok: true, payout: result });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
