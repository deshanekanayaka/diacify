/**
 * Logs an error that a caller only ever sees as an opaque failure (a 500
 * response, a null return) so it still leaves a diagnostic trace server-side.
 * context names the failing operation (e.g. "POST /api/patients",
 * "recordAssessment") so a log line is traceable back to its source.
 */
export function logInternalError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}
