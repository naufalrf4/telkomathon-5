# PROGRESS

## 2026-03-12 - Agent memory initialization
- Mode: init
- Status: completed
- Files created: `.context/base/overview.md`, `.context/base/architecture.md`, `.context/base/requirements.yaml`, `.context/base/tech-stack.yaml`, `.context/base/workflow.yaml`, `.context/base/testing.yaml`, `.context/base/development-plan.yaml`, `.context/base/maintenance.md`, `.context/base/security.yaml`, `.context/README.md`, `PROGRESS.md`
- Files updated: `AGENTS.md`, `.gitignore`
- Key discoveries:
  - Current repo truth has moved to a stateful `design_sessions` wizard with backend-owned `wizard_step` transitions.
  - Canonical backend tooling is `uv` + `ruff` + `mypy` + `pytest`; frontend currently exposes Expo run scripts only.
  - Root `server.py` is a sensitive deployment helper and should stay outside normal app-code assumptions.
  - Existing root and nested AGENTS files contain useful history but lag the current wizard and DOCX-export flow in places.

## 2026-03-12 - Design-session migration and integration completion
- Mode: implementation
- Status: completed
- Files updated: `be-fastapi/app/config.py`, `be-fastapi/app/main.py`, `be-fastapi/tests/features/test_design_sessions_service.py`, `be-fastapi/alembic/versions/8f1629c83c67_merge_design_sessions_and_embedding_.py`, `fe-reactnative/src/services/api.ts`, `fe-reactnative/src/hooks/useSyllabus.ts`, `fe-reactnative/app/personalize/[syllabusId].tsx`, `fe-reactnative/src/components/layout/Sidebar.tsx`, `fe-reactnative/src/components/layout/BottomNav.tsx`
- Key discoveries:
  - The frontend primary nav now points to the backend-owned `Design Session` flow instead of the legacy syllabus-first path.
  - Static web builds need runtime API override support for reliable local/prod-like verification across split frontend/backend origins.
  - Backend CORS must be expanded via `CORS_ALLOWED_ORIGINS` when using custom local frontend ports.
  - The prior Alembic multi-head state was resolved with merge revision `8f1629c83c67`, restoring `alembic upgrade head`.
  - Manual browser E2E succeeded through session creation, analysis, course context, TLO, performance, ELO, finalization, syllabus detail, and DOCX download.

## 2026-03-12 - Steering docs refresh after verified E2E
- Mode: refresh
- Status: completed
- Files updated: `.context/base/workflow.yaml`, `.context/base/testing.yaml`, `.context/base/security.yaml`, `.context/base/development-plan.yaml`, `.context/base/maintenance.md`, `AGENTS.md`, `PROGRESS.md`
- Key discoveries:
  - The current durable frontend verification baseline is `npx tsc --noEmit` plus `npx expo export --platform web`, even though no package scripts exist for those checks.
  - Happy-path syllabus detail loads should not eagerly request personalization data; only the personalize screen opts into that fetch.
  - Future local verification should prefer client-side navigation from the app shell when using simple static servers without SPA fallback.

## 2026-03-15 - E2E syllabus flow refactor and DOCX template export
- Mode: implementation
- Status: completed
- Files updated: `be-fastapi/app/features/design_sessions/schemas.py`, `be-fastapi/app/features/design_sessions/service.py`, `be-fastapi/app/features/export/service.py`, `be-fastapi/app/features/export/templates/syllabus_template.docx`, `be-fastapi/app/features/syllabus/models.py`, `be-fastapi/app/features/syllabus/router.py`, `be-fastapi/app/features/syllabus/schemas.py`, `be-fastapi/app/features/syllabus/service.py`, `be-fastapi/alembic/versions/c9f3f2788f8a_add_finalized_syllabus_snapshot_fields.py`, `be-fastapi/pyproject.toml`, `be-fastapi/uv.lock`, `be-fastapi/tests/features/test_design_sessions_service.py`, `be-fastapi/tests/features/test_export_service.py`, `be-fastapi/tests/features/test_syllabus_service.py`, `fe-reactnative/app/chat/[syllabusId].tsx`, `fe-reactnative/app/design-session/[sessionId].tsx`, `fe-reactnative/app/design-session/index.tsx`, `fe-reactnative/app/design-session/new.tsx`, `fe-reactnative/app/export/[syllabusId].tsx`, `fe-reactnative/app/index.tsx`, `fe-reactnative/app/syllabus/[id].tsx`, `fe-reactnative/app/syllabus/index.tsx`, `fe-reactnative/app/syllabus/create/index.tsx`, `fe-reactnative/app/syllabus/create/[sessionId].tsx`, `fe-reactnative/app/syllabus/generated.tsx`, `fe-reactnative/app/syllabus/[id]/revision.tsx`, `fe-reactnative/app/syllabus/[id]/export.tsx`, `fe-reactnative/src/components/layout/BottomNav.tsx`, `fe-reactnative/src/components/layout/Header.tsx`, `fe-reactnative/src/components/layout/Sidebar.tsx`, `fe-reactnative/src/hooks/useSyllabus.ts`, `fe-reactnative/src/types/api.ts`, `fe-reactnative/src/types/designSession.ts`, `fe-reactnative/src/utils/syllabus.ts`, `PROGRESS.md`
- Key discoveries:
  - Backend-finalized syllabi had to become the long-lived source of truth for revision and DOCX, so finalization now snapshots export-critical fields instead of leaving them only in `design_sessions`.
  - Explicit revision application works better than chat-side mutation; chat remains the suggestion channel while `/api/v1/syllabi/{id}/apply-revision` owns persisted syllabus changes and provenance.
  - The safest IA migration path is compatibility aliases: the user-facing shell now centers on `Syllabus/Create`, `Syllabus/Generated`, revision, and export while old `design-session` routes still resolve.
  - The official DOCX export now renders from a backend template asset at `be-fastapi/app/features/export/templates/syllabus_template.docx` using `docxtpl`, while the public download contract stays `/api/v1/syllabi/{id}/download.docx`.
  - Verified checks for this milestone: backend `ruff`, backend `mypy`, backend pytest for syllabus/design-session/export, frontend `npx tsc --noEmit`, and frontend `npx expo export --platform web` all passed.

## 2026-03-15 - Fresh database reset and live API flow audit
- Mode: implementation
- Status: completed
- Files updated: `be-fastapi/app/ai/rag.py`, `be-fastapi/app/features/documents/service.py`, `be-fastapi/app/features/syllabus/generator.py`, `be-fastapi/app/features/syllabus/router.py`, `be-fastapi/tests/features/test_documents_service.py`, `be-fastapi/tests/features/test_syllabus_generator.py`, `be-fastapi/tmp_live_flow_audit.py`, `PROGRESS.md`
- Key discoveries:
  - A true empty-environment audit exposed two real backend resilience bugs: uploads hard-failed when Azure embeddings were unavailable, and the legacy SSE syllabus route emitted `syllabus_id` before the record was durably committed.
  - Document ingest now degrades safely by writing zero-vector embeddings with `embedding_fallback` metadata instead of blocking the whole flow when embedding generation fails.
  - RAG SQL needed `IN :doc_ids` with SQLAlchemy expanding bind params; the previous `ANY(:doc_ids::uuid[])` form broke under asyncpg with `syntax error at or near ':'`.
  - Legacy `POST /api/v1/syllabi/generate` now has deterministic fallback output on AI failures and commits immediately after persistence so the emitted `syllabus_id` is retrievable.
  - Verified live on the reset Docker stack with `be-fastapi/tmp_live_flow_audit.py`: upload, legacy generate, design-session wizard, finalize, structured revision apply, and canonical DOCX export all completed successfully; the audit produced one uploaded document, one legacy syllabus, one finalized syllabus, a revision history count of `1`, and a DOCX download of `278151` bytes.

## 2026-03-16 - DOCX export polish and runtime template cleanup
- Mode: implementation
- Status: completed
- Files updated: `be-fastapi/app/features/design_sessions/service.py`, `be-fastapi/app/features/export/service.py`, `be-fastapi/app/features/export/templates/syllabus_template.docx`, `be-fastapi/tests/features/test_design_sessions_service.py`, `be-fastapi/tests/features/test_export_service.py`, `be-fastapi/tmp_patch_docx_template.py`, `be-fastapi/tmp_docx_polish_audit.py`, `fe-reactnative/app/export/[syllabusId].tsx`, `PROGRESS.md`
- Key discoveries:
  - The active runtime template still contained one literal `$` before `{{ course_category }}` and an ELO paragraph first-line indent in `word/document.xml`; both were real template bugs and were corrected directly in `be-fastapi/app/features/export/templates/syllabus_template.docx`.
  - Export polish had to happen at two layers: the DOCX template asset itself and backend snapshot sanitization. `DesignSessionService` now strips stray leading `$` markers and removes boilerplate lines like `Business Profile (Dummy)`, `Organization Context`, and `Ringkasan Organisasi` from the company profile snapshot before finalization/export.
  - The frontend export preview no longer shows a powered-by footer or AI-branded preview header, reducing mismatch between preview and final DOCX.
  - Verified with targeted backend Ruff, targeted pytest (`test_design_sessions_service.py` and `test_export_service.py`), frontend `npx tsc --noEmit`, and a fresh live audit via `be-fastapi/tmp_docx_polish_audit.py` on the running Docker stack. The live audit created a new syllabus, applied a revision, downloaded DOCX successfully (`278113` bytes), and asserted that the exported XML no longer contained `$Digital Literacy & Awareness`, the AI note string, `Business Profile (Dummy)`, `Organization Context`, or `Ringkasan Organisasi`.

## 2026-03-16 - Steering docs refresh after syllabus flow and production deploy changes
- Mode: refresh
- Status: completed
- Files updated: `.context/base/overview.md`, `.context/base/architecture.md`, `.context/base/requirements.yaml`, `.context/base/tech-stack.yaml`, `.context/base/workflow.yaml`, `.context/base/testing.yaml`, `.context/base/development-plan.yaml`, `.context/base/maintenance.md`, `.context/base/security.yaml`, `AGENTS.md`, `be-fastapi/AGENTS.md`, `fe-reactnative/AGENTS.md`, `PROGRESS.md`
- Key discoveries:
  - Root/base steering docs were broadly correct but stale on the user-facing `syllabus/*` shells, explicit revision apply flow, direct-upload create entry, and production Docker topology.
  - Nested steering docs had drifted much further than root docs: backend notes still framed export around older PDF-first assumptions, while frontend notes still described pre-refactor routes, tools, and testing setup.
  - The repo now has a production-style deployment baseline (`docker-compose.prod.yml`, frontend nginx image, reverse proxy, `prod-up.sh` / `prod-down.sh`) that future agents should treat as the canonical server rollout starting point.
  - The verified frontend script surface now includes `npm run e2e`, while the backend local dev command still needs a Git Bash fallback through `uv run python -m uvicorn ...` on Windows shells.

## 2026-04-01 - PRIMA identity and auth-flow steering refresh
- Mode: refresh
- Status: completed
- Files updated: `.context/base/overview.md`, `.context/base/architecture.md`, `.context/base/requirements.yaml`, `.context/base/tech-stack.yaml`, `.context/base/development-plan.yaml`, `.context/base/security.yaml`, `AGENTS.md`, `be-fastapi/AGENTS.md`, `fe-reactnative/AGENTS.md`, `PROGRESS.md`
- Key discoveries:
  - Runtime-facing repo evidence consistently brands the product as PRIMA, with the user clarifying the expansion as `Personalized Responsive Intelligent Micro-Learning Assistant`; the old MyDigiLearn label had become steering-doc drift only.
  - The repo now contains verified bearer-token auth plus owner-scoped protection across most routed features, so security/docs needed to move from “no verified auth” to a narrower statement about missing hardening beyond the current owner-scoped flow.
  - Finalized-syllabus tooling has expanded beyond revision/export to include owner history, module decomposition, bulk recommendation, and career roadmap flows that future agents should treat as part of the active authenticated shell.
  - Frontend API override hooks still use legacy `MYDIGILEARN` naming in code (`__MYDIGILEARN_API_URL__`, `mydigilearn.apiBaseUrl`), so docs now preserve that quirk explicitly instead of silently “renaming” runtime behavior.

## 2026-04-01 - Frontend legacy generation cleanup
- Mode: implementation
- Status: completed
- Files updated: `fe-reactnative/src/components/layout/Header.tsx`, `PROGRESS.md`
- Files removed: `fe-reactnative/app/syllabus/generate.tsx`, `fe-reactnative/src/components/syllabus/GenerationForm.tsx`, `fe-reactnative/src/components/syllabus/GenerationTerminal.tsx`
- Key discoveries:
  - `app/syllabus/generate.tsx` was an unused legacy redirect to `/design-session/new`, while the active create entry already lives at `/syllabus/create`.
  - `GenerationForm.tsx` and `GenerationTerminal.tsx` were leftover generation-era UI components with no remaining imports or runtime references in the frontend.
  - The old `/documents/*` screens and top-level compatibility routes were left intact because they still have repo-evident references or documented compatibility intent.
