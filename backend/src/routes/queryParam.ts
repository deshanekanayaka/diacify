/**
 * Parses one query-string value against `validate`.
 *
 * Returns `undefined` if the value is absent (the caller decides what that
 * means - unfiltered, a default, etc.), `null` if it's present but rejected
 * by `validate` (including anything that isn't a plain string - Express can
 * hand back an array or object for a repeated/nested param), or the parsed
 * value otherwise.
 */
export function parseField<T>(value: unknown, validate: (raw: string) => T | null): T | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  return validate(value);
}
