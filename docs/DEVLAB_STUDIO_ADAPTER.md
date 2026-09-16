# Studio adapter foundation

## Current architecture

React 19 + React Router 7 renders a Vite 7 SPA. There is no Next.js App Router or Pages Router. Browser code calls same-origin `/api` through `src/api.ts`. Express serves local development/production; `server/worker.ts` serves ChatGPT Sites. Both use the single `StudioAdapter` interface and `getStudioAdapter()` composition root.

`lib/studio-adapter/types.ts` contains browser-safe DTOs and the authoritative contract. `defaults.ts` contains empty intake defaults; `capabilities.ts` contains browser-safe capability interpretation. Concrete adapters, fixtures, configuration, file access, and hosted persistence are server-only. Vite checks the transitive client import graph and refuses server modules during development and builds; the runtime guard adds defense in depth. Browser code never imports adapter implementations.

## Selection and honest availability

`DEVLAB_ADAPTER_MODE=mock` is the default. The local process reuses one adapter with `.studio` JSON persistence. Hosted requests resolve adapters from D1 snapshots and commit with revision checks; files use R2. The resolver is the only application code that constructs adapters. Tests may construct isolated fixtures.

`DEVLAB_ADAPTER_MODE=devlab` constructs `DevLabStudioAdapter`. All capabilities are false, and every data or command operation rejects with `DevLabAdapterNotConfiguredError` (503). Merely filling in configuration does not enable integration. No filesystem, network, Supabase, orchestration, or process calls occur in this skeleton. Invalid modes fail closed rather than silently falling back.

Optional server-only placeholders: `DEVLAB_ROOT`, `DEVLAB_API_URL`, and `DEVLAB_SUPABASE_URL`. Never prefix these with `VITE_` or include them in DTOs. Runtime secrets belong in server configuration or Sites runtime variables, not source control.

## Contract and data

The contract exposes project summaries/details and creation; stages; project-filtered or global agents; production run; timestamp-paginated events; artifacts; iterations; approvals; reviews; readiness; media; filtered library; run start/pause/resume/cancel; and approval decisions. Existing context editing, uploads, archiving, aggregate snapshot, and run-status views remain supported for UI compatibility.

`getProject()` is the aggregate used by current tabs. It includes the same stages, run, reviews, readiness, media, and capabilities available through granular getters. `review` remains a first-review compatibility view; `reviews` is the collection. `getProjects()` omits intake context/reference IDs. IDs are strings; presentation statuses permit unknown upstream values. Stages, agents, QA dimensions, artifact types, and library categories are arrays/data, not fixed schema enumerations.

Mock mode supplies Forma (building), Offscript (direction approval), Kinfolk (content blockers), and Orbit (complete), with events, sample media, artifacts, multiple iterations, QA and readiness. Mutations only change demo state when explicitly invoked. There are no autonomous workers or progress timers. Read polling never advances demo work. Demo readiness is illustrative and never asserts real CPE `CLIENT_READY`. Demo advancement is an optional extension outside the production contract. Streaming and direct agent control are unsupported. Capabilities describe adapter support, while per-project `actions` describe current availability; the UI checks both, and APIs enforce capabilities independently.

Artifacts expose `id`, `projectId`, `type`, `title`, `mimeType`, `previewUrl`, `downloadUrl`, `createdAt`, and metadata. The mock normalizes old persisted `name`/`url` records without returning legacy fields. URL validation rejects filesystem paths, traversal, non-HTTPS external schemes, credential-bearing URLs and unsupported local routes. Metadata is allowlisted; never spread filesystem manifests into DTOs. Future adapters must authorize and translate local artifacts into opaque, safe server routes; do not pass absolute paths or commands to browser code. Preview framing remains sandboxed and uploads download as attachments.

## Proposed Dev Lab mapping — all TODO VERIFY

The real Dev Lab schema and files have intentionally not been inspected. These are candidate mappings supplied in the brief, not confirmed implementations.

| UI concept | Proposed Dev Lab source | Status |
| --- | --- | --- |
| StudioProject / StudioProjectSummary | `creative_studio_projects` | TODO VERIFY identifiers, tenancy and statuses |
| StudioProductionRun | `creative_studio_production_runs` | TODO VERIFY lifecycle and active-run selection |
| StudioEvent | `creative_studio_production_run_events` | TODO VERIFY ordering, pagination and streaming |
| StudioArtifact / StudioMedia | `creative_studio_artifacts` + artifact filesystem | TODO VERIFY ownership, manifests and safe URL delivery |
| StudioApproval | Existing Creative Studio approval mechanism | TODO VERIFY gate IDs, idempotency and authorization |
| StudioIteration | `creative_studio_production_iterations` | TODO VERIFY review/preview relationships |
| StudioReview / StudioQAFinding | Existing QA reports and findings | TODO VERIFY source and dimensions |
| StudioReadiness | Phase 4 Production Readiness / `CLIENT_READY` | TODO VERIFY authoritative checks and decision record |
| StudioAgent | `agents/dev-lab/*.yaml` + run execution state | TODO VERIFY registry and runtime assignments |
| StudioStage | Existing production-stage definitions + run state | TODO VERIFY vocabulary and ordering |
| StudioLibraryItem | Existing reusable design/reference catalog | TODO VERIFY source and filtering |
| Commands/actions | Server-side Dev Lab orchestrator / `command.sh` | TODO VERIFY supported commands and idempotency |
| StudioCapabilities | Features supported by the selected integration | TODO VERIFY each permission and implementation |

## Real integration work still required

1. Inspect the real engine only with authorization; verify all mappings above.
2. Implement read mappings in `DevLabStudioAdapter`, preserving upstream IDs/statuses and readiness decisions.
3. Add authentication and per-project authorization before enabling shared or live access. Sites currently gates the hosted demo to its owner; local Express binds to loopback. Capabilities are not identity authorization.
4. Use the existing orchestrator for writes, with validated IDs, idempotency/version checks, fixed executable allowlists and argument arrays. Never construct shell text from client input.
5. Add authorized artifact/media delivery and approved persistent storage. Decide how to migrate demo state separately; never treat it as real production data.
6. Enable capabilities individually only after implementation and contract/integration tests pass. No second production engine or state machine belongs here.

## Validation

`npm run lint` checks client/server architecture (the original repository had no general-purpose linter). `npm run typecheck` validates types. `npm test` covers adapter contracts, selection, retrieval, lifecycle, approvals, capabilities, safe URLs, import boundaries, and hosted persistence. `npm run build` builds local production; `npm run build:hosted` builds the Worker and client. `npm run test:e2e` runs the existing Chrome workflow against an isolated local fixture directory after the local build.
