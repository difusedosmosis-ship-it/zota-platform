import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../utils/http.js";
import { notifyUser } from "../../realtime/ws.js";
import {
  CreateConversationSchema,
  SendMessageSchema,
  StartCallSchema,
  UpdateCallStatusSchema,
  UpdateReadSchema,
} from "./chat.validators.js";

function conversationScope(userId: string, role: "CONSUMER" | "VENDOR" | "ADMIN") {
  if (role === "CONSUMER") return { consumerId: userId };
  if (role === "VENDOR") return { vendorUserId: userId };
  return {
    OR: [{ consumerId: userId }, { vendorUserId: userId }],
  };
}

async function assertConversationAccess(conversationId: string, userId: string, role: "CONSUMER" | "VENDOR" | "ADMIN") {
  const row = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      consumer: true,
      vendorUser: true,
      vendor: true,
      service: { include: { category: true } },
      request: true,
    },
  });
  if (!row) throw new HttpError(404, "Conversation not found");
  if (role === "ADMIN") return row;
  if (row.consumerId !== userId && row.vendorUserId !== userId) throw new HttpError(403, "Forbidden");
  return row;
}

export function chatRoutes() {
  const r = Router();

  r.use(authMiddleware);

  r.get("/conversations", async (req: any, res, next) => {
    try {
      const rows = await prisma.conversation.findMany({
        where: conversationScope(req.user.id, req.user.role),
        include: {
          vendor: true,
          service: { include: { category: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 50,
      });
      res.json({ ok: true, conversations: rows });
    } catch (e) {
      next(e);
    }
  });

  r.post("/conversations", async (req: any, res, next) => {
    try {
      const input = CreateConversationSchema.parse(req.body);
      if (req.user.role !== "CONSUMER") throw new HttpError(403, "Only consumers can start new conversations");

      let vendorId = input.vendorId ?? null;
      let vendorUserId = input.vendorUserId ?? null;

      if (input.requestId) {
        const requestRow = await prisma.request.findUnique({ where: { id: input.requestId } });
        if (!requestRow) throw new HttpError(404, "Request not found");
        if (requestRow.consumerId !== req.user.id) throw new HttpError(403, "Not your request");
        if (!requestRow.acceptedVendorId) throw new HttpError(400, "Request has no accepted vendor yet");
        vendorId = requestRow.acceptedVendorId;
      }

      if (input.serviceId) {
        const service = await prisma.vendorService.findUnique({
          where: { id: input.serviceId },
          include: { vendor: true },
        });
        if (!service) throw new HttpError(404, "Service not found");
        vendorId = service.vendorId;
      }

      if (vendorId && !vendorUserId) {
        const vendor = await prisma.vendorProfile.findUnique({ where: { id: vendorId } });
        if (!vendor) throw new HttpError(404, "Vendor not found");
        vendorUserId = vendor.userId;
      }

      if (!vendorUserId) throw new HttpError(400, "Vendor is required");

      const existing = await prisma.conversation.findFirst({
        where: {
          consumerId: req.user.id,
          vendorUserId,
          requestId: input.requestId ?? null,
          serviceId: input.serviceId ?? null,
        },
      });

      const conversation =
        existing ??
        (await prisma.conversation.create({
          data: {
            consumerId: req.user.id,
            vendorUserId,
            vendorId,
            requestId: input.requestId ?? null,
            serviceId: input.serviceId ?? null,
            kind: input.requestId ? "REQUEST" : input.serviceId ? "SERVICE" : "DIRECT",
          },
          include: {
            vendor: true,
            service: { include: { category: true } },
          },
        }));

      let message = null;
      if (input.initialMessage) {
        message = await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            senderId: req.user.id,
            senderRole: "CONSUMER",
            body: input.initialMessage,
          },
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: message.createdAt },
        });
        notifyUser(vendorUserId, "chat:message", { conversationId: conversation.id, message });
      }

      res.json({ ok: true, conversation, message });
    } catch (e) {
      next(e);
    }
  });

  r.get("/conversations/:id/messages", async (req: any, res, next) => {
    try {
      await assertConversationAccess(req.params.id, req.user.id, req.user.role);
      const messages = await prisma.chatMessage.findMany({
        where: { conversationId: req.params.id },
        orderBy: { createdAt: "asc" },
        take: 200,
      });
      res.json({ ok: true, messages });
    } catch (e) {
      next(e);
    }
  });

  r.post("/conversations/:id/messages", async (req: any, res, next) => {
    try {
      const input = SendMessageSchema.parse(req.body);
      const conversation = await assertConversationAccess(req.params.id, req.user.id, req.user.role);

      const message = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: req.user.id,
          senderRole: req.user.role,
          body: input.body,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: message.createdAt },
      });

      const otherUserId = conversation.consumerId === req.user.id ? conversation.vendorUserId : conversation.consumerId;
      notifyUser(otherUserId, "chat:message", { conversationId: conversation.id, message });
      res.json({ ok: true, message });
    } catch (e) {
      next(e);
    }
  });

  r.post("/conversations/:id/read", async (req: any, res, next) => {
    try {
      const input = UpdateReadSchema.parse(req.body);
      const conversation = await assertConversationAccess(req.params.id, req.user.id, req.user.role);

      await prisma.chatMessage.updateMany({
        where: {
          conversationId: conversation.id,
          senderId: { not: req.user.id },
          ...(input.messageId ? { id: { lte: input.messageId } } : {}),
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      const otherUserId = conversation.consumerId === req.user.id ? conversation.vendorUserId : conversation.consumerId;
      notifyUser(otherUserId, "chat:read", { conversationId: conversation.id });

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post("/calls/start", async (req: any, res, next) => {
    try {
      const input = StartCallSchema.parse(req.body);
      const conversation = await assertConversationAccess(input.conversationId, req.user.id, req.user.role);
      const recipientId = conversation.consumerId === req.user.id ? conversation.vendorUserId : conversation.consumerId;

      const call = await prisma.callSession.create({
        data: {
          conversationId: conversation.id,
          initiatorId: req.user.id,
          recipientId,
          type: input.type,
        },
      });

      notifyUser(recipientId, "call:ringing", { call, conversationId: conversation.id });
      res.json({ ok: true, call });
    } catch (e) {
      next(e);
    }
  });

  r.post("/calls/:id/status", async (req: any, res, next) => {
    try {
      const input = UpdateCallStatusSchema.parse(req.body);
      const call = await prisma.callSession.findUnique({ where: { id: req.params.id } });
      if (!call) throw new HttpError(404, "Call not found");
      if (call.initiatorId !== req.user.id && call.recipientId !== req.user.id) throw new HttpError(403, "Forbidden");

      const updated = await prisma.callSession.update({
        where: { id: call.id },
        data: {
          status: input.status,
          answeredAt: input.status === "ANSWERED" ? new Date() : call.answeredAt,
          endedAt: ["ENDED", "DECLINED", "MISSED"].includes(input.status) ? new Date() : call.endedAt,
        },
      });

      const otherUserId = call.initiatorId === req.user.id ? call.recipientId : call.initiatorId;
      notifyUser(otherUserId, "call:status", { call: updated });
      res.json({ ok: true, call: updated });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
