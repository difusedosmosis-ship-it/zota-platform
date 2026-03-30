import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";

type LedgerRow = { amount: number };

export function walletRoutes() {
  const r = Router();

  r.get("/me/ledger", authMiddleware, async (req: any, res) => {
    const rows = await prisma.walletLedger.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const balance = (rows as LedgerRow[]).reduce(
      (sum: number, row: LedgerRow) => sum + row.amount,
      0
    );

    res.json({ ok: true, balance, rows });
  });

  r.get("/me/summary", authMiddleware, async (req: any, res) => {
    const rows = await prisma.walletLedger.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const balance = (rows as LedgerRow[]).reduce(
      (sum: number, row: LedgerRow) => sum + row.amount,
      0
    );
    const credits = (rows as LedgerRow[]).filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
    const debits = (rows as LedgerRow[]).filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0);

    res.json({ ok: true, summary: { balance, credits, debits, rows: rows.length } });
  });

  r.get("/me/transactions", authMiddleware, async (req: any, res) => {
    const rows = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ ok: true, rows });
  });

  return r;
}
