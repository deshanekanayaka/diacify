# Diacify

A clinician records a patient visit; Diacify returns a diabetes risk
assessment, scored in-process by a random forest ported from the
project's own training pipeline.

**[Docs](https://diacify.vercel.app/docs/)** — what the system does,
its two lifecycles (offline training vs. in-process serving), the
domain model, and the row-level-security idea most of the design falls
out of. Written for a new developer, assumes nothing about this
codebase. Source is
[`frontend/public/docs/`](frontend/public/docs/index.html) (open it in
a browser to read it — GitHub only shows the source). `docs/decisions.md`
is the accompanying decision log (43 ADRs) if you want the reasoning
behind a specific choice.

## Stack

Four npm workspaces, one lockfile:

| Workspace | What it is |
|---|---|
| `frontend/` | React (Vite + React Router), deployed on Vercel |
| `backend/` | Node/Express API, deployed on Render |
| `shared/` | Zod schemas both sides validate requests against |
| `machine-learning/` | Python training pipeline — see its own [README](machine-learning/README.md) |

Identity and data live in Supabase (Auth + Postgres + row-level
security).

## Prerequisites

- Node 22
- Python 3 (only needed to retrain the model — see
  `machine-learning/README.md`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker, to
  run Postgres locally

## Setup

```bash
npm install
supabase start        # local Postgres + Auth, applies supabase/migrations/
```

Each of `backend/` and `frontend/` needs its own `.env` — copy the
`.env.example` in that directory and fill in the values `supabase
start` prints (API URL, publishable key).

## Running it

```bash
npm run dev --workspace backend    # http://localhost:3000
npm run dev --workspace frontend   # http://localhost:5173
```

## Tests

```bash
npm run test --workspace shared
npm run test --workspace backend
npm run test --workspace frontend
```

Backend tests run against the real local Supabase stack started above,
not a mock.

## Lint, typecheck, build

Each workspace exposes `lint`, `typecheck`, and `build` — e.g.
`npm run build --workspace backend`. CI runs all three plus tests on
every pull request.
