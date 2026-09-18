# STUDIO LIVE INTEGRATION — PASS 1
# COMPREHENSIVE IMPLEMENTATION REPORT

## 1. EXECUTIVE VERDICT

**PASS 1 COMPLETE — READY FOR REAL-CONTROL TESTING**

Hosted Studio reads the allowlisted real Eagle Wings CPE project through Supabase, including its live run, events, approvals, and recorded readiness outcome. A separately supervised Mac runner appears online based on authenticated heartbeats. The browser submitted durable synthetic commands, the Mac claimed them, and results returned to the hosted UI; duplicate requests, recovery, retry exhaustion, invalid commands, and private synthetic artifacts were exercised. Real factory controls remain disabled, and no CPE command was executed by this pass. “Ready” means a narrowly reviewed disposable-project test may be prepared after Hudson review, not that production controls may be switched on.

| Hosted capability | Answer |
|---|---|
| Observe real Dev Lab | YES — currently restricted to the configured Eagle Wings slug |
| See a live CPE run | YES — observed RUNNING during acceptance |
| Communicate with Mac runner | YES |
| Submit a queued command | MOCK ONLY |
| Receive runner result | YES — mock execution results |
| Control real factory | NO |

Live site: https://hudson-dev-lab.hudsonmyung.chatgpt.site . Factory bridge route: `/bridge`.
Machine-readable evidence: [evidence/pass1-hosted.json](evidence/pass1-hosted.json). Times below are UTC; this testing occurred September 17 in Los Angeles.

## 2. STARTING ARCHITECTURE

Studio: `/Users/hudsonmyung/Desktop/Dev Lab`, Git branch `master`, tracking GitHub `origin/main`. It uses React 19, React Router 7, Vite 7, TypeScript 5.9, a local Express server, and a Cloudflare Worker published through Sites. There is no Next.js App/Pages Router. D1 stored one revision-checked `studio_state` JSON row for demo projects; R2 stored demo uploads. MockStudioAdapter already implemented a manually advanced demo workflow. DevLabStudioAdapter was an unconfigured skeleton; every operation threw. No local factory bridge or durable command transport existed in this Studio.

The existing API relied on Sites perimeter access and a same-origin mutation check, without an explicit Worker owner/runner authorization split. `loadStudio()` supplied a real-mode `save()` that threw; the Worker called `save()` after every mutation.

Read-only factory inspection: `/Users/hudsonmyung/AI_COMMAND_CENTER`, branch `main`, including migrations 018/027/029, CPE config, orchestrator CLI, approval CLI, and existing Supabase connection configuration. Its already dirty worktree was not edited. No AI_COMMAND_CENTER-bridge worktree was needed because all new code lives in Studio.

## 3. FINAL ARCHITECTURE

```text
Browser
→ Sites sign-in and existing owner/viewer access policy
→ Worker identity/role authorization
→ StudioAdapter resolver
→ DevLabStudioAdapter
→ allowlisted GET-only Supabase read source
→ authoritative CPE tables

Browser synthetic action
→ authenticated Worker
→ D1 bridge_commands
← outbound HTTPS polling by Mac runner
→ fenced acknowledgment
→ MOCK executor + local durable execution journal
→ result returned to Worker/D1
→ browser polls and displays result

Mac runner → authenticated heartbeat → D1 bridge_runners → online/offline UI
Synthetic artifact → Worker → private R2 → authenticated same-origin URLs
```

AUTHORITATIVE STATE: CPE/Supabase and CPE-owned files. COMMAND TRANSPORT: D1 queue, not a CPE lifecycle. ARTIFACT TRANSPORT: authenticated Worker/R2 routes. LOCAL EXECUTION: separate Mac shadow runner. HOSTED STORAGE: D1 queue/presence/existing demo row and R2 published objects. Real CPE snapshots are not persisted into D1; the adapter only uses short-lived in-memory read deduplication.

## 4. DEVLABSTUDIOADAPTER IMPLEMENTATION

All 24 contract methods are accounted for below. Configured reads fail clearly if upstream access fails; they never substitute demo data. Missing credentials/project scope produce DevLabAdapterNotConfiguredError (503). Unauthorized/unknown project produces 404. Invalid event options produce 400. Upstream non-success HTTP responses produce a sanitized 502; other unexpected failures return a generic 500 without upstream bodies or credentials.

| Method | Implementation / source | Read/write | Capability / error |
|---|---|---|---|
| getSnapshot | REAL aggregation of scoped project views | Read | Read flags true; propagated read failure |
| getProjects | REAL creative_studio_projects + current run projections | Read | canReadProjects true |
| getProject | REAL scoped joined view of CPE sources | Read | canReadProjects true; unknown scope 404 |
| getRunStatus | REAL project status projection | Read | canReadRuns true |
| getStages | REAL current stage and witnessed STAGE_ADVANCED events | Read | canReadStages true |
| getAgents | REAL agents/labs plus run responsibility | Read | canReadAgents true |
| getProductionRun | REAL latest creative_studio_production_runs row | Read | canReadRuns true; null if absent |
| getEvents | REAL current run event history | Read | canReadEvents true; newest 200 available, default returned 100 |
| getArtifacts | REAL indexed metadata, no local bytes | Read | canReadArtifacts true; unavailable transport yields no URLs |
| getIterations | REAL production iteration rows | Read | canReadIterations true; empty if absent |
| getApprovals | REAL approval history + pending run-derived view | Read | canReadApprovals true |
| getReviews | REAL review/iteration score projections | Read | canReadQA true; no fabricated reviews |
| getReadiness | REAL stored client_ready/result/blockers | Read | canReadReadiness true |
| getMedia | No synchronized real media; empty after project authorization | Read | canUploadMedia false; real media delivery unsupported |
| getLibrary | UNSUPPORTED | Read | canReadLibrary false; 501 when configured |
| createProject | DISABLED; separate real plan prepared | Write | canCreateProject false; 501 |
| startRun | DISABLED; separate real plan prepared | Write | canStartRun false; 501 |
| resumeRun | DISABLED; separate real plan prepared | Write | canResumeRun false; 501 |
| pauseRun | UNSUPPORTED | Write | canPauseRun false; 501 |
| cancelRun | UNSUPPORTED pending safe cancellation | Write | canCancelRun false; 501 |
| approveGate | DISABLED pending real gate fencing | Write | canApprove false; 501 |
| archiveProject | DISABLED | Write | canArchiveProject false; 501 |
| updateContext | DISABLED | Write | canUpdateContext false; 501 |
| addAssets | DISABLED | Write | canUploadMedia false; 501 |

Unconfigured mutation calls retain the earlier NotConfigured error. Transport-only synthetic commands are intentionally outside the production adapter mutation contract.

## 5. REAL CPE DATA MAPPINGS

| Domain | Verified source and fields | Transformation / limitation |
|---|---|---|
| StudioProject | creative_studio_projects: id, slug, client_name, project_type, current_stage, status, brief_summary, goal, timestamps | Display projection; raw run status retained as sourceStatus; actions empty; sensitive path columns not selected |
| StudioStage | project.current_stage; creative_studio_production_run_events detail.from/to | Only witnessed stages and current stage. No copied 15-stage transition rules; recent-history coverage can be incomplete |
| StudioAgent | labs.slug=dev-lab → agents.lab_id/id/name/role; run.responsible_agent | Project-scoped responsibility; does not infer process liveness from the agents table |
| StudioProductionRun | creative_studio_production_runs, latest run_number | Raw status, stage, responsible agent, current_production_iteration, started_at, updated_at |
| StudioEvent | creative_studio_production_run_events by run_id | event_type/message, timestamp, whitelisted agent/stage/route/reason details; no raw detail blob |
| StudioArtifact | creative_studio_artifacts | id, artifact_type, title, version, created_by_agent, timestamp. Filesystem paths/unknown metadata excluded; real URLs currently absent |
| StudioApproval | approvals.action_type and approved_at; run.human_gate; run.blockers | Exact project token match includes human-decision suffixes; pending run requirements are views, not new authoritative approval records |
| StudioIteration | creative_studio_production_iterations | Actual rows and iteration numbers/status/outcome/scores/counts; local source/base URLs and output paths excluded |
| StudioReview/QA | creative_studio_reviews.scores/decision; iteration.dimension_scores; run readiness reasons | Dynamic dimensions, existing decision displayed; no Studio scoring engine |
| StudioReadiness / CLIENT_READY | run.client_ready, client_ready_result.reasons, blockers | Stored result displayed verbatim in meaning; no gate recomputation |

TODO: synchronize approved real artifact bytes, expose deeper on-disk review/Production Readiness manifests safely, add complete event pagination, and verify additional project types before expanding the slug allowlist. Empty iteration/review tables are not filled with invented records.

## 6. LIVE EAGLE WINGS READ-ONLY PROOF

Hosted acceptance snapshot began `2026-09-18T06:10:44.912Z`:

- Project: `eagleswings-cpe2-trial`, Eagle's Wings Global.
- Project ID: `653f7041-ec7b-47fb-9064-2730dc1aa02d`.
- Stage: `CREATIVE_QA`.
- Run ID: `7a884bdd-f2c2-49fd-88d1-8e37bfac8f31`.
- Run status: `RUNNING`; run updated `2026-09-18T06:10:18.502+00:00`.
- Responsible agent: `Critic & Learning Director`.
- Latest event: `RUN_LOCK_ACQUIRED` at `06:10:20.596207`; other latest events included RUN_LOCK_RELEASED, HUMAN_DECISION_REQUIRED, and REVISION_ROUTED.
- Direction and build approvals: approved in the existing shared approvals table.
- Run iteration counter: 2. Dedicated production-iteration rows returned: 0. Dedicated review rows at initial inspection: 0.
- Recorded readiness: blocked, 30 projected reasons/blockers; CLIENT_READY=false. This is the recorded CPE assessment, not a new Studio assessment.

Earlier inspection saw REVISION_REQUIRED and a human-decision blocker; the later RUNNING state demonstrates observation of changing real state while Claude continued. The displayed state can naturally change after these timestamps. **ZERO mutation commands were issued to Eagle Wings.**

## 7. COMMAND QUEUE

Backend: existing hosted D1 binding `DB`; new `bridge_commands` table. Fields cover command ID, project/type/mode/payload, requested_by, created_at, status, claimant/time/token/lease, attempts, acknowledgment, result/error/completion, available_at, idempotency key/fingerprint, and transition history.

States: QUEUED, CLAIMED, RUNNING, SUCCEEDED, FAILED, CANCELLED. UUIDs identify commands and idempotency requests. A unique `(requested_by, idempotency_key)` index deduplicates repeated submissions; changed content under the same key returns 409. Atomic `UPDATE ... RETURNING` claims one eligible job. Each claim has a random fencing token and 60-second lease; start/finish require matching claimant/token/state.

Retries are permitted only for known synthetic failures before execution, at most three attempts, with a two-second availability delay. Stale CLAIMED jobs can requeue until the ceiling; stale RUNNING jobs fail for manual review and are never automatically replayed. Concurrent claim attempts were tested against SQLite-backed D1-compatible storage. Terminal acknowledgment replay returns the existing result. An owner can cancel an unclaimed transport job; no CPE cancellation occurs.

Permitted queue commands: CREATE_PROJECT, START_RUN, RESUME_RUN, APPROVE_GATE — MOCK only, bridge-smoke-test only. Not permitted: REAL jobs, any live project, CANCEL_RUN, PAUSE_RUN, arbitrary/unknown command types, shellCommand, arbitrary nested payload keys, executables, paths, and free-form shell instructions. **Arbitrary shell execution is not available through this interface.**

## 8. LOCAL MAC RUNNER

Implementation: Studio `runner/index.ts`, Node v26.8.1 with tsx and node:sqlite. Runner ID: `hudson-mac-shadow`. Supervised by user LaunchAgent `com.hudson.studio-bridge-shadow`, with KeepAlive, RunAtLoad, and ten-second restart throttling. It is installed and currently running in MOCK mode; no manual start is currently required while Hudson's user session is active.

Manual equivalent:

```sh
cd '/Users/hudsonmyung/Desktop/Dev Lab'
npm run bridge:runner
```

Do not start a second manual copy while launchd is supervising the service. Supervisor configuration: `/Users/hudsonmyung/Library/LaunchAgents/com.hudson.studio-bridge-shadow.plist`. Private runner config: `.studio/runner.json`. Journal: `.studio/runner-journal.sqlite`. Logs: `.studio/runner.log` and `.studio/runner-error.log`.

Authentication combines the existing Sites machine-access token with a separately generated runner token. Heartbeats occur every 15 seconds; polling every two seconds, with 12-second request timeouts and four-second polling backoff after errors. Completion transport retries three times with the same claim. The persistent execution journal prevents completed work from executing again; an uncertain in-progress journal record is quarantined. SIGTERM/SIGINT requests graceful shutdown and an offline heartbeat. Only this new service was stopped/restarted during testing.

## 9. FACTORY ONLINE / OFFLINE

Online requires an authenticated `bridge_runners` heartbeat no older than 45 seconds and online=true. Supabase availability is irrelevant. The UI displays the last-seen timestamp and MOCK executor mode; absent/stale heartbeat means FACTORY OFFLINE. A network/status request failure shows status unavailable rather than asserting online. When the Mac sleeps, no heartbeat arrives and online expires after 45 seconds; queued work remains durable.

Actual hosted UI test: offline heartbeat at `06:11:42.557Z`; after restarting only the shadow service, online heartbeat at `06:12:26.766Z`. Both FACTORY OFFLINE and FACTORY ONLINE were asserted in the browser. The exact 45-second expiry boundary was additionally tested with a controlled clock; physical Mac sleep was not exercised.

## 10. MOCK EXECUTOR

The runner revalidates project, mode, command, idempotency key, and the strict scenario payload. Success returns MOCK_COMPLETED, executionCount=1, cpeInvoked=false, a fixed synthetic stdout summary, and no stderr. Fail-once/always-fail scenarios generate controlled failures before synthetic execution. Worker validates the result, stores it, and the browser displays it. MOCK dispatch never calls the real executor or invokes CPE/subprocesses. The local durable journal and queue evidence both show one execution for completed jobs.

## 11. REAL EXECUTOR MAPPINGS

| Studio command | Prepared authoritative path | State |
|---|---|---|
| CREATE_PROJECT | runner realCommandPlan → command.sh creative-studio project create --client <name> --slug <disposable> | IMPLEMENTED BUT DISABLED in hosted/runner dispatch |
| START_RUN | realCommandPlan → dashboard npm run creative-studio:orchestrator -- run --project <disposable> | IMPLEMENTED BUT DISABLED |
| RESUME_RUN | realCommandPlan → same npm entrypoint, run-resume | IMPLEMENTED BUT DISABLED |
| APPROVE_GATE | verified command.sh creative-studio approve --project <slug> [--note ...] | NOT YET ENABLED/IMPLEMENTED as a safe executor; plan throws until expected gate/run fencing exists |
| CANCEL_RUN | inspected orchestrator run-cancel | NOT YET IMPLEMENTED; safe cancellation unverified |

`executeReal` uses fixed argument arrays and shell=false, requires explicit disposable-only opt-in and a separate non-symlink bridge worktree. Only bridge-disposable-* slugs pass planning. No arbitrary executable or shell text enters the queue. Pass 1 runner refuses REAL startup and never calls executeReal. **Real execution was not tested.**

## 12. HOSTED MUTATION FIX

Before: Worker called save() after every mutation; Dev Lab save() threw. Now loadStudio returns `{adapter, persistence}`. Mock mode owns a revision-checked persistence.save(); Dev Lab mode returns persistence=null and never reads/initializes the demo row. Worker saves only when persistence exists. Bridge commands have independent queue endpoints that return without generic app-state saving. CPE remains the sole owner of real production mutations; none are currently enabled.

## 13. ARTIFACT TRANSPORT

StudioArtifact supports id, type, title, MIME type, metadata, previewUrl, downloadUrl, thumbnailUrl, and timestamps. ArtifactTransport supplies browser-safe URLs; unpublished real artifacts return no URLs. CPE filesystem_path, local preview servers, and unknown metadata never cross into the UI.

Synthetic proof: `eec4a1a7-91c7-4e73-97d7-05dbab06f6bb`, 208-byte fixed SVG stored under `bridge/<id>` in R2. Preview/thumbnail route `/api/bridge/artifacts/<id>`; download adds `?download=1`. Each fetch requires authorization; responses use private/no-store, nosniff, and a restrictive sandbox CSP. URLs contain no bearer token and do not themselves expire; access is checked on every request. No directory traversal or user-supplied local file path is accepted. **No Eagle Wings artifact was uploaded.**

## 14. SECURITY MODEL

Sites sign-in/access policy is preserved for Hudson and the existing viewer. Worker checks dispatch-provided identity against explicit owner/viewer configuration. Owner submits synthetic commands; viewers observe but cannot submit them. Runner token grants runner endpoints only and cannot read CPE via the Worker. Machine requests require both the Sites gate token and a separately scoped application token. Same-origin checks protect browser mutations.

Queue validation is strict and project-specific; claims are fenced; idempotency keys prevent repeated requests; retries are bounded; uncertain execution does not replay. Credentials remain in secret Worker variables and chmod-0600 local configuration inside the private .studio directory, not browser bundles, URLs, Git, or logs. Runner logs contain fixed event names/IDs/codes; Worker diagnostics redact configured token/key/secret values. CPE projections redact local paths and whitelist fields. Client import-graph checks reject server implementations.

Live authorization probes returned HTTP 401 for anonymous requests, forged identity headers, and platform-token-only requests. Simulated Worker tests additionally checked viewer writes, owner use of runner endpoints, runner CPE reads, and cross-origin writes. Independent interactive sign-in as Annie was not tested.

**Inbound public port on Hudson's Mac: NO.** Runner makes outbound HTTPS calls only. A socket inspection found no TCP listener on the shadow runner. No tunnel/ngrok was installed or used.

## 15. END-TO-END MOCK FUNNEL PROOF

Browser Factory bridge → START_RUN synthetic request → authenticated Worker → persisted queue UUID → online Mac runner → atomic claim → RUNNING acknowledgment → MOCK executor → SUCCEEDED result → hosted UI status.

Success command: `d1b0ede3-aa8e-4d2a-973e-a989b2092cfd`.

| Event | UTC timestamp |
|---|---|
| QUEUED | 06:10:56.818 |
| CLAIMED by hudson-mac-shadow | 06:10:59.351 |
| RUNNING acknowledged | 06:11:00.042 |
| SUCCEEDED | 06:11:00.589 |

Attempt count 1; result MOCK_COMPLETED, executionCount 1, cpeInvoked false. Browser-observed round trip: 6,226 ms, including UI polling. Invalid test sent type=SHELL plus payload.shellCommand=INVALID_SENTINEL_DO_NOT_EXECUTE through a browser request. Worker rejected it with HTTP 400 at schema validation; no job was created and no executor received it.

## 16. DUPLICATE / IDEMPOTENCY PROOF

The UI's Repeat same request resent idempotency key `de40ea84-d59d-4a41-9872-7f79a024ae87`. Both responses identified command `d1b0ede3-aa8e-4d2a-973e-a989b2092cfd`; attempt count remained 1 and executionCount remained 1. The Mac SQLite journal independently recorded execution_count=1. The queue did not create or execute a second command. Changed content with the same key was separately tested to return 409. This is scoped to the authenticated requester; it is not a claim of universal exactly-once semantics for future external CPE side effects.

## 17. FAILURE / RETRY PROOF

Recovering failure: `48c4d74f-be6a-478e-8b82-82c25944816f`, scenario fail-once. First attempt acknowledged then returned MOCK_TRANSIENT_FAILURE before work; queue requeued it. Second attempt completed successfully: final SUCCEEDED, attempt_count=2, execution_count=1. Browser round trip 11,318 ms.

Exhaustion: `d545b03e-8581-4c7a-82fa-30c0fc527624`, scenario always-fail. Three controlled pre-execution failures produced FAILED, attempt_count=3, execution_count=0, stderr/error MOCK_TRANSIENT_FAILURE. Browser round trip 12,612 ms. It was not retried a fourth time. No duplicate synthetic execution occurred. Stale-lease recovery and uncertain-RUNNING quarantine were tested with a controlled clock, not a forced production crash.

## 18. CAPABILITIES AFTER PASS 1

| Actual flag | Configured DevLab adapter | Mock adapter |
|---|---|---|
| canReadProjects | REAL / true | MOCK / true |
| canReadStages | REAL / true | MOCK / true |
| canReadAgents | REAL / true | MOCK / true |
| canReadRuns | REAL / true | MOCK / true |
| canReadEvents | REAL / true | MOCK / true |
| canReadIterations | REAL / true | MOCK / true |
| canReadApprovals | REAL / true | MOCK / true |
| canReadQA | REAL / true | MOCK / true |
| canReadReadiness | REAL / true, includes stored CLIENT_READY | MOCK / true |
| canReadArtifacts | REAL metadata / true | MOCK / true |
| canReadLibrary | UNSUPPORTED / false | MOCK / true |
| canStartRun | DISABLED / false | MOCK / true |
| canResumeRun | DISABLED / false | MOCK / true |
| canPauseRun | UNSUPPORTED / false | MOCK / true |
| canCancelRun | UNSUPPORTED / false | MOCK / true |
| canApprove | DISABLED / false | MOCK / true |
| canCreateProject | DISABLED / false | MOCK / true |
| canArchiveProject | DISABLED / false | MOCK / true |
| canUpdateContext | DISABLED / false | MOCK / true |
| canUploadMedia | DISABLED / false | MOCK / true |
| canAdvanceDemo | DISABLED / false | MOCK / true |
| canStreamEvents | UNSUPPORTED / false | UNSUPPORTED / false |
| canControlAgents | UNSUPPORTED / false | UNSUPPORTED / false |

Unconfigured DevLab read flags remain false. Bridge canSubmit is a separate owner-only synthetic-console permission, never a production capability.

## 19. UI CHANGES

Dashboard/project cards show the real allowlisted project and raw CPE status. Project detail displays the real run, observed stages, responsible agents, real events, approval history/pending requirements, QA/readiness and iteration counter. Real progress does not use demo percent-completion bars. Unsupported mutations stay disabled/absent through capabilities/actions. Existing demo flow still works in mock mode.

New Factory bridge screen shows heartbeat presence/last seen, synthetic command submission, repeated-request test, scenario choice, command IDs/status/attempts/runner/results/history, and synthetic artifact proof. Topbar shows Factory status and DEV LAB · READ ONLY. Authentication/read errors remain explicit. Direct hosted project and bridge URLs now resolve without redirecting to the dashboard. Real website preview bytes and a real design library are still unavailable.

## 20. EXACT FILES CHANGED

Studio repo/path: `/Users/hudsonmyung/Desktop/Dev Lab`, branch `master`; pushed to GitHub main. **38 tracked files: 16 created, 22 modified, 0 deleted.**

Created:

```text
docs/STUDIO_LIVE_INTEGRATION_PASS_1_REPORT.md
docs/evidence/pass1-hosted.json
drizzle/0001_glorious_boomerang.sql
drizzle/meta/0001_snapshot.json
lib/bridge/types.ts
lib/bridge/validation.server.ts
lib/studio-adapter/cpe-source.server.ts
runner/README.md
runner/executors.ts
runner/index.ts
server/bridge-api.ts
server/bridge-auth.ts
server/bridge-queue.ts
src/components/Bridge.tsx
tests/bridge-hosted.e2e.mjs
tests/bridge.test.ts
```

Modified:

```text
.env.example
README.md
db/schema.ts
docs/DEVLAB_STUDIO_ADAPTER.md
drizzle/meta/_journal.json
lib/studio-adapter/artifact.server.ts
lib/studio-adapter/capabilities.ts
lib/studio-adapter/devlab.server.ts
lib/studio-adapter/index.server.ts
lib/studio-adapter/mock.ts
lib/studio-adapter/types.ts
package.json
server/hosted-storage.ts
server/index.ts
server/worker.ts
src/App.tsx
src/api.ts
src/components/ProjectPage.tsx
src/components/shared.tsx
src/styles.css
tests/hosted.test.ts
tsconfig.json
```

AI_COMMAND_CENTER bridge worktree: **0 files created, 0 modified, 0 deleted; no worktree/branch created or merged.** Live AI_COMMAND_CENTER: zero files modified by this pass.

Outside tracked source, created one LaunchAgent plist at the path in section 8. Ignored local runtime/evidence files: `.studio/runner.json`, `operator.json`, `runner-journal.sqlite` (plus SQLite WAL/SHM sidecars while running), `runner.log`, `runner-error.log`, `live-read-proof.json`, `hosted-proof.json`, `presence-proof.json`, `auth-proof.json`. Build/test outputs and temporary deployment archives are generated, not source. No credential contents are included here or in Git.

## 21. DATABASE / INFRASTRUCTURE CHANGES

| Item | State |
|---|---|
| D1 migration 0001_glorious_boomerang.sql | CREATED and applied live by Sites deployment |
| D1 bridge_commands and unique idempotency index | CREATED |
| D1 bridge_runners | CREATED |
| Existing studio_state schema/data | UNCHANGED by real-mode integration |
| Existing DB binding | UNCHANGED |
| Existing BUCKET binding | UNCHANGED |
| R2 synthetic bridge/<id> object | CREATED |
| Existing R2 demo objects | UNCHANGED |
| Supabase/CPE tables, views, grants, RLS, records | UNCHANGED; GET-only access |
| Worker source/deployment | MODIFIED |
| Sites access policy | UNCHANGED: owner plus existing viewer |
| Mac LaunchAgent/private config/journal | CREATED |
| Public inbound port/tunnel | NONE |

No Supabase migration was applied. No factory migration was created or run.

## 22. ENVIRONMENT VARIABLES / SETUP

Values are deliberately omitted.

| Variable/config | Required where | Configured now |
|---|---|---|
| DEVLAB_ADAPTER_MODE | Worker; optional local server | YES in Worker, devlab |
| DEVLAB_SUPABASE_URL | Worker read source | YES |
| DEVLAB_SUPABASE_SERVICE_ROLE_KEY | Worker secret read source | YES, secret |
| DEVLAB_READ_PROJECT_SLUGS | Worker read authorization | YES |
| BRIDGE_OWNER_EMAIL | Worker owner authorization | YES |
| BRIDGE_VIEWER_EMAILS | Worker viewer authorization | YES |
| BRIDGE_RUNNER_ID | Worker | YES |
| BRIDGE_RUNNER_TOKEN | Worker secret + private Mac runner config | YES |
| BRIDGE_OPERATOR_TOKEN | Worker secret + private acceptance-test config | YES |
| BRIDGE_CONFIG | Mac LaunchAgent; optional manual override | YES |
| BRIDGE_EXECUTOR_MODE | Mac runner | YES, MOCK |
| STUDIO_DATA_DIR | Optional local demo server | Default .studio |
| DEVLAB_ROOT / DEVLAB_API_URL | Future integration placeholders | NOT REQUIRED / not configured |
| Existing Sites machine token | Private runner/operator JSON config, not browser | YES, reused; not rotated |
| Separate CPE bridge worktree + disposable-only real opt-in | Future real executor | NO; not enabled |

Runner JSON fields origin, runnerId, runnerToken, siteToken, mode, journal are configured. Local Express is not automatically configured for real Supabase reads; it continues to default safely to mock mode.

## 23. TEST RESULTS

Actual Studio commands:

| Command | Result |
|---|---|
| npm run lint | PASS; client/server import boundary, exit 0 |
| npm run typecheck | PASS; tsc --noEmit, exit 0 |
| npm test | 33 tests, 33 passed, 0 failed, 0 skipped/cancelled/todo |
| npm run build | PASS; tsc + Vite production output |
| npm run build:hosted | PASS; tsc + Vite + Worker bundle and migration packaging |
| npm run test:e2e | PASS; existing full demo workflow, previews, uploads, approvals, QA, archive, mobile navigation |
| npm run test:bridge:hosted | PASS; real hosted browser/Worker/D1/Mac mock funnel, three final acceptance jobs, duplicate, invalid command, synthetic artifact; zero browser errors |
| git diff --check | PASS |

Additional actual probes: hosted offline/online browser assertions; anonymous/forged-identity/platform-token-only HTTP 401 checks; SQLite journal readback; no runner listening TCP socket.

Initial hosted attempts uncovered a Worker-incompatible redirect option and a pre-existing deep-link redirect issue; both were fixed and hosted acceptance rerun successfully. One intermediate browser test lost its browser before retry completion, while the durable job still succeeded; the subsequent complete browser run passed. No claim is made that these first attempts passed. Final tests/build emitted no warnings. The repo's lint command is a boundary check, not a full ESLint/style audit.

Factory/bridge-worktree lint/typecheck/tests/build: NOT RUN / NOT APPLICABLE — no factory-side code changes or bridge worktree. No tests or build commands were executed in the running factory repository. Runner and mapping tests are included in Studio's 33 tests; TypeScript includes runner/.

## 24. PERFORMANCE / LATENCY

Single-run observations, not benchmarks:

| Measurement | Actual observation |
|---|---|
| CPE hosted snapshot request | 1,973 ms |
| Successful mock submit response | 651 ms |
| Successful job queued→claimed | 2,533 ms from Worker timestamps |
| Successful job queued→terminal | 3,771 ms from Worker timestamps |
| Successful browser round trip | 6,226 ms including UI polling |
| Fail-once browser round trip | 11,318 ms |
| Retry-exhaustion browser round trip | 12,612 ms |
| Synthetic artifact retrieval | 596 ms, 208 bytes |
| Isolated heartbeat network latency | NOT MEASURED |
| Real CPE execution latency | NOT MEASURED / not executed |

## 25. CONCURRENCY SAFETY

Live repo remained `/Users/hudsonmyung/AI_COMMAND_CENTER` on main. Codex wrote only Studio files and its own private runner configuration/LaunchAgent. No factory worktree was created or merged; no live CPE file was edited. No Eagle Wings mutation, approval, start, resume, cancellation, artifact upload, or Supabase write occurred. No factory process was killed or restarted. The initial and final read-only Git status inventories show the same pre-existing dirty path list, while Claude could continue editing those files. Only the new shadow runner was deliberately stopped/restarted for presence testing. Supabase observation adds read traffic; this is not a claim of zero network/database load.

## 26. WHAT IS REAL VS STILL MOCKED

REAL NOW:

- Hosted authenticated CPE project/run/event/approval/readiness reads.
- Production capability enforcement and explicit scoped authorization.
- Durable D1 command queue, claims, transitions, retries and idempotency.
- Actual outbound Mac service, heartbeat, local execution journal and supervision.
- Actual browser submission/result display and private R2 synthetic bytes.

STILL MOCK / DISABLED:

- Every command executes only the synthetic MOCK executor.
- No CPE production mutation through Studio or the runner.
- Real execution helper paths are prepared but untested and disconnected from Pass 1 dispatch.
- Real approval fencing, safe cancel/pause, artifact synchronization and library integration remain unavailable.
- On-disk detailed QA/iteration reports are not uploaded; empty authoritative tables stay empty.

## 27. KNOWN LIMITATIONS / RISKS

| Limitation | Rating |
|---|---|
| No separate bridge worktree/disposable project exists yet; real helper has not been exercised | BLOCKING PASS 2 execution until explicitly prepared/reviewed |
| Approval expected-stage/run fencing absent | BLOCKING PASS 2 approval testing, not the first isolated CREATE_PROJECT test |
| Cancellation safety unverified; pause unsupported | BLOCKING corresponding real-control tests |
| Existing Supabase service-role key has broader DB privileges than GET-only adapter needs | NON-BLOCKING for scoped Pass 1; harden before broader rollout |
| Mac must be awake, logged in, network-connected, and runner available | NON-BLOCKING; UI reports offline, queue persists |
| Polling adds latency; CPE details/events limited to recent bounded reads | NON-BLOCKING; streaming/full pagination FUTURE IMPROVEMENT |
| RUNNING lease expiry quarantines rather than auto-replays; no operator recovery UI yet | NON-BLOCKING for mock proof; recovery procedure needed before real long-running jobs |
| Real helpers' process timeout/long-running CPE supervision not validated | BLOCKING START_RUN real testing until reviewed |
| Artifact URLs require authorization; real filesystem→R2 mapping not enabled | NON-BLOCKING for Pass 1; FUTURE IMPROVEMENT |
| Detailed on-disk iterations/reviews unavailable in hosted UI | NON-BLOCKING; table absence is disclosed |
| Annie's interactive sign-in not independently tested | NON-BLOCKING; access preserved and role logic tested |
| Manual token rotation/revocation and log retention/run history pagination | FUTURE IMPROVEMENT |
| Site supports only configured project scope; not a general multi-tenant control plane | NON-BLOCKING; expand only with authorization |

## 28. PASS 2 READINESS

**YES — safe to begin preparation and a narrowly scoped real CREATE_PROJECT test against a disposable project after Hudson review.** It is not safe to enable all real controls or to target Eagle Wings. First create the separate bridge worktree/branch, verify the official creation pathway on that checkout, and explicitly opt into only the disposable creation helper. This readiness verdict does not claim a real command has already succeeded. START_RUN supervision, approval fencing, cancellation, and production UI enablement require their own gates.

## 29. RECOMMENDED PASS 2 PLAN

1. Hudson reviews this report; create separate AI_COMMAND_CENTER-bridge worktree on codex/studio-bridge without merging main.
2. Authorize one disposable slug, e.g. bridge-disposable-pass2; test CREATE_PROJECT only through the official CLI mapping.
3. Verify its authoritative row and isolation. Review long-running process supervision/timeouts before START_RUN.
4. Run one real START_RUN on that disposable project and observe it read-only.
5. Implement expected-stage/run fencing, then test one explicit approval.
6. Test RESUME_RUN with authoritative preconditions and duplicate protection.
7. Verify CPE cancellation/locking semantics before any CANCEL_RUN exposure; leave PAUSE unsupported until proven.
8. Synchronize only disposable, approved artifacts through private transport.
9. Enable hosted controls individually after evidence/review; retain Eagle Wings protection.

## 30. FINAL ACCEPTANCE CHECKLIST

| Criterion | Result |
|---|---|
| Hosted Studio reads real CPE projects | PASS |
| Hosted Studio reads real production runs | PASS |
| Hosted Studio reads real events | PASS |
| Hosted Studio reads real QA/readiness | PASS — stored run assessment; detailed file reports not synchronized |
| Eagle Wings observed read-only | PASS |
| Local runner heartbeat works | PASS |
| Queue persists commands | PASS |
| Mac runner claims commands | PASS |
| Mock executor returns results | PASS |
| Invalid command rejected | PASS |
| Duplicate execution prevented | PASS — tested mock semantics and uncertain-work quarantine |
| Failure/retry behavior proven | PASS |
| No arbitrary shell execution through bridge | PASS |
| No public inbound Mac port | PASS |
| No local paths exposed to browser | PASS |
| Real mutation capabilities remain disabled | PASS |
| Active Eagle Wings run untouched | PASS — zero Codex factory mutations |

**PASS 1 COMPLETE — READY FOR REAL-CONTROL TESTING**

## 31. FINAL SHORT SUMMARY

WHAT WORKS NOW:

- Real, scoped hosted CPE observation.
- Supervised outbound Mac shadow runner and real heartbeat presence.
- Durable mock commands with claims, results, deduplication and bounded retries.
- Private synthetic artifact transport and authenticated UI access.

WHAT DOES NOT WORK YET:

- Real factory control through Studio or Pass 1 runner dispatch.
- Safe real approval/cancellation/pause.
- Real artifact and detailed file-report synchronization.
- General multi-project/tenant control, streaming, and real long-run recovery.

NEXT SAFE TEST:

After Hudson review, create the isolated bridge worktree and exercise only the official CREATE_PROJECT mapping for `bridge-disposable-pass2`.
