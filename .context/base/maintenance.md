# Maintenance

## Ownership
- Primary code ownership is not explicitly documented in the repo.
- Treat Telkom Athon Group 5 project contributors as the effective maintainers until a clearer owner file exists.

## Refresh triggers
Update the steering docs immediately when any of the following changes:
- backend or frontend commands in manifests, Docker, or docs
- routed feature boundaries, especially `design_sessions`, `syllabus`, revision, export, or shared layout shells
- environment variables, Azure OpenAI settings, CORS behavior, or same-origin API fallback logic
- production deployment topology, nginx proxy rules, or startup scripts
- Alembic migration heads or finalized syllabus snapshot fields
- testing or verification commands
- git workflow expectations or ignored local-agent artifacts

## Update discipline
- Update `.context/` first, then project the changed truth into `AGENTS.md`.
- Append a compact factual entry to `PROGRESS.md` after meaningful init, refresh, repair, or implementation milestones.
- Use repair mode for nested steering docs when they lag current repo truth badly.
- Do not preserve stale assumptions from old AGENTS files when code and manifests disagree.

## Dependency posture
- Version truth must come from actual manifests and lockfiles.
- Prefer narrow refreshes when only one area changes, but refresh all affected steering files when product flow and deployment shape both shift.
