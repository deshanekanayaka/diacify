import "dotenv/config";
import express from "express";

import { createSupabaseJwks } from "./auth/supabaseJwks.js";
import { loadEnv } from "./config/env.js";
import { createRequireAuth } from "./middleware/requireAuth.js";
import { createPatientsRouter } from "./routes/patients.js";

const env = loadEnv();
const requireAuth = createRequireAuth(createSupabaseJwks(env.supabaseUrl));

const app = express();

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(
  "/api/patients",
  requireAuth,
  createPatientsRouter(env.supabaseUrl, env.supabasePublishableKey),
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`diacify backend listening on port ${port}`);
});
