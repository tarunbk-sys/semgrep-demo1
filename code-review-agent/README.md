# code-review-agent

Reviews the commits in a push (`before..after`) with Claude and fails the check on blockers.

Pipeline: resolve range (force-push / new-branch aware) -> filter files -> build hunk context
(enclosing fn, imports, same-file types) -> redact secrets -> cap large pushes by risk -> LLM review
-> annotations + job summary + PR comment -> exit 1 on blockers.

## Try it on one repo
1. Copy this folder into the target repo as `.code-review/` (without `node_modules`; commit `package-lock.json`).
2. Copy `workflow/ai-code-review.yml` to `.github/workflows/`.
3. Repo Settings -> Secrets -> Actions: add `ANTHROPIC_API_KEY`.
4. Push a branch. The `ai-code-review` job runs.
5. Once happy: Settings -> Rules -> require status check `ai-code-review` on `main`.

Optional per-repo tuning: `.codereview.json` (see `workflow/codereview.example.json`).

## Run locally
    REVIEW_REPO_DIR=/path/to/repo npx tsx src/index.ts --base <sha> --head <sha> --dry-run   # no API call
    ANTHROPIC_API_KEY=... REVIEW_REPO_DIR=/path/to/repo npx tsx src/index.ts --base <sha> --head <sha>

Set `REVIEW_DISABLE_FALLBACKS=1` to skip the server-side refusal fallback beta.
