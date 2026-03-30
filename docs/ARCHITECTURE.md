# Beautiful Mind Monorepo Skeleton

## Apps
- `apps/consumer`: B2C client app
- `apps/vendor`: Vendor app (B2B)
- `apps/admin`: Backoffice dashboard

## Shared Packages
- `packages/ui`: Shared UI components
- `packages/types`: Shared domain types (API DTOs)
- `packages/config`: Shared lint/ts/build config

## Backend Integration
Use your existing backend as the single source of truth and expose one API base URL to all apps.

Recommended env keys per app:
- `API_BASE_URL`
- `APP_NAME`
- `APP_ENV`

## Suggested Next Build Order
1. Vendor KYC gating flow in `apps/vendor`
2. Service request flow in `apps/consumer`
3. Admin KYC review in `apps/admin`
4. Booking module (hotel/car/hall), then flights
