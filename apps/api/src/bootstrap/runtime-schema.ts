import { prisma } from "../prisma.js";

async function run(statement: string) {
  await prisma.$executeRawUnsafe(statement);
}

export async function ensureRuntimeSchema() {
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "officeTitle" TEXT;`);
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "officePermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;`);
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDisabled" BOOLEAN NOT NULL DEFAULT false;`);
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);`);
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);`);
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLogoutAt" TIMESTAMP(3);`);
  await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastRoute" TEXT;`);

  await run(`
    CREATE TABLE IF NOT EXISTS "OfficeAuditLog" (
      "id" TEXT NOT NULL,
      "actorId" TEXT,
      "targetUserId" TEXT,
      "action" TEXT NOT NULL,
      "route" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OfficeAuditLog_pkey" PRIMARY KEY ("id")
    );
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OfficeAuditLog_actorId_fkey'
      ) THEN
        ALTER TABLE "OfficeAuditLog"
          ADD CONSTRAINT "OfficeAuditLog_actorId_fkey"
          FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OfficeAuditLog_targetUserId_fkey'
      ) THEN
        ALTER TABLE "OfficeAuditLog"
          ADD CONSTRAINT "OfficeAuditLog_targetUserId_fkey"
          FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`CREATE INDEX IF NOT EXISTS "OfficeAuditLog_actorId_createdAt_idx" ON "OfficeAuditLog"("actorId", "createdAt");`);
  await run(`CREATE INDEX IF NOT EXISTS "OfficeAuditLog_targetUserId_createdAt_idx" ON "OfficeAuditLog"("targetUserId", "createdAt");`);
  await run(`CREATE INDEX IF NOT EXISTS "OfficeAuditLog_action_createdAt_idx" ON "OfficeAuditLog"("action", "createdAt");`);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationKind') THEN
        CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'REQUEST', 'SERVICE');
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageSenderRole') THEN
        CREATE TYPE "MessageSenderRole" AS ENUM ('CONSUMER', 'VENDOR', 'ADMIN');
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallType') THEN
        CREATE TYPE "CallType" AS ENUM ('AUDIO', 'VIDEO');
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CallStatus') THEN
        CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ANSWERED', 'DECLINED', 'ENDED', 'MISSED');
      END IF;
    END $$;
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS "Conversation" (
      "id" TEXT NOT NULL,
      "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT',
      "consumerId" TEXT NOT NULL,
      "vendorUserId" TEXT NOT NULL,
      "vendorId" TEXT,
      "requestId" TEXT,
      "serviceId" TEXT,
      "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS "ChatMessage" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "senderId" TEXT NOT NULL,
      "senderRole" "MessageSenderRole" NOT NULL,
      "body" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "readAt" TIMESTAMP(3),
      CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS "CallSession" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "initiatorId" TEXT NOT NULL,
      "recipientId" TEXT NOT NULL,
      "type" "CallType" NOT NULL DEFAULT 'AUDIO',
      "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "answeredAt" TIMESTAMP(3),
      "endedAt" TIMESTAMP(3),
      CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
    );
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_consumerId_fkey'
      ) THEN
        ALTER TABLE "Conversation"
          ADD CONSTRAINT "Conversation_consumerId_fkey"
          FOREIGN KEY ("consumerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_vendorUserId_fkey'
      ) THEN
        ALTER TABLE "Conversation"
          ADD CONSTRAINT "Conversation_vendorUserId_fkey"
          FOREIGN KEY ("vendorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_vendorId_fkey'
      ) THEN
        ALTER TABLE "Conversation"
          ADD CONSTRAINT "Conversation_vendorId_fkey"
          FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_requestId_fkey'
      ) THEN
        ALTER TABLE "Conversation"
          ADD CONSTRAINT "Conversation_requestId_fkey"
          FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_serviceId_fkey'
      ) THEN
        ALTER TABLE "Conversation"
          ADD CONSTRAINT "Conversation_serviceId_fkey"
          FOREIGN KEY ("serviceId") REFERENCES "VendorService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_conversationId_fkey'
      ) THEN
        ALTER TABLE "ChatMessage"
          ADD CONSTRAINT "ChatMessage_conversationId_fkey"
          FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_senderId_fkey'
      ) THEN
        ALTER TABLE "ChatMessage"
          ADD CONSTRAINT "ChatMessage_senderId_fkey"
          FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CallSession_conversationId_fkey'
      ) THEN
        ALTER TABLE "CallSession"
          ADD CONSTRAINT "CallSession_conversationId_fkey"
          FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CallSession_initiatorId_fkey'
      ) THEN
        ALTER TABLE "CallSession"
          ADD CONSTRAINT "CallSession_initiatorId_fkey"
          FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CallSession_recipientId_fkey'
      ) THEN
        ALTER TABLE "CallSession"
          ADD CONSTRAINT "CallSession_recipientId_fkey"
          FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await run(`CREATE INDEX IF NOT EXISTS "Conversation_consumerId_idx" ON "Conversation"("consumerId");`);
  await run(`CREATE INDEX IF NOT EXISTS "Conversation_vendorUserId_idx" ON "Conversation"("vendorUserId");`);
  await run(`CREATE INDEX IF NOT EXISTS "Conversation_vendorId_idx" ON "Conversation"("vendorId");`);
  await run(`CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");`);
  await run(`CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");`);
  await run(`CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");`);
  await run(`CREATE INDEX IF NOT EXISTS "CallSession_conversationId_idx" ON "CallSession"("conversationId");`);
  await run(`CREATE INDEX IF NOT EXISTS "CallSession_initiatorId_idx" ON "CallSession"("initiatorId");`);
  await run(`CREATE INDEX IF NOT EXISTS "CallSession_recipientId_idx" ON "CallSession"("recipientId");`);
  await run(`CREATE INDEX IF NOT EXISTS "CallSession_status_idx" ON "CallSession"("status");`);
}
