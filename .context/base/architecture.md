# Architecture

## Style
Feature-based monorepo with a FastAPI backend and an Expo Router frontend. Backend business logic lives in feature `service.py` modules; frontend routes compose feature hooks, services, and shared layout components.

## Top-level components
- `be-fastapi/`: FastAPI API, AI orchestration, persistence, document parsing, syllabus and design-session flows
- `fe-reactnative/`: Expo/React Native app used primarily on web, with responsive desktop/mobile shells
- `.plans/`: local implementation plans describing the ongoing migration from legacy one-shot generation to stateful design sessions
- `server.py`: sensitive SSH helper script; not part of normal runtime architecture

## Backend responsibilities
- Entry point: `be-fastapi/app/main.py`
- Shared layers: `app/ai/` for Azure OpenAI calls and retrieval logic, `app/utils/` for parsing/chunking helpers
- Current routed features: `documents`, `design_sessions`, `syllabus`, `personalize`, `chat`, `export`
- API namespace: routers mounted under `/api/v1/*`
- Session lifecycle: `design_sessions` enforces wizard-step transitions and downstream reset behavior before finalizing a syllabus

## Frontend responsibilities
- Entry shell: `fe-reactnative/app/_layout.tsx`
- Routing: Expo Router file-based routes under `fe-reactnative/app/`
- Shared UI shell: responsive `Header`, `Sidebar`, `BottomNav`, `MobileTopBar`
- Data flow: fetch-based API layer in `src/services/`, React Query for async state, route screens render backend-authored state
- Current primary creation path: dashboard CTA routes to `/design-session/new`

## Data flow
1. User uploads source documents through the frontend.
2. Backend stores files, parses content, and prepares summaries/context.
3. User progresses through `design_sessions` steps: assist -> course context -> TLO -> performance -> ELO -> finalize.
4. Finalization creates or updates syllabus data for downstream features.
5. Frontend routes for syllabus detail, personalize, chat, and export operate from finalized syllabus identifiers.

## Boundaries and constraints
- Backend is the source of truth for wizard state; frontend should not invent step transitions locally.
- Feature-specific logic belongs inside feature directories; shared cross-feature logic belongs in `app/ai`, `app/utils`, or shared frontend services/components.
- Legacy one-shot flows still exist, but new work should prefer the `design_sessions` contract unless compatibility work explicitly requires otherwise.
