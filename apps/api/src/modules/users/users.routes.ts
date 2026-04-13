import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { HttpError } from "../../utils/http.js";

export function usersRoutes() {
  const r = Router();

  r.get("/me", authMiddleware, async (req: any, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { vendorProfile: true }
    });
    res.json({ ok: true, user });
  });

  r.delete("/me", authMiddleware, async (req: any, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true },
      });
      if (!user) throw new HttpError(404, "User not found");

      await prisma.user.delete({ where: { id: req.user.id } });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
