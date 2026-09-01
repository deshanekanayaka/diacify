import "dotenv/config";
import express from "express";

import { createSupabaseJwks } from "./auth/supabaseJwks.js";
import { loadEnv } from "./config/env.js";
import { createRequireAuth, type AuthenticatedRequest } from "./middleware/requireAuth.js";

const env = loadEnv();
const requireAuth = createRequireAuth(createSupabaseJwks(env.supabaseUrl));

const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Temporary: proves the gatekeeper works end-to-end against a real Supabase
// project. Will be replaced once the first real protected endpoint exists.
app.get("/api/whoami", requireAuth, (req, res) => {
  res.status(200).json({ userId: (req as AuthenticatedRequest).user?.id });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`diacify backend listening on port ${port}`);
});
