import { PrismaClient } from "@prisma/client";

function resolveRuntimeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);

    // Supabase transaction pooler needs Prisma pgbouncer mode to avoid
    // prepared statement errors on pooled connections in production.
    if (url.hostname.includes("pooler.supabase.com")) {
      if (!url.searchParams.has("pgbouncer")) {
        url.searchParams.set("pgbouncer", "true");
      }
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
    }

    return url.toString();
  } catch {
    return raw;
  }
}

const runtimeUrl = resolveRuntimeDatabaseUrl();

export const prisma = runtimeUrl
  ? new PrismaClient({
      datasources: {
        db: { url: runtimeUrl },
      },
    })
  : new PrismaClient();
