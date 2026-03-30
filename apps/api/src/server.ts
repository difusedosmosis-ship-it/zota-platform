import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { errorMiddleware } from "./middleware/error.js";
import { prisma } from "./prisma.js";
import { requestContextMiddleware } from "./middleware/requestContext.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";

import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { categoriesRoutes } from "./modules/categories/categories.routes.js";
import { vendorRoutes } from "./modules/vendor/vendor.routes.js";
import { requestsRoutes } from "./modules/requests/requests.routes.js";
import { reviewsRoutes } from "./modules/reviews/reviews.routes.js";
import { walletRoutes } from "./modules/wallet/wallet.routes.js";
import { bookingRoutes } from "./modules/booking/booking.routes.js";
import { aiRoutes } from "./modules/ai/ai.routes.js";
import { chatRoutes } from "./modules/chat/chat.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";

export function buildServer() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(requestContextMiddleware);
  app.use(rateLimitMiddleware());
  app.use("/payments/webhook/paystack", express.raw({ type: "application/json" }));
  app.use(express.json({ limit: "8mb" }));
  app.use(morgan("dev"));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/health/detailed", async (_req, res, next) => {
    try {
      await prisma.$queryRaw`select 1`;
      res.json({
        ok: true,
        services: {
          api: "up",
          database: "up",
          websocket: "up",
        },
      });
    } catch (e) {
      next(e);
    }
  });

  app.use("/auth", authRoutes());
  app.use("/users", usersRoutes());
  app.use("/admin", adminRoutes());
  app.use("/categories", categoriesRoutes());
  app.use("/vendor", vendorRoutes());
  app.use("/requests", requestsRoutes());
  app.use("/reviews", reviewsRoutes());
  app.use("/wallet", walletRoutes());
  app.use("/booking", bookingRoutes());
  app.use("/ai", aiRoutes());
  app.use("/chat", chatRoutes());
  app.use("/payments", paymentsRoutes());
  
  app.use(errorMiddleware);
  return app;
}
