import { z } from "zod";

/**
 * Validates a POST /api/patients request body. `.strict()` rejects any
 * unknown field outright (400) rather than silently ignoring it - in
 * particular, a caller sending `clinician_id` gets told no instead of
 * having it quietly dropped, since that field is never accepted from the
 * request (it comes from the column's own auth.uid() default, enforced
 * by the patients RLS policy's WITH CHECK).
 */
export const createPatientSchema = z
  .object({
    sex: z.enum(["male", "female"]),
  })
  .strict();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
