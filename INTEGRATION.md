# Connect the existing Dev Lab

## Boundary

```text
React UI → same-origin /api → StudioAdapter (server only) → existing Dev Lab
```

The Dev Lab remains authoritative. The frontend renders snapshots, sends explicit commands, and refreshes every five seconds. It does not schedule agents, infer production transitions, execute shell commands, or access the filesystem.

`lib/studio-adapter/types.ts` defines serializable views for projects, agents, stages, artifacts, events, approvals, iterations, reviews, and library items. Stage count, agent count, artifact types, library categories, and QA categories are data-driven. Project status is a small presentation vocabulary; map richer Dev Lab statuses into it while preserving details in events. Project `actions` are capabilities supplied by the server, not derived in the browser.

## Adapter foundation

See [docs/DEVLAB_STUDIO_ADAPTER.md](docs/DEVLAB_STUDIO_ADAPTER.md) for the authoritative foundation contract, server boundary, capabilities, and proposed mappings. Every real Dev Lab mapping is **TODO VERIFY**; no real engine has been inspected or connected.

`getStudioAdapter()` selects `mock` (default) or the unimplemented `devlab` skeleton using `DEVLAB_ADAPTER_MODE`. Both implement the same contract. The skeleton exposes no supported capabilities and all operations fail with `DevLabAdapterNotConfiguredError`; providing environment values does not enable real integration. Browser components only call same-origin API routes.

The existing demo extension handles explicit advancement/content-resolution only in mock mode, outside the production contract. Demo data must never be used to infer real production readiness. In the future, implement the server-only skeleton using verified upstream mappings and enable capabilities individually.

| Adapter operation                             | Existing Dev Lab responsibility                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `createProject`, `updateContext`, `addAssets` | Store intake, references, and asset metadata in the existing project system   |
| `startRun`                                    | Submit a run using the existing orchestrator                                  |
| `getProjects`, `getProject`, `getRunStatus`   | Read authoritative project and run state                                      |
| `getAgents`, `getEvents`                      | Read registered agents, assignments, and production events                    |
| `getArtifacts`, `getIterations`, `getLibrary` | Map existing artifact manifests, screenshots, previews, and design references |
| `approveGate`                                 | Resolve the specific pending Dev Lab gate with user feedback                  |
| `pauseRun`, `resumeRun`, `cancelRun`          | Forward supported commands to the existing run controller                     |
| `archiveProject`                              | Archive in the authoritative project store                                    |

The current mock is single-process JSON storage for local demonstration, not a production state database. Live state should come from existing Supabase tables, manifests, or the lab API. Credentials stay in server environment variables, never Vite variables or browser bundles.

## Server integration details

- Existing TypeScript scripts, Python CLI, and `./command.sh` may be invoked only behind the adapter. Use fixed executable/command allowlists and argument arrays, never interpolated shell strings. Validate project IDs against authoritative records. Keep client text out of command syntax.
- Submit long-running work to the lab’s existing orchestrator and return the run ID promptly. Do not invent a second worker queue or duplicate agents.
- Agent YAML/configuration remains owned by Dev Lab. Map its current registry to `StudioAgent[]`; add nothing to the frontend when the registry changes.
- Check permissions, gate IDs, run versions, and command availability on the server at mutation time. Make commands idempotent and return meaningful conflict errors for stale approvals.
- Add authenticated sessions and per-project authorization before exposing the app beyond localhost. Current API protection is only local binding and same-origin mutation checks; this is not production authentication.
- Replace local uploads with the lab’s approved storage flow. Preserve size limits, authorization, and safe filenames; record metadata in the existing system. Downloads currently use server-generated IDs and attachment disposition so uploaded HTML/SVG cannot execute in the application origin.
- Review previews are sandboxed without `allow-same-origin`. Use an isolated preview origin in production. Some sites prohibit framing; provide an Open website link as fallback. Validate preview/artifact URLs on ingestion, supply signed asset URLs where needed, and prevent arbitrary filesystem path exposure.
- Screenshots are optional in `StudioProject`. If supplied, use those for card thumbnails; preview HTML is the mock fallback.
- If immediate events are required, replace polling with the lab’s event stream/SSE. Preserve the same view models; avoid a browser state machine.

## Local API

- `GET /api/studio` — dashboard, agents, approval summary, library.
- `GET /api/projects/:id` — complete project view.
- `POST /api/projects` — validated intake.
- `PUT /api/projects/:id/context` — update context.
- `POST /api/projects/:id/actions` — server-validated action.
- `POST /api/projects/:id/approvals/:gateId` — approve or request changes.
- `POST /api/projects/:id/assets` — multipart `files`, 20 × 25 MB maximum.
- `GET /api/assets/:id` — attachment download.

Errors return JSON `{ "error": "..." }` with 400 validation, 404 missing record, 409 conflict, 413 upload limit, or 500 server failure. Demo-only commands must never be enabled on a live lab.
