import { Router } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../utils/http.js";
import { newId } from "../../utils/ids.js";
import { notifyUser, notifyVendor } from "../../realtime/ws.js";
import {
  UpdateVendorProfileSchema,
  SubmitKycSchema,
  CreateServiceSchema,
} from "./vendor.validators.js";

// Small helper
function toNum(v: unknown) {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function vendorRoutes() {
  const r = Router();

  /**
   * -----------------------------------------
   * PUBLIC: Nearby vendors (Consumer/Search)
   * GET /vendors/nearby?lat=..&lng=..&radiusKm=..&categoryId=..&limit=..
   * -----------------------------------------
   */
  r.get("/nearby", async (req, res, next) => {
    try {
      const lat = toNum(req.query.lat);
      const lng = toNum(req.query.lng);
      const radiusKm = toNum(req.query.radiusKm) ?? 10;
      const limit = toNum(req.query.limit) ?? 20;
      const categoryId =
        typeof req.query.categoryId === "string" ? req.query.categoryId : null;

      if (lat == null || lng == null) {
        throw new HttpError(400, "lat and lng are required numbers");
      }

      const radiusMeters = radiusKm * 1000;

      // NOTE: PostGIS point expects (lng, lat)
      // Filters:
      // - vendor has location
      // - vendor online (optional – you can remove)
      // - optionally filter by category via VendorService
      const rows = categoryId
        ? await prisma.$queryRaw<
            Array<{
              id: string;
              businessName: string | null;
              city: string | null;
              coverageKm: number;
              isOnline: boolean;
              lat: number | null;
              lng: number | null;
              distance_m: number;
            }>
          >`
            select
              vp."id",
              vp."businessName",
              vp."city",
              vp."coverageKm",
              vp."isOnline",
              vp."lat",
              vp."lng",
              ST_Distance(
                vp."location",
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
              ) as distance_m
            from "VendorProfile" vp
            join "VendorService" vs
              on vs."vendorId" = vp."id"
             and vs."isActive" = true
            where vp."location" is not null
              and vp."isOnline" = true
              and vs."categoryId" = ${categoryId}
              and ST_DWithin(
                vp."location",
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
                ${radiusMeters}
              )
            order by distance_m asc
            limit ${limit};
          `
        : await prisma.$queryRaw<
            Array<{
              id: string;
              businessName: string | null;
              city: string | null;
              coverageKm: number;
              isOnline: boolean;
              lat: number | null;
              lng: number | null;
              distance_m: number;
            }>
          >`
            select
              vp."id",
              vp."businessName",
              vp."city",
              vp."coverageKm",
              vp."isOnline",
              vp."lat",
              vp."lng",
              ST_Distance(
                vp."location",
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
              ) as distance_m
            from "VendorProfile" vp
            where vp."location" is not null
              and vp."isOnline" = true
              and ST_DWithin(
                vp."location",
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
                ${radiusMeters}
              )
            order by distance_m asc
            limit ${limit};
          `;

      const vendors = rows.map((x) => ({
        ...x,
        distanceKm: Math.round((x.distance_m / 1000) * 10) / 10,
      }));

      res.json({ ok: true, vendors });
    } catch (e) {
      next(e);
    }
  });

  /**
   * -----------------------------------------
   * PUBLIC: Featured verified vendors for homepage
   * GET /vendors/featured?city=Lagos&limit=12
   * -----------------------------------------
   */
  r.get("/featured", async (req, res, next) => {
    try {
      const city = typeof req.query.city === "string" ? req.query.city : "Lagos";
      const limit = Math.min(toNum(req.query.limit) ?? 12, 30);

      const vendors = await prisma.vendorProfile.findMany({
        where: {
          kycStatus: "APPROVED",
          isOnline: true,
          city,
          services: { some: { isActive: true } },
        },
        include: {
          services: {
            where: { isActive: true },
            take: 2,
            include: { category: true },
            orderBy: { updatedAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });

      res.json({ ok: true, vendors });
    } catch (e) {
      next(e);
    }
  });

  /**
   * -----------------------------------------
   * PROTECTED: Vendor-only routes
   * -----------------------------------------
   */
  r.use(authMiddleware, requireRole("VENDOR"));

  r.post("/kyc/upload", async (req: any, res, next) => {
    try {
      const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : "document";
      const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
      const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "application/octet-stream";

      if (!base64) throw new HttpError(400, "base64 is required");

      const buffer = Buffer.from(base64, "base64");
      if (!buffer.length) throw new HttpError(400, "Invalid base64 payload");
      if (buffer.length > 6 * 1024 * 1024) throw new HttpError(413, "File is too large (max 6MB)");

      const ext = path.extname(fileName) || (mimeType.includes("pdf") ? ".pdf" : ".jpg");
      const safeName = `${randomUUID()}${ext.toLowerCase()}`;
      const uploadDir = path.resolve(process.cwd(), "uploads", "kyc");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, safeName), buffer);

      const url = `${req.protocol}://${req.get("host")}/uploads/kyc/${safeName}`;
      res.json({ ok: true, url });
    } catch (e) {
      next(e);
    }
  });

  r.post("/services/upload", async (req: any, res, next) => {
    try {
      const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : "service-image";
      const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
      const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "application/octet-stream";

      if (!base64) throw new HttpError(400, "base64 is required");

      const buffer = Buffer.from(base64, "base64");
      if (!buffer.length) throw new HttpError(400, "Invalid base64 payload");
      if (buffer.length > 6 * 1024 * 1024) throw new HttpError(413, "File is too large (max 6MB)");

      const ext = path.extname(fileName) || ".jpg";
      const safeName = `${randomUUID()}${ext.toLowerCase()}`;
      const uploadDir = path.resolve(process.cwd(), "uploads", "services");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, safeName), buffer);

      const url = `${req.protocol}://${req.get("host")}/uploads/services/${safeName}`;
      res.json({ ok: true, url });
    } catch (e) {
      next(e);
    }
  });

  r.get("/me", async (req: any, res) => {
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
      include: { services: { include: { category: true } }, user: true },
    });
    res.json({ ok: true, vendor });
  });

  r.patch("/me", async (req: any, res, next) => {
    try {
      const input = UpdateVendorProfileSchema.parse(req.body);
      const vendor = await prisma.vendorProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      const updated = await prisma.vendorProfile.update({
        where: { id: vendor.id },
        data: input,
      });
      res.json({ ok: true, vendor: updated });
    } catch (e) {
      next(e);
    }
  });

  /**
   * PATCH /vendors/me/location
   * Body: { lat: number, lng: number }
   */
  r.patch("/me/location", async (req: any, res, next) => {
    try {
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new HttpError(400, "lat and lng are required numbers");
      }

      const vendor = await prisma.vendorProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor) throw new HttpError(404, "Vendor not found");

      // Store both float columns + PostGIS geography point
      await prisma.$executeRaw`
        update "VendorProfile"
        set "lat" = ${lat},
            "lng" = ${lng},
            "location" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        where "id" = ${vendor.id};
      `;

      const refreshed = await prisma.vendorProfile.findUnique({
        where: { id: vendor.id },
      });

      const activeRequests = await prisma.request.findMany({
        where: {
          acceptedVendorId: vendor.id,
          status: { in: ["ACCEPTED", "IN_PROGRESS"] },
        },
      });

      for (const requestRow of activeRequests) {
        notifyUser(requestRow.consumerId, "vendor:location", {
          requestId: requestRow.id,
          vendorId: vendor.id,
          lat,
          lng,
          updatedAt: new Date().toISOString(),
        });
        notifyVendor(vendor.id, "vendor:location", {
          requestId: requestRow.id,
          vendorId: vendor.id,
          lat,
          lng,
          updatedAt: new Date().toISOString(),
        });
      }

      res.json({ ok: true, vendor: refreshed });
    } catch (e) {
      next(e);
    }
  });

  r.post("/kyc/submit", async (req: any, res, next) => {
    try {
      const input = SubmitKycSchema.parse(req.body);
      const vendor = await prisma.vendorProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor) throw new HttpError(404, "Vendor not found");
      if (!vendor.businessName || !vendor.city) {
        throw new HttpError(400, "Complete business profile (name + city) before KYC submission");
      }

      const submission = await prisma.kycSubmission.create({
        data: {
          id: newId("kyc"),
          vendorId: vendor.id,
          status: "SUBMITTED",
          idDocUrl: input.idDocUrl ?? (input.ninNumber ? `NIN:${input.ninNumber}` : null),
          selfieUrl: input.selfieUrl ?? null,
          businessDocUrl: input.businessDocUrl ?? null,
          skillProofUrl: input.skillProofUrl ?? null,
        },
      });

      await prisma.vendorProfile.update({
        where: { id: vendor.id },
        data: { kycStatus: "UNDER_REVIEW" },
      });

      res.json({ ok: true, submission });
    } catch (e) {
      next(e);
    }
  });

  r.post("/services", async (req: any, res, next) => {
    try {
      const input = CreateServiceSchema.parse(req.body);
      const vendor = await prisma.vendorProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor) throw new HttpError(404, "Vendor not found");
      if (vendor.kycStatus !== "APPROVED")
        throw new HttpError(403, "KYC not approved yet");

      const service = await prisma.vendorService.create({
        data: {
          id: newId("svc"),
          vendorId: vendor.id,
          categoryId: input.categoryId,
          title: input.title,
          pricingType: input.pricingType,
          priceFrom: input.priceFrom ?? null,
          coverImageUrl: input.coverImageUrl ?? null,
          galleryImageUrls: input.galleryImageUrls ?? [],
          isActive: input.isActive ?? true,
        },
      });

      res.json({ ok: true, service });
    } catch (e) {
      next(e);
    }
  });

  r.get("/services", async (req: any, res) => {
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!vendor)
      return res.status(404).json({ ok: false, message: "Vendor not found" });

    const services = await prisma.vendorService.findMany({
      where: { vendorId: vendor.id },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, services });
  });

  return r;
}
