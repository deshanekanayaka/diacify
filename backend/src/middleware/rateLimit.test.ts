import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rateLimit.js";

function buildApp(limiter: express.RequestHandler, userId: string) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: userId, accessToken: "irrelevant" };
    next();
  });
  app.use(limiter);
  app.get("/", (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit", async () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    const app = buildApp(limiter, "clinician-a");

    for (let i = 0; i < 3; i++) {
      const response = await request(app).get("/");
      expect(response.status).toBe(200);
    }
  });

  it("blocks the request after the limit is exceeded, with 429", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    const app = buildApp(limiter, "clinician-a");

    await request(app).get("/");
    await request(app).get("/");
    const blocked = await request(app).get("/");

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests. Please try again shortly." });
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("allows requests again once the window has rolled past", async () => {
    let currentTime = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => currentTime });
    const app = buildApp(limiter, "clinician-a");

    const first = await request(app).get("/");
    expect(first.status).toBe(200);

    const stillBlocked = await request(app).get("/");
    expect(stillBlocked.status).toBe(429);

    currentTime = 1001;
    const afterWindow = await request(app).get("/");
    expect(afterWindow.status).toBe(200);
  });

  it("tracks separate clinicians in separate buckets", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    const appA = buildApp(limiter, "clinician-a");
    const appB = buildApp(limiter, "clinician-b");

    const first = await request(appA).get("/");
    expect(first.status).toBe(200);

    const second = await request(appB).get("/");
    expect(second.status).toBe(200);
  });
});
