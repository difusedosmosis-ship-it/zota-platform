# Beautiful Mind

Monorepo for:
- Consumer app (`apps/consumer`)
- Vendor app (`apps/vendor`)
- Admin dashboard (`apps/admin`)
- Backend API (`apps/api`)

## Quick start

1. Backend setup:
```bash
cd apps/api
npm install
npm run prisma:generate
npm run build
```

2. Frontend setup (each app already scaffolded):
```bash
cp apps/consumer/.env.local.example apps/consumer/.env.local
cp apps/vendor/.env.local.example apps/vendor/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local
```

3. Start services:
```bash
npm run dev:api
npm run dev:consumer
npm run dev:vendor
npm run dev:admin
```

## Docs
- Architecture: `docs/ARCHITECTURE.md`
- Endpoint map: `docs/API_ENDPOINT_MAP.md`
- Docker local run: `docs/LOCAL_DOCKER_RUN.md`
