import { Router } from "express";

import { createRequestClient } from "../db/requestClient.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { parsePagination } from "./pagination.js";

/**
 * Patient routes. RLS scopes every query to the caller — this router
 * never filters by clinician_id itself, since a request-scoped client
 * (built from the caller's own verified JWT) can only ever see rows
 * Postgres already decided belong to them.
 */
export function createPatientsRouter(supabaseUrl: string, supabasePublishableKey: string): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const pagination = parsePagination(req.query);
    if (!pagination.ok) {
      res.status(400).json({ error: pagination.error });
      return;
    }
    const { limit, page } = pagination.params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { accessToken } = (req as AuthenticatedRequest).user!;
    const client = createRequestClient(supabaseUrl, supabasePublishableKey, accessToken);

    const { data, error, count } = await client
      .from("patients")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      res.status(500).json({ error: "Something went wrong. Please try again." });
      return;
    }

    res.status(200).json({ data, page, limit, total: count });
  });

  return router;
}
