# Beautiful Mind API Endpoint Map

Base URL: `http://localhost:8080`

## Health
- `GET /health` - Service health check.

## Auth (`/auth`)
- `POST /auth/register` - Register `CONSUMER | VENDOR | ADMIN`.
- `POST /auth/login` - Login with email/phone + password.

## Users (`/users`)
- `GET /users/me` - Authenticated user profile.

## Categories (`/categories`)
- `GET /categories` - List service categories.
- `POST /categories` - Admin creates category.

## Vendor (`/vendor`)
- `GET /vendor/nearby` - Public vendor proximity search.
- `GET /vendor/me` - Vendor profile and services.
- `PATCH /vendor/me` - Update vendor business profile.
- `PATCH /vendor/me/location` - Update vendor geolocation.
- `POST /vendor/kyc/submit` - Submit KYC docs.
- `POST /vendor/services` - Create vendor service.
- `GET /vendor/services` - List own vendor services.

## Requests / Dispatch (`/requests`)
- `POST /requests` - Consumer creates service request (`CHOOSE` or `MATCHED`).
- `GET /requests/vendor/my-offer/latest` - Vendor latest pending offer.
- `POST /requests/offers/:offerId/accept` - Vendor accepts offer.
- `POST /requests/offers/:offerId/decline` - Vendor declines offer.
- `POST /requests/:id/start` - Vendor starts accepted job.
- `POST /requests/:id/complete` - Vendor completes in-progress job.
- `POST /requests/:id/cancel` - Consumer cancels own request.
- `GET /requests/:id` - Request detail.

## Reviews (`/reviews`)
- `POST /reviews` - Consumer rates a completed request/vendor.

## Wallet (`/wallet`)
- `GET /wallet/me/ledger` - Authenticated user ledger entries.

## Booking (`/booking`)
- `POST /booking/listings` - Admin create booking listing.
- `PATCH /booking/listings/:id` - Admin update listing.
- `POST /booking/listings/:id/publish` - Admin publish listing.
- `POST /booking/listings/:id/unpublish` - Admin unpublish listing.
- `GET /booking/listings` - List listings (auth required).
- `GET /booking/listings/:id` - Listing details.
- `POST /booking/search` - Search booking availability.
- `POST /booking/quote` - Consumer creates booking quote.
- `POST /booking/order/confirm` - Consumer confirms booking quote.
- `GET /booking/orders/me` - Consumer own booking orders.
- `GET /booking/orders/:id` - Consumer order detail.
- `POST /booking/providers/:provider/webhook` - Provider callback placeholder.

## Admin (`/admin`)
- `GET /admin/kyc/submissions` - List KYC submissions.
- `POST /admin/kyc/:submissionId/approve` - Approve KYC.
- `POST /admin/kyc/:submissionId/reject` - Reject KYC with reason.

## AI (`/ai`)
- `POST /ai/intake` - AI-assisted intake endpoint.

## WebSocket
- `ws://localhost:8080/ws?token=<JWT>`
- Events used now: `ready`, `offer`, `request_update`, `pong`.

## Quick App-to-API Mapping
- Consumer app first: `auth`, `categories`, `vendor/nearby`, `requests`, `reviews`, `booking`.
- Vendor app first: `auth`, `vendor/me`, `vendor/kyc/submit`, `vendor/services`, `requests/vendor/my-offer/latest`.
- Admin app first: `auth`, `admin/kyc/*`, `categories`, `booking/listings`.
