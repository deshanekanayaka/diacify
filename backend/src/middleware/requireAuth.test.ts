import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  SignJWT,
  errors as joseErrors,
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

  it("returns 503 on a non-JOSE failure fetching the signing key (e.g. connection refused)", async () => {
    const failingGetKey: JWTVerifyGetKey = () => {
      throw new TypeError("fetch failed");
    };
    const app = await buildApp(failingGetKey);

    const { privateKey } = await generateKeyPair("ES256");
    const token = await buildSignedToken(privateKey, "test-key");
    const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "Something went wrong. Please try again." });
  });

  it("returns 503 when the JWKS fetch times out", async () => {
    // JWKSTimeout extends JOSEError, so without an explicit carve-out this
    // falls into the generic 401 branch below — the exact bug being fixed.
    const timingOutGetKey: JWTVerifyGetKey = () => {
      throw new joseErrors.JWKSTimeout();
    };
    const app = await buildApp(timingOutGetKey);

    const { privateKey } = await generateKeyPair("ES256");
    const token = await buildSignedToken(privateKey, "test-key");
    const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "Something went wrong. Please try again." });
  });

  it("returns 401 when the token's kid matches no key in the JWKS (not treated as an outage)", async () => {
    // A fresh JWKS fetch already ran and still found no matching key -
    // in practice a forged or garbage kid, not a key-rotation race, since
    // access tokens are short-lived. Deliberately not reclassified to 503.
    const noMatchGetKey: JWTVerifyGetKey = () => {
      throw new joseErrors.JWKSNoMatchingKey();
    };
    const app = await buildApp(noMatchGetKey);

    const { privateKey } = await generateKeyPair("ES256");
    const token = await buildSignedToken(privateKey, "test-key");
    const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing or invalid authorization token" });
  });
});
