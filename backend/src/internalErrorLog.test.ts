import { afterEach, describe, expect, it, vi } from "vitest";

import { logInternalError } from "./internalErrorLog.js";

describe("logInternalError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the context and error together via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { code: "42501", message: "permission denied" };

    logInternalError("GET /api/patients", error);

    expect(spy).toHaveBeenCalledWith("[GET /api/patients]", error);
  });
});
