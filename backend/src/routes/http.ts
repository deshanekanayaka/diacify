// Deliberately opaque: a client can't act on the specifics, and the
// specifics are exactly what we don't want leaking out of a 500.
export const INTERNAL_ERROR_BODY = { error: "Something went wrong. Please try again." } as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a path parameter is a well-formed UUID.
 *
 * Checked before any query runs, so a malformed id costs a 400 rather than
 * a database round trip.
 */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}
