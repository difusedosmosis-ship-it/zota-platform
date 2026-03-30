export const DEFAULT_PHYSICAL_CATEGORIES = [
  "Mechanic",
  "Plumber",
  "Electrician",
  "Generator Repair",
  "AC Repair",
  "Tyre / Vulcanizer",
  "Battery Jumpstart",
  "Towing",
  "Cleaning",
  "Laundry",
  "Pest Control",
  "Home Moving",
  "Logistics",
  "Gadget Repair",
  "Phone Repair",
  "Laptop Repair",
  "Carpentry",
  "Painting",
  "Welding",
  "POP / Ceiling",
  "Interior Decor",
  "Security Installation",
  "CCTV Installation",
];

export const DEFAULT_BOOKING_CATEGORIES = [
  "Hotels",
  "Car Rentals",
  "Flights",
  "Event Halls",
];

export const ALL_DEFAULT_CATEGORIES = [
  ...DEFAULT_PHYSICAL_CATEGORIES.map((name) => ({ name, kind: "PHYSICAL" as const })),
  ...DEFAULT_BOOKING_CATEGORIES.map((name) => ({ name, kind: "BOOKING" as const })),
];
