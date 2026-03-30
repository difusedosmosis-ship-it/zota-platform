import { Router } from "express";
import { prisma } from "../../prisma.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { newId } from "../../utils/ids.js";
import { CreateCategorySchema } from "./categories.validators.js";
import { ALL_DEFAULT_CATEGORIES } from "./defaultCategories.js";

export function categoriesRoutes() {
  const r = Router();

  r.get("/", async (_req, res) => {
    let cats = await prisma.category.findMany({ orderBy: { name: "asc" } });
    if (!cats.length) {
      await prisma.$transaction(
        ALL_DEFAULT_CATEGORIES.map((item) =>
          prisma.category.upsert({
            where: { name: item.name },
            update: { kind: item.kind },
            create: { id: newId("cat"), name: item.name, kind: item.kind },
          }),
        ),
      );
      cats = await prisma.category.findMany({ orderBy: { name: "asc" } });
    }
    res.json({ ok: true, categories: cats });
  });

  r.post("/", authMiddleware, requireRole("ADMIN"), async (req, res, next) => {
    try {
      const input = CreateCategorySchema.parse(req.body);
      const cat = await prisma.category.create({
        data: {
          id: newId("cat"),
          name: input.name,
          kind: input.kind ?? "PHYSICAL"
        }
      });
      res.json({ ok: true, category: cat });
    } catch (e) { next(e); }
  });

  r.post("/bootstrap", authMiddleware, requireRole("ADMIN"), async (_req, res, next) => {
    try {
      const upserts = ALL_DEFAULT_CATEGORIES.map((item) =>
        prisma.category.upsert({
          where: { name: item.name },
          update: { kind: item.kind },
          create: {
            id: newId("cat"),
            name: item.name,
            kind: item.kind,
          },
        })
      );

      await prisma.$transaction(upserts);
      const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
      res.json({ ok: true, categories });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
