import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { prisma } from "../../prisma.js";
import { newId } from "../../utils/ids.js";
import { HttpError } from "../../utils/http.js";
import { CreateReviewSchema } from "./reviews.validators.js";

export function reviewsRoutes() {
  const r = Router();

  r.get("/vendor/:vendorId", async (req, res, next) => {
    try {
      const vendorId = req.params.vendorId;
      const limit = Math.min(Number(req.query.limit ?? 10), 20);

      const vendor = await prisma.vendorProfile.findUnique({
        where: { id: vendorId },
        select: { id: true, userId: true, businessName: true },
      });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      const [agg, reviews] = await Promise.all([
        prisma.review.aggregate({
          where: { vendorId: vendor.userId },
          _avg: { rating: true },
          _count: { _all: true },
        }),
        prisma.review.findMany({
          where: { vendorId: vendor.userId },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            consumer: { select: { id: true, fullName: true } },
          },
        }),
      ]);

      res.json({
        ok: true,
        vendor: { id: vendor.id, businessName: vendor.businessName },
        summary: {
          averageRating: agg._avg.rating ?? 0,
          totalReviews: agg._count._all ?? 0,
        },
        reviews,
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/", authMiddleware, requireRole("CONSUMER"), async (req: any, res, next) => {
    try {
      const input = CreateReviewSchema.parse(req.body);

      const request = await prisma.request.findUnique({ where: { id: input.requestId } });
      if (!request) throw new HttpError(404, "Request not found");
      if (request.consumerId !== req.user.id) throw new HttpError(403, "Not your request");
      if (!request.acceptedVendorId) throw new HttpError(400, "No accepted vendor yet");
      if (request.status !== "COMPLETED") throw new HttpError(400, "Request must be completed before review");

      const acceptedVendor = await prisma.vendorProfile.findUnique({
        where: { id: request.acceptedVendorId },
        select: { id: true, userId: true },
      });
      if (!acceptedVendor) throw new HttpError(400, "Accepted vendor not found");

      const existing = await prisma.review.findFirst({ where: { requestId: request.id, consumerId: req.user.id } });
      if (existing) throw new HttpError(409, "Review already submitted for this request");

      const review = await prisma.review.create({
        data: {
          id: newId("rev"),
          requestId: request.id,
          consumerId: req.user.id,
          vendorId: acceptedVendor.userId,
          rating: input.rating,
          comment: input.comment ?? null
        }
      });

      res.json({ ok: true, review });
    } catch (e) { next(e); }
  });

  return r;
}
