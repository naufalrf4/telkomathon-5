# AGENTS.md - MyDigiLearn

## Project identity
- MyDigiLearn is Telkom Athon #10 Group 5's AI-assisted curriculum design platform for educators.
- Primary target is desktop web via Expo Router / React Native Web, with the same frontend codebase also supporting mobile Expo entry points.
- The user-facing product shell now centers on `Syllabus/Create`, `Syllabus/Generated`, revision, and export, while `design_sessions` remains the backend wizard engine behind compatibility aliases.

## Authority order
When sources disagree, trust them in this order:
1. Actual code and manifests
2. `.context/`
3. Root `AGENTS.md`
4. Nested `AGENTS.md` files in subprojects
5. Local plans in `.plans/`

If a nested `AGENTS.md` disagrees with the current code or `.context/`, treat it as stale guidance and refresh it before copying its assumptions forward.

## Current architecture
- Monorepo with `be-fastapi/` backend and `fe-reactnative/` frontend.
- Backend entry point: `be-fastapi/app/main.py`.
- Frontend shell entry: `fe-reactnative/app/_layout.tsx`.
- Current backend routed features: `documents`, `design_sessions`, `syllabus`, `personalize`, `chat`, `export`.
- Current user-facing frontend route areas center on `syllabus/create`, `syllabus/generated`, `syllabus/[id]`, `syllabus/[id]/revision`, and `syllabus/[id]/export`, with compatibility aliases still re-exporting underlying `design-session` and legacy screens.
- Root `server.py` is a sensitive SSH helper and not part of normal app architecture.

## Key product rules
- Prefer the `design_sessions` contract for new syllabus-design work, even when the frontend shell is framed as `Syllabus/Create`.
- Treat the backend as the source of truth for wizard step state, revision application, and downstream resets.
- Use the canonical DOCX syllabus download route when working with finalized exports.
- Keep legacy syllabus-generation paths and old route aliases only when compatibility work requires them.

## Locked technology baseline

### Backend
- Python >= 3.11
- `uv` package management with `be-fastapi/pyproject.toml` and `be-fastapi/uv.lock`
- FastAPI, SQLAlchemy async, Alembic, PostgreSQL 16 + pgvector, Azure OpenAI, `docxtpl`
- Backend quality tools configured in repo: Ruff, mypy, pytest, pytest-asyncio

### Frontend
- Expo + Expo Router + React Native Web
- React 19 / React Native 0.81 / TypeScript
- NativeWind for styling
- Zustand + TanStack React Query for client state and async data
- Package manager is npm via `fe-reactnative/package.json` and `fe-reactnative/package-lock.json`
- Playwright is configured through `npm run e2e`

## Canonical commands

### Backend (`be-fastapi/`)
- Install: `uv sync`
- Dev server: `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Git Bash workaround: `uv run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Lint: `uv run ruff check .`
- Typecheck: `uv run mypy .`
- Test: `uv run pytest`

### Frontend (`fe-reactnative/`)
- Install: `npm install`
- Web dev: `npm run web`
- General Expo dev: `npm run start`
- Mobile shortcuts: `npm run android`, `npm run ios`
- E2E: `npm run e2e`
- Ad hoc verification commands in current repo state: `npx tsc --noEmit`, `npx expo export --platform web`

### Full stack
- Docker-backed local backend + db: `docker compose up --build`
- Production-style stack: `bash scripts/prod-up.sh`
- Production-style stop: `bash scripts/prod-down.sh`

There is currently no repo-evident frontend `lint`, dedicated unit-test, `typecheck`, or `build` script beyond the existing Expo scripts and `npm run e2e`. Do not invent more in documentation or status reports.

## Workflow rules
- Default mode for steering work here is `init` or `refresh`, not app code generation, unless the user broadens scope.
- Use conventional commits if the user explicitly asks for a commit: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Do not auto-commit and do not auto-push.
- Any eventual commit or push must use only the user's identity, with no co-author or assistant attribution.
- Keep local planning and agent artifacts out of git (`.plans/`, `.sisyphus/`, `*.context.md`).

## Repository-specific quirks
- `.gitignore` historically ignored `AGENTS.md` even though the file is tracked. Keep that contradiction fixed.
- Frontend API base URL can be overridden by `window.__MYDIGILEARN_API_URL__`, the `apiBaseUrl` query param, `localStorage['mydigilearn.apiBaseUrl']`, `EXPO_PUBLIC_API_URL`, or a browser-derived `/api/v1` fallback.
- Exported web builds may need a runtime API override instead of relying only on baked `EXPO_PUBLIC_API_URL`; verify the active origin and override path during local/prod-like testing.
- Backend CORS is controlled by `CORS_ALLOWED_ORIGINS`; custom local frontend ports require an explicit allowlist update.
- `Syllabus/Create` currently re-exports the underlying `design-session` implementation, so route naming and implementation paths do not line up one-to-one yet.
- Runtime DOCX export is driven by `be-fastapi/app/features/export/templates/syllabus_template.docx`; historical `$placeholder` evidence from old DOCX assets is not the active contract.
- `alembic upgrade head` currently depends on merge revision `8f1629c83c67`, then applies `c9f3f2788f8a_add_finalized_syllabus_snapshot_fields`.
- Backend config currently uses Azure OpenAI API version `2024-02-01` and embedding dimensions `3072`.
- Production Docker now uses `docker-compose.prod.yml` with `db`, `backend`, `frontend`, and nginx `proxy`; only the proxy is publicly published by default.
- No repo-level CI workflow was found.
- Auth/authz is not clearly implemented in the current repo; never assume production-grade security guarantees.

## Steering-doc maintenance
- Update `.context/` first whenever commands, architecture, testing workflow, security posture, or durable repo quirks change.
- Then update only the affected sections of `AGENTS.md`.
- Append a factual entry to `PROGRESS.md` after meaningful init, refresh, repair, or implementation milestones.
- If future work materially changes backend/frontend boundaries, refresh nested `AGENTS.md` files too.

## What future agents should read first
- `.context/base/overview.md`
- `.context/base/architecture.md`
- `.context/base/tech-stack.yaml`
- `.context/base/workflow.yaml`
- `.context/base/testing.yaml`
- `.context/base/security.yaml`
- `PROGRESS.md`
