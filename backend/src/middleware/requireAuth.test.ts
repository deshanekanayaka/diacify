import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  createLocalJWKSet,
  type JWTVerifyGetKey,
  type KeyLike,
} from "jose";

import { createRequireAuth } from "./requireAuth.js";

async function buildSignedToken(
  privateKey: KeyLike,
  kid: string,
  overrides: { expiresInSeconds?: number; subject?: string } = {},
) {
  const { expiresInSeconds = 3600, subject = "clinician-123" } = overrides;
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(privateKey);
}

async function buildApp(getKey: JWTVerifyGetKey) {
  const app = express();
  app.get("/protected", createRequireAuth(getKey), (req, res) => {
    res.status(200).json({ userId: req.user?.id, accessToken: req.user?.accessToken });
  });
  return app;
}

describe("requireAuth", () => {
  it("rejects a request with no Authorization header", async () => {
    const { publicKey } = await generateKeyPair("ES256");
    const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "test-key" }] };
    const app = await buildApp(createLocalJWKSet(jwks));

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing or invalid authorization token" });
  });

  it("rejects a malformed Authorization header", async () => {
    const { publicKey } = await generateKeyPair("ES256");
    const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "test-key" }] };
    const app = await buildApp(createLocalJWKSet(jwks));

    const response = await request(app).get("/protected").set("Authorization", "not-a-bearer-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing or invalid authorization token" });
  });

  it("rejects a token signed with the wrong key", async () => {
    const { publicKey } = await generateKeyPair("ES256");
    const { privateKey: wrongPrivateKey } = await generateKeyPair("ES256");
    const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "test-key" }] };
    const app = await buildApp(createLocalJWKSet(jwks));

    const token = await buildSignedToken(wrongPrivateKey, "test-key");
    const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing or invalid authorization token" });
  });

  it("rejects an expired token", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "test-key" }] };
    const app = await buildApp(createLocalJWKSet(jwks));

    const token = await buildSignedToken(privateKey, "test-key", { expiresInSeconds: -60 });
    const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing or invalid authorization token" });
  });

  it("accepts a validly signed, unexpired token and exposes the subject as req.user.id", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "test-key" }] };
    const app = await buildApp(createLocalJWKSet(jwks));

    const token = await buildSignedToken(privateKey, "test-key", { subject: "clinician-456" });
    const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: "clinician-456", accessToken: token });
  });

  it("returns 503 when the signing key cannot be fetched", async () => {
    const failingGetKey: JWTVerifyGetKey = () => {
      throw new Error("network unreachable");
    };
    const app = await buildApp(failingGetKey);

    const { privateKey } = await generateKeyPair("ES256");
    const token = await buildSignedToken(privateKey, "test-key");
    const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "Something went wrong. Please try again." });
  });
});
