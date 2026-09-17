# Diacify

A clinician records a patient visit. Diacify returns a diabetes risk
assessment, scored in-process by a random forest ported from the
project's own training pipeline.

## Documentation

**[Read the architecture guide →](https://diacify.vercel.app/docs)**

Written for a developer joining this codebase with no prior context: what the
system does, its two lifecycles (offline training vs. in-process serving), the
domain model, and the row-level-security idea most of the design falls out of.
Includes runnable drills so you can check the isolation guarantees yourself.

Decision log: [`docs/decisions.md`](docs/decisions.md). It has 43 ADRs that
cover the reasoning behind specific choices.

## Stack

Four npm workspaces, one lockfile:

| Workspace | What it is |
|---|---|
| `frontend/` | React (Vite + React Router), deployed on Vercel |
| `backend/` | Node/Express API, deployed on Render |
| `shared/` | Zod schemas both sides check requests against |
| `machine-learning/` | Python training pipeline, see its own [README](machine-learning/README.md) |

Identity and data live in Supabase (Auth + Postgres + row-level
security).

## Prerequisites

- Node 22
- Python 3 (only needed to retrain the model, see
  `machine-learning/README.md`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker, to
  run Postgres locally

## Setup

```bash
npm install
supabase start        # local Postgres + Auth, applies supabase/migrations/
```

Each of `backend/` and `frontend/` needs its own `.env`. Copy the
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

Each workspace exposes `lint`, `typecheck`, and `build`. For example, run
`npm run build --workspace backend`. CI runs all three plus tests on
every pull request.
