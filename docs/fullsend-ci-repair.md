# Fullsend CI/E2E repair loop

This repository dispatches two Fullsend stages from completed `CI` workflow
runs:

```text
CI failure -> trusted intake -> read-only ci-triage
           -> retry once | diagnosis-only | guarded CI repair using the existing fix agent
           -> fast-forward commit -> CI rerun
```

The intake and repair dispatch workflows always run from the base branch. The
repair harness reuses the repository's existing `rhdh/agents/fix.md` agent in
CI-repair mode; it does not register a second CI-specific coding agent. They
resolve exactly one open PR at the tested SHA, discard stale runs, ignore the
aggregate `check all required jobs` failure, and derive workspace scope from
leaf matrix job names. Root, ambiguous, multi-workspace, and fork failures are
diagnosis-only.

## Repository variables

- `FULLSEND_CI_AUTOMATION`: `off`, `observe`, or `repair`. Missing/invalid values
  fail closed to `observe`.
- `FULLSEND_CI_AUTOFIX_WORKSPACES`: comma-separated workspace names. The default
  rollout set is `boost,scorecard,ai-integrations`.

`fullsend-no-fix` is the maintainer/author kill switch. Each PR is capped at two
commits whose subject starts with `fix(ci-agent):`. `needs-human` is never
removed automatically.

## Rollout

1. Leave `FULLSEND_CI_AUTOMATION=observe` while collecting at least ten genuine
   failures spanning two workspaces.
2. Require at least 80% maintainer-rated useful diagnoses, reliable artifact
   retrieval, and zero stale-head, deduplication, or trust-boundary violations.
3. Set the allowlist to `boost,scorecard,ai-integrations`, then change the mode
   to `repair`. Expand one workspace at a time.
4. Set the mode to `off` for an immediate rollback. No workflow revert is
   needed.

Manual replay is available from **Fullsend CI triage** with a completed run ID.
It defaults to dry-run and never comments or dispatches in that mode. Manual
fix/retry dispatch still requires a trusted, head-matching triage result.

## Safety model

The triage agent uses the `retro` mint role because it needs Actions read access,
runs with a read-only repository, and can only emit schema-validated JSON. The
existing fix agent uses `coder` in CI-repair mode, commits locally, and never
pushes itself. Its host-side
post-script derives the Git diff and requires one direct non-merge commit, one
workspace, at most 20 files and 800 changed lines, no binary/symlink changes, a
secret scan, successful targeted verification, a fresh PR head, and a
non-force fast-forward push.

CI uploads only JUnit and configured Playwright report/result directories for
seven days. Job logs are fetched through the Actions API; workspace-wide
archives and environment files are not collected.

## Local validation

```bash
node --test scripts/ci/fullsend-ci-*.test.cjs
bash -n .fullsend/rhdh/scripts/*.sh
```

## Local Cursor demo

The production loop uses Fullsend credentials only in GitHub Actions. For a
local demonstration, use the Cursor CLI adapter instead. It uses `gh` to read
the PR's completed CI run, failed job logs, and named evidence artifacts; it
then runs Cursor against a temporary PR checkout with the same triage/fix
instructions and JSON schemas. It never comments, pushes, or changes the
working checkout. Add `--repair` to run the local repair phase and the same
workspace/diff guard used by the production post-script.

```bash
gh auth status
cursor-agent login
yarn ci-agent:cursor-demo \
  --pr https://github.com/redhat-developer/rhdh-plugins/pull/4471 \
  --repair \
  --keep
```

Use `--run-id <completed-ci-run-id>` when the PR has multiple failed CI runs.
`cursor-agent -p` is used in read-only print mode for triage; repair uses
Cursor's explicit `--force` mode only inside the temporary checkout. Cursor's
headless CLI supports print mode for scripted runs and `--force` for direct
file changes; authenticate it with `cursor-agent login` first.

When available, also run `actionlint` and resolve both custom harnesses with the
Fullsend CLI pinned by `.github/workflows/fullsend.yaml`.
