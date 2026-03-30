import {
  BookingKind,
  BookingProvider,
  KycStatus,
  PrismaClient,
  Role,
} from "@prisma/client";
import { ALL_DEFAULT_CATEGORIES } from "../src/modules/categories/defaultCategories.js";

const prisma = new PrismaClient();

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Abuja: { lat: 9.0765, lng: 7.3986 },
  PortHarcourt: { lat: 4.8156, lng: 7.0498 },
  Ibadan: { lat: 7.3775, lng: 3.947 },
};

function around(base: number, variance = 0.08) {
  return Number((base + (Math.random() - 0.5) * variance).toFixed(6));
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🌱 Seeding database...");

  for (const item of ALL_DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: item.name },
      update: { kind: item.kind },
      create: { name: item.name, kind: item.kind },
    });
  }

  const physicalCategories = await prisma.category.findMany({
    where: { kind: "PHYSICAL" },
    orderBy: { name: "asc" },
  });

  const consumer = await prisma.user.upsert({
    where: { email: "consumer@test.com" },
    update: {},
    create: {
      role: Role.CONSUMER,
      email: "consumer@test.com",
      fullName: "Test Consumer",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {},
    create: {
      role: Role.ADMIN,
      email: "admin@test.com",
      fullName: "Platform Admin",
    },
  });

  const cities = Object.keys(CITY_CENTERS);

  for (let i = 1; i <= 50; i += 1) {
    const city = pick(cities);
    const center = CITY_CENTERS[city];
    const category = pick(physicalCategories);
    const basePrice = 5000 + Math.floor(Math.random() * 70000);

    const vendorUser = await prisma.user.upsert({
      where: { email: `vendor${i}@test.com` },
      update: {
        role: Role.VENDOR,
        fullName: `Vendor ${i}`,
      },
      create: {
        role: Role.VENDOR,
        email: `vendor${i}@test.com`,
        fullName: `Vendor ${i}`,
      },
    });

    const profile = await prisma.vendorProfile.upsert({
      where: { userId: vendorUser.id },
      update: {
        businessName: `BeautifulMind Vendor ${i}`,
        city,
        coverageKm: 6 + (i % 10),
        isOnline: true,
        kycStatus: KycStatus.APPROVED,
        lat: around(center.lat),
        lng: around(center.lng),
      },
      create: {
        userId: vendorUser.id,
        businessName: `BeautifulMind Vendor ${i}`,
        city,
        coverageKm: 6 + (i % 10),
        isOnline: true,
        kycStatus: KycStatus.APPROVED,
        lat: around(center.lat),
        lng: around(center.lng),
      },
    });

    await prisma.vendorService.deleteMany({
      where: { vendorId: profile.id, title: { startsWith: "Seed Service" } },
    });

    await prisma.vendorService.create({
      data: {
        vendorId: profile.id,
        categoryId: category.id,
        title: `Seed Service ${i}: ${category.name}`,
        pricingType: "from",
        priceFrom: basePrice,
        coverImageUrl: `https://picsum.photos/seed/bm-cover-${i}/900/700`,
        galleryImageUrls: [
          `https://picsum.photos/seed/bm-gal-${i}-1/900/700`,
          `https://picsum.photos/seed/bm-gal-${i}-2/900/700`,
          `https://picsum.photos/seed/bm-gal-${i}-3/900/700`,
        ],
        isActive: true,
      },
    });

    if (i <= 35) {
      const bookingKind = pick([BookingKind.HOTEL, BookingKind.CAR, BookingKind.HALL]);
      await prisma.bookingListing.deleteMany({
        where: { vendorId: profile.id, title: { startsWith: "Seed Booking" } },
      });

      await prisma.bookingListing.create({
        data: {
          vendorId: profile.id,
          provider: BookingProvider.LOCAL,
          kind: bookingKind,
          title: `Seed Booking ${i}: ${bookingKind} ${city}`,
          description: `Demo ${bookingKind.toLowerCase()} booking asset in ${city}`,
          city,
          lat: around(center.lat),
          lng: around(center.lng),
          currency: "NGN",
          pricePerDay: 15000 + Math.floor(Math.random() * 250000),
          isActive: true,
        },
      });
    }
  }

  await prisma.bookingListing.deleteMany({
    where: { title: { startsWith: "Seed Platform Booking" } },
  });

  for (let i = 1; i <= 24; i += 1) {
    const city = pick(cities);
    const center = CITY_CENTERS[city];
    const kind = pick([BookingKind.HOTEL, BookingKind.CAR, BookingKind.HALL, BookingKind.FLIGHT]);

    await prisma.bookingListing.create({
      data: {
        provider: BookingProvider.LOCAL,
        kind,
        title: `Seed Platform Booking ${i}: ${kind} ${city}`,
        description: `Platform-managed ${kind.toLowerCase()} listing in ${city}`,
        city,
        lat: around(center.lat),
        lng: around(center.lng),
        currency: "NGN",
        pricePerDay: 12000 + Math.floor(Math.random() * 350000),
        isActive: true,
      },
    });
  }

  console.log("✅ Seeding completed.");
  console.log(`👤 Consumer: ${consumer.email}`);
  console.log("👥 Vendors seeded: 50");
  console.log("🏨 Booking listings seeded: vendor + platform inventory");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
