# Tasks

Live task state, groomed weekly. One line per task: `- [ ] <task> (<phase/sprint>)`. Move done items to progress.md as one-line entries, do not accumulate them here.

Don't track workflow steps here. "Open a PR for slice N", "merge X", "push the migration" are steps in `CLAUDE.md` §4, not work items — they were added six times and each went stale within hours of the merge it described. Track the *decision* or the *gap*, not the mechanics of shipping it.

## Now

_Nothing open right now — see Later below._

## Later — after all phases are complete

- [ ] Backfill risk assessments for visits that predate slice 10's auto-scoring. Not a new endpoint — a one-off script reusing the existing `assessRisk` + `recordAssessment`. Its urgency depends on whether the hosted project has real clinician-entered visits that matter today versus just local/test data; worth checking before scheduling it.
- [ ] Add a per-visit assessment-history endpoint (all `risk_assessments` rows for a visit, not just the latest — the table is already append-only per `(visit, model_version)` per ADR-028). Deferred because exactly one `model_version` exists today; a retrain would return at most one row per visit either way, so this has no payoff until a second model version exists.
- [ ] Write two audience-specific docs, deliberately separate rather than one doc trying to serve both. **(a) Clinician-facing.** What Diacify is and how to use it, for someone with no technical background — screenshots of the real UI, task-shaped ("record a visit", "read a risk score", "what does low confidence mean"), zero jargon. Not an architecture doc with the hard parts removed. **(b) Developer-facing.** Interactive documentation that teaches the underlying logic and architecture to a junior dev or anyone who stumbles onto the repo. **Why it's needed:** the README covers installation, so a newcomer can *run* the project but has no path into understanding it, and the codebase is comprehensive enough to be overwhelming cold — RLS-based ownership, a hand-ported forest, facts/judgements split across tables, and gate ordering that all look arbitrary until explained. Reading the code in file order teaches none of it. **Prior art to reuse:** the five interactive lessons in `docs/study/` (gitignored, personal) landed far better than the long prose versions that preceded them — short narrative, a working interactive per concept, a memorable definition plus a plain-English project example per key term, and collapsed answers. Worth lifting that format, but they are study aids written for one reader who already owns the project, so treat them as a template and source material, not as drafts to publish. **Deferred because:** both docs describe a finished system, and rewriting them after every slice is waste — the clinician doc needs stable UI to screenshot, and the developer doc needs the architecture settled
