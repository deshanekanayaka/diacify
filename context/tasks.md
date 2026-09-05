# Tasks

Live task state, groomed weekly. One line per task: `- [ ] <task> (<phase/sprint>)`. Move done items to progress.md as one-line entries, do not accumulate them here.

## Now

- [ ] Log the underlying error before returning a 500 — the opaque `INTERNAL_ERROR_BODY` is right for the client, but nothing is logged server-side either, so a production 500 currently leaves no diagnostic trace at all (found while testing slice 8 against the hosted project)
- [ ] Scope slice 9 — candidates: reading assessments back, auto-scoring on visit creation, or `visit_date` filtering
- [ ] Create `CONTEXT.md` — CLAUDE.md §8 requires it as the canonical glossary and it has never existed; the ADR log has been doing that job
- [ ] Reconcile CLAUDE.md §14 ("No AI attribution in commit messages") with the actual history, which carries `Co-Authored-By` on 15 commits
