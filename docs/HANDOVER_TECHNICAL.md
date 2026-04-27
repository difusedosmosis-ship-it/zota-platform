# Zota Technical Runbook

## System Surfaces

- backend API on Render
- consumer app on Vercel and iOS build path
- vendor app on Vercel and iOS build path
- admin app on Vercel
- public website on Vercel

## Core Technologies

- Next.js frontends
- Node.js/Express backend
- Prisma ORM
- PostgreSQL
- Paystack for wallet top-up flow
- OpenAI-backed AI assistant features
- websocket/realtime support

## Required Environment Variables

### Backend

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_CALLBACK_URL`

### Website

- `NEXT_PUBLIC_API_BASE`

### Frontend surfaces

- any app-specific API base or deployment variables required by current hosting configuration

## Deployment Targets

- backend: Render
- consumer: Vercel
- vendor: Vercel
- admin: Vercel
- website: Vercel

## Release Order

1. backend
2. admin
3. consumer
4. vendor
5. website
6. native mobile rebuilds where applicable

## Smoke Test Checklist

### Consumer

1. browse without login
2. log in
3. top up wallet
4. open AI assistant
5. send request
6. receive completion notification

### Vendor

1. log in
2. submit KYC
3. create service or asset
4. accept request
5. start job
6. complete job
7. verify wallet credit

### Office

1. log in
2. verify dashboard
3. verify KYC queue
4. verify catalog review
5. verify finance desk
6. verify office users page
7. verify communications and notifications

## Known Operational Architecture Notes

- office access is internal only
- office permission visibility is enforced in UI and backend
- runtime schema bootstrap exists to reduce production breakage around missing chat tables
- wallet settlement is wallet-based rather than direct card escrow

## Incident Response Guide

### If backend deploy fails

1. inspect Render build log
2. verify Prisma client generation
3. verify environment variables
4. verify database reachability

### If office routing breaks

1. verify Vercel deployment commit
2. verify auth cookie flow
3. verify middleware/proxy behavior
4. clear cookies and retry

### If chat/messages fail

1. inspect backend logs for chat route errors
2. verify runtime chat schema bootstrap
3. verify websocket server availability

### If wallet top-up fails

1. inspect Paystack configuration
2. inspect callback URL behavior
3. inspect backend payment route logs

## Maintenance Recommendation

- keep `v1.0.x` for hotfixes only
- use `v1.1.0` for structured improvements
- maintain release notes and deployment logs per version

## Related Docs

- [ARCHITECTURE.md](/Users/ochigaidoko/Documents/New%20project/docs/ARCHITECTURE.md)
- [API_ENDPOINT_MAP.md](/Users/ochigaidoko/Documents/New%20project/docs/API_ENDPOINT_MAP.md)
- [LOCAL_DOCKER_RUN.md](/Users/ochigaidoko/Documents/New%20project/docs/LOCAL_DOCKER_RUN.md)
- [ios-device-testing.md](/Users/ochigaidoko/Documents/New%20project/docs/ios-device-testing.md)
