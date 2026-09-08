import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createCors } from "./cors.js";

function buildApp() {
  const app = express();
  app.use(createCors("http://localhost:5173"));
  app.get("/thing", (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe("createCors", () => {
  it("sets Access-Control-Allow-Origin to the configured origin on a normal request", async () => {
    const response = await request(buildApp()).get("/thing");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.status).toBe(200);
  });

  it("answers an OPTIONS preflight with 204 and the allowed methods/headers", async () => {
    const response = await request(buildApp()).options("/thing");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toBe("GET, POST");
    expect(response.headers["access-control-allow-headers"]).toBe("Content-Type, Authorization");
  });

  it("sets Vary: Origin so caches don't serve one origin's response to another", async () => {
    const response = await request(buildApp()).get("/thing");
    expect(response.headers.vary).toBe("Origin");
  });
});
