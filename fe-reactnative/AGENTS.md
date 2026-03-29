# AGENTS.md - Frontend (Expo Router / React Native Web)

## Identity
- Desktop-first Expo Router frontend for MyDigiLearn.
- The user-facing IA now centers on `Syllabus/Create`, `Syllabus/Generated`, syllabus detail, revision workspace, and export preview.
- Compatibility route aliases still exist, but new UX work should be framed around `syllabus/*`, not old top-level `documents` or `design-session` IA.

## Stack
- Expo `~54.0.33`
- Expo Router `~6.0.23`
- React `19.1.0`
- React Native `0.81.5`
- React Native Web `^0.21.0`
- TypeScript `~5.9.2`
- NativeWind `^4.2.2`
- TanStack React Query `^5.90.21`
- Zustand `^5.0.11`
- Playwright via `npm run e2e`

## Canonical commands
- Install: `npm install`
- Web dev: `npm run web`
- General Expo dev: `npm run start`
- Mobile shortcuts: `npm run android`, `npm run ios`
- E2E: `npm run e2e`
- Verification: `npx tsc --noEmit`
- Production-style static export: `npx expo export --platform web`

## Route truths
- `app/_layout.tsx`: responsive root shell with desktop sidebar and mobile nav
- `app/index.tsx`: dashboard
- `app/syllabus/create/index.tsx`: user-facing create entry, currently re-exporting `app/design-session/new.tsx`
- `app/syllabus/create/[sessionId].tsx`: user-facing wizard shell, currently re-exporting `app/design-session/[sessionId].tsx`
- `app/syllabus/generated.tsx`: generated syllabi list shell
- `app/syllabus/[id].tsx`: finalized syllabus detail
- `app/syllabus/[id]/revision.tsx`: revision workspace shell, re-exporting the chat implementation
- `app/syllabus/[id]/export.tsx`: export shell, re-exporting the export implementation
- Legacy `/design-session/*`, `/chat/[syllabusId]`, and `/export/[syllabusId]` routes still exist for compatibility/support

## UX truths
- `Syllabus/Create` now starts with direct document upload for that flow; on web it supports drag-and-drop, on native it uses document picker fallback.
- The create screen is intentionally simplified and document-specific rather than asking users to reuse a global document pool.
- Revision is explicit: chat suggests changes, then the user applies structured updates through the revision workspace.
- Export is not just a download button anymore; it includes a preview/mapping surface that mirrors backend DOCX fields.

## Data layer rules
- Use TanStack React Query for server state.
- Keep API contract handling in `src/services/api.ts` and feature hooks like `src/hooks/useSyllabus.ts`, `src/hooks/useDesignSession.ts`, and `src/hooks/useDocuments.ts`.
- Do not treat frontend route state as authoritative for wizard progression or finalized syllabus mutation; the backend owns both.

## API/runtime quirks
- Web runtime can resolve API base from:
  - `window.__MYDIGILEARN_API_URL__`
  - `apiBaseUrl` query parameter
  - `localStorage['mydigilearn.apiBaseUrl']`
  - `EXPO_PUBLIC_API_URL`
  - browser-derived same-origin `/api/v1` fallback
- That same-origin fallback is important for the production nginx proxy stack.

## Styling and layout
- Keep desktop-first layout intact.
- Preserve the current responsive shell (`Sidebar`, `Header`, `BottomNav`, `MobileTopBar`).
- Avoid generic placeholder-heavy UX on create/export; current direction favors simpler, clearer surfaces.

## Testing focus
- `npx tsc --noEmit`
- `npx expo export --platform web`
- `npm run e2e`
- Manual verification of create upload, wizard finalize, revision apply, and export preview/download when route or contract work changes

## Do not assume
- Do not assume dedicated frontend lint/unit-test/build scripts exist beyond what is present in `package.json`.
- Do not assume old PDF-first export UX is still current; the current primary export artifact is DOCX.
- Do not assume the old `documents` and `design-session` top-level IA is the intended user-facing direction.
