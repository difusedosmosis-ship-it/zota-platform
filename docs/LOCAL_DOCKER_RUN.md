# Local Docker Run (API + Postgres)

## Start
```bash
docker compose up --build
```

## Verify
```bash
curl http://localhost:8080/health
```

Expected response:
```json
{"ok":true}
```

## Stop
```bash
docker compose down
```

## Notes
- API container auto-runs `prisma db push` before starting.
- This local setup uses local Postgres and does not require Supabase.
- For app clients, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`.
