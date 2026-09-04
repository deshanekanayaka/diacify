// Diacify's own addition to Express's Request type. `user` is set by
// requireAuth after it verifies the caller's JWT; declaring it here is what
// lets route handlers read `req.user` directly instead of casting Request to
// a parallel interface at every call site.
//
// It stays optional deliberately: a request that hasn't been through
// requireAuth genuinely has no user, so handlers still assert (`req.user!`)
// that auth ran ahead of them. This removes the cast, not that assumption -
// what enforces it is requireAuth being mounted on the whole router in
// server.ts, not the type system.

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; accessToken: string };
    }
  }
}

export {};
