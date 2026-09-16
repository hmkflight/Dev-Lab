# STUDIO ADAPTER FOUNDATION REPORT

## Repository architecture discovered

- Standalone SPA: React 19.3.0, React Router 7.18.4, Vite 7.3.6, TypeScript 5.9.3.
- No Next.js App Router or Pages Router. Local API: Express 5.2.1. Hosted API: Cloudflare Worker via ChatGPT Sites.
- Existing conventions: `src/components`, `src/api.ts`, `lib/studio-adapter`, `server`, `tests`.
- Existing seed/mock supplied most UI content already; this work extended and hardened that boundary rather than replacing the UI.
- Local JSON and hosted D1/R2 demo persistence retained. Tests use Node's test runner through tsx, plus an existing Playwright/Chrome workflow.
- Repository moved during the task; verified current location is `/Users/hudsonmyung/Desktop/Dev Lab`.

## Files created

- `lib/studio-adapter/devlab.server.ts`: unconfigured Dev Lab adapter and configuration placeholders.
- `lib/studio-adapter/server-only.ts`: runtime boundary guard.
- `lib/studio-adapter/errors.ts`: shared server-side errors, including `DevLabAdapterNotConfiguredError`.
- `lib/studio-adapter/artifact.server.ts`: safe artifact DTO projection and legacy normalization.
- `lib/studio-adapter/capabilities.ts`: typed unsupported defaults and action/capability mapping.
- `lib/studio-adapter/defaults.ts`: browser-safe empty intake defaults.
- `server/studio-actions.ts`: shared capability enforcement and action dispatch.
- `scripts/client-boundary.mjs`: transitive import-graph checks and Vite boundary plugin.
- `tests/foundation.test.ts`: foundation contract, selection, availability, artifact and boundary tests.
- `public/previews/sample-brand-brief.txt`: actual downloadable sample media.
- `.env.example`: optional server-only configuration placeholders.
- `docs/DEVLAB_STUDIO_ADAPTER.md`: future mapping and integration guide.
- `docs/STUDIO_ADAPTER_FOUNDATION_REPORT.md`: this report.

## Files modified

- Adapter: `types.ts`, `mock.ts`, `seed.ts`, `index.server.ts`.
- APIs/storage: `server/index.ts`, `server/worker.ts`, `server/hosted-storage.ts`.
- Screens: `src/App.tsx`, `src/components/ProjectPage.tsx`, `Intake.tsx`, `shared.tsx`.
- Tests: `tests/adapter.test.ts`, `hosted.test.ts`, `workflow.e2e.mjs`.
- Tooling/documentation: `vite.config.ts`, `package.json`, `README.md`, `INTEGRATION.md`.

## StudioAdapter methods

`getProjects`, `getProject`, `createProject`, `getStages`, `getAgents`, `getProductionRun`, `getEvents`, `getArtifacts`, `getIterations`, `getApprovals`, `getReviews`, `getReadiness`, `getMedia`, `getLibrary`, `startRun`, `resumeRun`, `pauseRun`, `cancelRun`, and `approveGate`.

Existing UI compatibility methods retained: `getSnapshot`, `getRunStatus`, `archiveProject`, `updateContext`, `addAssets`. The contract also exposes `mode` and immutable `capabilities`. Demo advancement/resolution stays outside this production contract.

## Domain types

`StudioProject`, `StudioProjectSummary`, `StudioAgent`, `StudioStage`, `StudioProductionRun`, `StudioEvent`, `StudioArtifact`, `StudioApproval`, `StudioIteration`, `StudioReview`, `StudioQAFinding`, `StudioReadiness`, `StudioMedia`, `StudioLibraryItem`, `StudioCapabilities`. Supporting types cover context, inputs, aggregate detail/snapshot, modes, actions, event pagination and library filters.

IDs are strings; upstream-facing status vocabularies are extensible. Agents, stages, QA dimensions, artifact types and library categories are data-driven collections. Summary views omit full intake context.

## MockStudioAdapter behavior

- `mode: "mock"`; visible DEMO MODE labels.
- Forma building, Offscript awaiting direction approval, Kinfolk blocked on content; Orbit is a finished example.
- Explicit demo-only lifecycle and approval behavior retained, including stale/invalid approval rejection and persisted feedback.
- Realistic event history, artifacts, three iterations per seeded project, QA findings, readiness, media and library.
- No autonomous progress timers or real engine execution. UI polling only reads state.
- Read methods return detached views so callers cannot mutate stored state accidentally.
- No event streaming or direct agent control is claimed.

## DevLabStudioAdapter skeleton

Conforms to the exact interface. Every operation rejects with `DevLabAdapterNotConfiguredError`; all capabilities are false. Optional `DEVLAB_ROOT`, `DEVLAB_API_URL`, `DEVLAB_SUPABASE_URL`, and `DEVLAB_ADAPTER_MODE` are server-side placeholders. Supplying them does not enable integration. No external Dev Lab access occurs.

## Server/client boundary

`getStudioAdapter()` is the only application constructor/resolver. It defaults to mock and rejects unknown modes. Both Express and hosted Worker use it; hosted devlab selection bypasses mock storage entirely.

Clients use the existing same-origin API. Vite and the architecture lint check reject transitive/dynamic server implementation imports; a runtime guard adds defense in depth. Artifact DTOs expose safe preview/download URLs, titles and allowlisted metadata, not filesystem paths or commands. Existing persisted artifact fields are normalized server-side. Capabilities are enforced in APIs as well as reflected by controls. These capabilities do not replace authentication or project authorization for a future live adapter.

## Existing screens migrated

Dashboard/project list use summaries and capability-aware creation. Project detail/progress consume stages and production-run views; agents and activity remain server-fed. Approvals respect adapter availability. Review/iterations use adapter artifacts and preview URLs. QA consumes reviews and readiness. Media uses its explicit collection/download URLs. Library respects read/reference capabilities. Intake uses shared empty defaults and supports draft-only adapters. No styling or overall layout redesign was performed.

## Tests/build results

- Architecture lint: passed. This repo had no general-purpose linter; `npm run lint` now checks client/server imports.
- Typecheck: passed.
- Adapter/persistence/foundation tests: 17 passed.
- Existing Chrome workflow: passed intake, upload/download, pause/resume, feedback, approval gates, QA, completion, archive, previews, comparison, mobile navigation and API validation.
- Added browser assertions: unsupported lifecycle and project-creation controls are absent.
- Local production build: passed.
- Hosted production build: passed.

## TODOs for real Dev Lab integration

All proposed mappings in `DEVLAB_STUDIO_ADAPTER.md` are **TODO VERIFY**. Verify schema, IDs, stage vocabulary, agent registry, QA/readiness and approval semantics before implementing reads. Then add authenticated/authorized commands through the existing orchestrator, safe artifact delivery and idempotency/version handling. Enable each capability only after implementation and integration tests. Dev Lab remains authoritative for production and CLIENT_READY; no second production engine was introduced.

No commands were executed against AI_COMMAND_CENTER, and no real Dev Lab business logic was inspected or copied.
