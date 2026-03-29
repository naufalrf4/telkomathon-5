# Architecture

## Style
Feature-based monorepo with a FastAPI backend and an Expo Router frontend. Backend feature `service.py` modules own business logic and persistence rules; frontend route screens render backend-authored state via shared hooks and services.

## Top-level components
- `be-fastapi/`: FastAPI API, AI orchestration, persistence, document parsing, wizard lifecycle, revision, and export
- `fe-reactnative/`: Expo Router app used primarily on web, with responsive desktop/mobile shells and compatibility route aliases
- `proxy/`: nginx configuration for the production Docker stack
- `scripts/`: production helper scripts such as `prod-up.sh` and `prod-down.sh`
- `server.py`: sensitive SSH helper script; not part of normal runtime architecture

## Backend responsibilities
- Entry point: `be-fastapi/app/main.py`
- Shared layers: `app/ai/` for Azure OpenAI calls, embeddings, and hybrid retrieval; `app/utils/` for parsing/chunking helpers
- Routed features: `documents`, `design_sessions`, `syllabus`, `personalize`, `chat`, `export`
- API namespace: routers mounted under `/api/v1/*`
- Wizard lifecycle: `design_sessions` owns assist -> course context -> TLO -> performance -> ELO -> finalize, plus downstream resets
- Final artifact: `GeneratedSyllabus` now snapshots export- and revision-critical fields so downstream revision/export work from finalized data rather than transient session state
- Revision: `POST /api/v1/syllabi/{id}/apply-revision` mutates finalized syllabus state and records provenance/audit data
- Export: canonical DOCX download remains `GET /api/v1/syllabi/{id}/download.docx`, rendered from `be-fastapi/app/features/export/templates/syllabus_template.docx` via `docxtpl`

## Frontend responsibilities
- Entry shell: `fe-reactnative/app/_layout.tsx`
- Shared layout: responsive `Sidebar`, `Header`, `BottomNav`, and `MobileTopBar`
- Data flow: fetch-based API layer in `src/services/`, TanStack React Query for async state, route screens render backend-owned state
- User-facing IA centers on `Syllabus`: create, generated, detail, revision, and export shells
- Compatibility aliases still exist: `fe-reactnative/app/syllabus/create/*` re-exports the underlying `design-session` screens while the old `/design-session/*` pages remain available for resume/support flows
- The current create entry at `fe-reactnative/app/design-session/new.tsx` is a per-syllabus upload workspace with web drag-and-drop plus native picker fallback

## Data flow
1. User enters `Syllabus/Create` and uploads source documents for that syllabus flow.
2. Backend stores files, parses content, chunks text, and prepares embeddings with zero-vector fallback when embedding generation is unavailable.
3. Frontend creates a `design_session` from ready uploaded docs and renders the backend-owned wizard.
4. User progresses through assist, course context, TLO, performance, and ELO generation/selection.
5. Finalization creates a richer finalized syllabus snapshot.
6. Syllabus detail, revision workspace, personalize, and export operate from the finalized syllabus identifier.
7. Export renders the finalized syllabus through the backend DOCX template contract.

## Deployment architecture
- Local/dev stack: `docker-compose.yml` runs `db` and `backend` only.
- Production-style stack: `docker-compose.prod.yml` runs `db`, `backend`, `frontend`, and nginx `proxy` on an internal network, exposing only the proxy on the host.
- Frontend production artifact is static Expo web output served from nginx; the proxy routes `/api/v1/*`, `/docs`, `/redoc`, and `/openapi.json` to backend and everything else to frontend.

## Boundaries and constraints
- Backend is the source of truth for wizard transitions, revision application, and finalized syllabus state.
- Frontend should not invent wizard progression or mutate finalized syllabus state without the explicit backend revision endpoint.
- New syllabus-design work should prefer the `syllabus/*` user-facing shell while respecting existing `design_sessions` backend contracts.
- Legacy one-shot syllabus generation still exists for compatibility and fallback, but it is no longer the preferred user-facing flow.
