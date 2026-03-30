import { z } from "zod";

export const CreateConversationSchema = z.object({
  vendorId: z.string().min(3).optional(),
  vendorUserId: z.string().min(3).optional(),
  requestId: z.string().min(3).optional(),
  serviceId: z.string().min(3).optional(),
  initialMessage: z.string().trim().min(1).max(2000).optional(),
});

export const SendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const UpdateReadSchema = z.object({
  messageId: z.string().min(3).optional(),
});

export const StartCallSchema = z.object({
  conversationId: z.string().min(3),
  type: z.enum(["AUDIO", "VIDEO"]).default("AUDIO"),
});

export const UpdateCallStatusSchema = z.object({
  status: z.enum(["ANSWERED", "DECLINED", "ENDED", "MISSED"]),
});
