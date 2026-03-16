# Maintenance

## Ownership
- Primary code ownership is not explicitly documented in the repo.
- Treat Telkom Athon Group 5 project contributors as the effective maintainers until a clearer owner file exists.

## Refresh triggers
Update the steering docs immediately when any of the following changes:
- backend or frontend commands in manifests, Docker, or docs
- routed feature boundaries, especially `design_sessions`, `syllabus`, `export`, or shared layout shells
- environment variables, Azure OpenAI settings, or CORS behavior
- frontend runtime API override behavior for static web builds
- Alembic migration heads or merge revisions
- testing or verification commands
- git workflow expectations or ignored local-agent artifacts

## Update discipline
- Update `.context/` first, then project the changed truth into `AGENTS.md`.
- Append a compact factual entry to `PROGRESS.md` after meaningful init, refresh, repair, or implementation milestones.
- Do not preserve stale assumptions from old AGENTS files when the code disagrees.

## Dependency posture
- Version truth must come from actual manifests and lockfiles.
- Prefer narrow refreshes when only one area changes, but use repair mode when docs and code contradict each other.
