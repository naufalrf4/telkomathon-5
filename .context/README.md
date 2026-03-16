# Context README

This directory is the durable source of truth for future coding agents working in this repository.

## Read order
1. `.context/base/overview.md`
2. `.context/base/architecture.md`
3. `.context/base/tech-stack.yaml`
4. `.context/base/workflow.yaml`
5. `.context/base/testing.yaml`
6. `.context/base/security.yaml`
7. `.context/base/development-plan.yaml`
8. `AGENTS.md`
9. `PROGRESS.md`

## Scope
- `base/` captures the verified project baseline.
- Optional context groups are intentionally absent until the repo or user confirms they are worth maintaining.
- `.plans/` remains useful local planning context, but `.context/` is the durable memory future agents should update first.

## Update rules
- Prefer `refresh` when the repo evolves without contradiction.
- Use `repair` when docs, plans, and code diverge.
- Keep entries factual and repo-evident.
