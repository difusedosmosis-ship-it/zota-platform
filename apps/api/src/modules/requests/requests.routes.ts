import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { prisma } from "../../prisma.js";
import { newId } from "../../utils/ids.js";
import { HttpError } from "../../utils/http.js";
import { CreateRequestSchema } from "./requests.validators.js";
import { dispatchOneByOne } from "./requests.service.js";
import { env } from "../../env.js";
import { notifyAdmins, notifyUser, notifyVendor } from "../../realtime/ws.js";

const OFFER_GRACE_MS = 15 * 60 * 1000;

export function requestsRoutes() {
  const r = Router();

  // -----------------------------
  // Consumer creates request
  // -----------------------------
  r.post("/", authMiddleware, requireRole("CONSUMER"), async (req: any, res, next) => {
    try {
      const input = CreateRequestSchema.parse(req.body);

      const request = await prisma.request.create({
        data: {
          id: newId("req"),
          consumerId: req.user.id,
          mode: input.mode,
          city: input.city,
          category: input.category,
          description: input.description,
          urgency: input.urgency,
          lat: input.lat,
          lng: input.lng,
          chosenVendorId: input.mode === "CHOOSE" ? (input.vendorId ?? null) : null,
          status: input.mode === "CHOOSE" ? "OFFERED" : "DISPATCHING",
        },
      });

      // Notify consumer immediately (request created)
      notifyUser(request.consumerId, "request_update", { request });
      await notifyAdmins("office:request_created", {
        requestId: request.id,
        category: request.category,
        city: request.city,
        status: request.status,
        createdAt: request.createdAt,
      });

      if (input.mode === "CHOOSE") {
        if (!input.vendorId) throw new HttpError(400, "vendorId required for CHOOSE mode");

        const vendor = await prisma.vendorProfile.findUnique({ where: { id: input.vendorId } });
        if (!vendor || vendor.kycStatus !== "APPROVED") throw new HttpError(400, "Vendor not eligible");

        const expiresAt = new Date(Date.now() + env.OFFER_EXPIRES_SECONDS * 1000);

        const offer = await prisma.dispatchOffer.create({
          data: {
            id: newId("off"),
            requestId: request.id,
            vendorId: vendor.id,
            status: "PENDING",
            expiresAt,
          },
          include: { request: true },
        });

        await prisma.request.update({
          where: { id: request.id },
          data: { status: "OFFERED" },
        });

        // Real-time: send offer to vendor
        notifyVendor(vendor.id, "offer", { offer });
      } else {
        // MATCHED dispatch
        await dispatchOneByOne(request.id);
      }

      res.json({ ok: true, id: request.id });
    } catch (e) {
      next(e);
    }
  });

  // =========================================================
  // IMPORTANT: put vendor routes BEFORE "/:id" route
  // =========================================================

  r.get("/me", authMiddleware, requireRole("CONSUMER"), async (req: any, res, next) => {
    try {
      const rows = await prisma.request.findMany({
        where: { consumerId: req.user.id },
        include: {
          offers: {
            include: {
              vendor: {
                include: { user: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      res.json({ ok: true, requests: rows });
    } catch (e) {
      next(e);
    }
  });

  r.get("/vendor/mine", authMiddleware, requireRole("VENDOR"), async (req: any, res, next) => {
    try {
      const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user.id } });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      const rows = await prisma.request.findMany({
        where: {
          OR: [
            { acceptedVendorId: vendor.id },
            { offers: { some: { vendorId: vendor.id } } },
          ],
        },
        include: {
          consumer: { select: { id: true, email: true, phone: true, fullName: true } },
          offers: {
            where: { vendorId: vendor.id },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      res.json({ ok: true, requests: rows });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------
  // Vendor checks their latest pending offer
  // + MVP auto-expire: if latest offer is expired, mark it expired and dispatch next
  // -----------------------------
  r.get("/vendor/my-offer/latest", authMiddleware, requireRole("VENDOR"), async (req: any, res, next) => {
    try {
      const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user.id } });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      // Find latest offer (including expired) to allow auto-expire progression
      const latest = await prisma.dispatchOffer.findFirst({
        where: { vendorId: vendor.id },
        orderBy: { createdAt: "desc" },
        include: { request: true },
      });

      // If the latest is pending but expired, expire it and dispatch next vendor
      if (latest && latest.status === "PENDING" && latest.expiresAt.getTime() + OFFER_GRACE_MS <= Date.now()) {
        await prisma.dispatchOffer.update({
          where: { id: latest.id },
          data: { status: "EXPIRED" },
        });

        // Continue dispatch (safe no-op if request already accepted/canceled)
        await dispatchOneByOne(latest.requestId);
      }

      // Return a fresh pending offer (not expired)
      const offer = await prisma.dispatchOffer.findFirst({
        where: {
          vendorId: vendor.id,
          status: "PENDING",
          expiresAt: { gt: new Date(Date.now() - OFFER_GRACE_MS) },
        },
        orderBy: { createdAt: "desc" },
        include: { request: true },
      });

      res.json({ ok: true, offer });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------
  // Vendor accepts offer (transaction + lock-safe)
  // + realtime updates to vendor + consumer
  // -----------------------------
  r.post("/offers/:offerId/accept", authMiddleware, requireRole("VENDOR"), async (req: any, res, next) => {
    try {
      const offerId = req.params.offerId;

      const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user.id } });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      const offer = await prisma.dispatchOffer.findUnique({ where: { id: offerId } });
      if (!offer) throw new HttpError(404, "Offer not found");
      if (offer.vendorId !== vendor.id) throw new HttpError(403, "Not your offer");
      if (offer.status !== "PENDING") throw new HttpError(400, "Offer not pending");
      if (offer.expiresAt.getTime() + OFFER_GRACE_MS <= Date.now()) {
        await prisma.dispatchOffer.update({ where: { id: offerId }, data: { status: "EXPIRED" } });
        // Continue dispatch to next vendor
        await dispatchOneByOne(offer.requestId);
        throw new HttpError(400, "Offer expired");
      }

      const updatedRequest = await prisma.$transaction(async (tx) => {
        const reqRow = await tx.request.findUnique({ where: { id: offer.requestId } });
        if (!reqRow) throw new HttpError(404, "Request not found");
        if (["CANCELED", "EXPIRED", "COMPLETED"].includes(reqRow.status)) {
          throw new HttpError(400, `Request is ${reqRow.status}`);
        }
        if (reqRow.acceptedVendorId) throw new HttpError(409, "Request already accepted");

        await tx.dispatchOffer.update({ where: { id: offerId }, data: { status: "ACCEPTED" } });

        const updated = await tx.request.update({
          where: { id: offer.requestId },
          data: {
            status: "ACCEPTED",
            acceptedVendorId: vendor.id,
            acceptedAt: new Date(),
          },
        });

        await tx.dispatchOffer.updateMany({
          where: { requestId: offer.requestId, id: { not: offerId }, status: "PENDING" },
          data: { status: "EXPIRED" },
        });

        return updated;
      });

      // Real-time status updates
      notifyUser(updatedRequest.consumerId, "request_update", { request: updatedRequest });
      notifyVendor(vendor.id, "request_update", { request: updatedRequest });
      await notifyAdmins("office:request_accepted", {
        requestId: updatedRequest.id,
        vendorId: vendor.id,
        status: updatedRequest.status,
        updatedAt: updatedRequest.updatedAt,
      });

      res.json({ ok: true, request: updatedRequest });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------
  // Vendor declines offer (then dispatch next vendor)
  // + realtime updates
  // -----------------------------
  r.post("/offers/:offerId/decline", authMiddleware, requireRole("VENDOR"), async (req: any, res, next) => {
    try {
      const offerId = req.params.offerId;

      const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user.id } });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      const offer = await prisma.dispatchOffer.findUnique({ where: { id: offerId } });
      if (!offer) throw new HttpError(404, "Offer not found");
      if (offer.vendorId !== vendor.id) throw new HttpError(403, "Not your offer");
      if (offer.status !== "PENDING") throw new HttpError(400, "Offer not pending");

      await prisma.dispatchOffer.update({ where: { id: offerId }, data: { status: "DECLINED" } });

      const reqRow = await prisma.request.findUnique({ where: { id: offer.requestId } });
      if (reqRow) {
        notifyUser(reqRow.consumerId, "request_update", { request: reqRow });
        notifyVendor(vendor.id, "request_update", { request: reqRow });
        await notifyAdmins("office:request_declined", {
          requestId: reqRow.id,
          vendorId: vendor.id,
          status: reqRow.status,
          updatedAt: reqRow.updatedAt,
        });
      }

      await dispatchOneByOne(offer.requestId);

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------
  // Vendor starts job
  // -----------------------------
  r.post("/:id/start", authMiddleware, requireRole("VENDOR"), async (req: any, res, next) => {
    try {
      const id = req.params.id;

      const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user.id } });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      const row = await prisma.request.findUnique({ where: { id } });
      if (!row) throw new HttpError(404, "Request not found");
      if (row.acceptedVendorId !== vendor.id) throw new HttpError(403, "Not your job");
      if (row.status !== "ACCEPTED") throw new HttpError(400, "Request not in ACCEPTED state");

      const updated = await prisma.request.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });

      notifyUser(updated.consumerId, "request_update", { request: updated });
      notifyVendor(vendor.id, "request_update", { request: updated });
      await notifyAdmins("office:job_started", {
        requestId: updated.id,
        vendorId: vendor.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
      });

      res.json({ ok: true, request: updated });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------
  // Vendor completes job
  // -----------------------------
  r.post("/:id/complete", authMiddleware, requireRole("VENDOR"), async (req: any, res, next) => {
    try {
      const id = req.params.id;
      const finalAmount = Number(req.body?.amount);

      const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user.id } });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      const row = await prisma.request.findUnique({ where: { id } });
      if (!row) throw new HttpError(404, "Request not found");
      if (row.acceptedVendorId !== vendor.id) throw new HttpError(403, "Not your job");
      if (row.status !== "IN_PROGRESS") throw new HttpError(400, "Request not in progress");

      const updated = await prisma.$transaction(async (tx) => {
        const nextRow = await tx.request.update({
          where: { id },
          data: { status: "COMPLETED" },
        });

        if (Number.isFinite(finalAmount) && finalAmount > 0) {
          const existingCredit = await tx.walletLedger.findFirst({
            where: { userId: req.user.id, refType: "service_earning", refId: nextRow.id },
          });

          if (!existingCredit) {
            const vendorAmount = Math.round(finalAmount * (1 - env.SERVICE_COMMISSION_RATE));
            await tx.walletLedger.create({
              data: {
                userId: req.user.id,
                amount: vendorAmount,
                currency: "NGN",
                reason: `Service earning (${nextRow.category})`,
                refType: "service_earning",
                refId: nextRow.id,
              },
            });
          }
        }

        return nextRow;
      });

      notifyUser(updated.consumerId, "request_update", { request: updated });
      notifyVendor(vendor.id, "request_update", { request: updated });
      await notifyAdmins("office:job_completed", {
        requestId: updated.id,
        vendorId: vendor.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
      });

      res.json({ ok: true, request: updated });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------
  // Consumer cancels request
  // -----------------------------
  r.post("/:id/cancel", authMiddleware, requireRole("CONSUMER"), async (req: any, res, next) => {
    try {
      const id = req.params.id;

      const row = await prisma.request.findUnique({ where: { id } });
      if (!row) throw new HttpError(404, "Request not found");
      if (row.consumerId !== req.user.id) throw new HttpError(403, "Not your request");
      if (["COMPLETED", "CANCELED", "EXPIRED"].includes(row.status)) throw new HttpError(400, "Cannot cancel");

      const updated = await prisma.request.update({
        where: { id },
        data: { status: "CANCELED" },
      });

      notifyUser(updated.consumerId, "request_update", { request: updated });
      if (updated.acceptedVendorId) notifyVendor(updated.acceptedVendorId, "request_update", { request: updated });
      await notifyAdmins("office:request_canceled", {
        requestId: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
      });

      res.json({ ok: true, request: updated });
    } catch (e) {
      next(e);
    }
  });

  // -----------------------------
  // Consumer or Vendor fetch request details
  // -----------------------------
  r.get("/:id", authMiddleware, async (req: any, res, next) => {
    try {
      const id = req.params.id;

      const row = await prisma.request.findUnique({
        where: { id },
        include: {
          offers: {
            include: { vendor: { include: { user: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!row) throw new HttpError(404, "Not found");
      res.json({ ok: true, request: row });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
