import express, { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { AiIntakeSchema } from "./ai.validators.js";
import { analyzeIntake, transcribeAudio } from "./ai.service.js";

export function aiRoutes() {
  const r = Router();

  r.post("/transcribe", authMiddleware, express.raw({ type: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/x-m4a", "audio/aac"], limit: "12mb" }), async (req: any, res, next) => {
    try {
      const mimeType = typeof req.headers["x-audio-mime-type"] === "string" ? req.headers["x-audio-mime-type"] : (req.headers["content-type"] ?? "audio/webm");
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
      if (!raw.length) throw new Error("Audio payload is empty");
      const text = await transcribeAudio(raw, mimeType);
      res.json({ ok: true, text });
    } catch (e) {
      next(e);
    }
  });

  // Keep it protected for now (you can open later)
  r.post("/intake", authMiddleware, async (req: any, res, next) => {
    try {
      const input = AiIntakeSchema.parse(req.body);
      const result = await analyzeIntake(input);
      res.json({ ok: true, result });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
