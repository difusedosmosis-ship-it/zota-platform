import { z } from "zod";

/**
 * Coerces "12" -> 12 and still returns a ZodNumber (NOT ZodEffects),
 * so we can chain .int().min().max() without TS errors.
 */
const zCoerceNumber = () => z.coerce.number().finite();
const optionalString = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().min(8).optional(),
  );

export const UpdateVendorProfileSchema = z
  .object({
    businessName: z.string().min(2).optional(),
    city: z.string().min(2).optional(),
    coverageKm: zCoerceNumber().int().min(1).max(100).optional(),
    isOnline: z.boolean().optional(),

    // ✅ vendor geo
    lat: zCoerceNumber().min(-90).max(90).optional(),
    lng: zCoerceNumber().min(-180).max(180).optional(),
  })
  .refine(
    (v) => (v.lat == null && v.lng == null) || (v.lat != null && v.lng != null),
    { message: "lat and lng must be provided together" }
  );

export const SubmitKycSchema = z.object({
  // NIN / government identity document
  idDocUrl: optionalString(),
  // Optional NIN number if user prefers number-first validation
  ninNumber: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().min(11).max(11).optional(),
  ),
  // Business registration certificate (optional for unregistered skilled workers)
  businessDocUrl: optionalString(),
  // Proof of address
  skillProofUrl: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      return value.trim();
    },
    z.string().min(8),
  ),
  // Optional selfie for stronger anti-fraud
  selfieUrl: optionalString(),
}).refine((v) => !!v.idDocUrl || !!v.ninNumber, {
  message: "Provide either idDocUrl or ninNumber",
});

export const CreateServiceSchema = z.object({
  categoryId: z.string().min(3),
  title: z.string().min(2),
  pricingType: z.enum(["fixed", "from", "quote"]).default("from"),
  priceFrom: zCoerceNumber().int().min(0).optional(),
  coverImageUrl: z.string().min(8).optional(),
  galleryImageUrls: z.array(z.string().min(8)).max(5).optional(),
  isActive: z.boolean().optional(),
});
