# STUDIO LIVE INTEGRATION — PASS 2
# REAL CONTROL ACCEPTANCE REPORT

## 1. EXECUTIVE VERDICT

**PASS 2 COMPLETE — DISPOSABLE REAL CONTROL PROVEN**

Hosted Studio created a real CPE project, started its official orchestrator, approved its direction gate, resumed that same run, and delivered a real CPE artifact through private R2. These actions came from the hosted browser controls and durable queue, not manually launched factory commands. Four successful commands each have one recorded execution; independent CPE reads show one project, one production run and one direction approval. The run stopped naturally at AWAITING_BUILD_APPROVAL, which remains closed. This is disposable acceptance, not permission to remove the project fence.

| Hosted ability | Verdict |
|---|---|
| Create a real CPE project | YES — exact disposable slug only |
| Start a real production run | YES — one initial run only |
| Observe it live | YES — authoritative reads and polling |
| Approve a real gate | YES — fenced direction gate only |
| Resume the real run | YES — after that direction approval |
| Display a transported real artifact | YES — authenticated JSON preview and download |

Live Studio: https://hudson-dev-lab.hudsonmyung.chatgpt.site/bridge
Evidence: `docs/evidence/pass2-acceptance.json`. All timestamps below are UTC on 2026-09-18.

## 2. STARTING STATE

Studio: `/Users/hudsonmyung/Desktop/Dev Lab`, local master tracking origin/main, clean at `82d20ebcd1e6263051746e2182035307dac128cd`. React 19 / React Router 7 / Vite 7 / TypeScript 5.9; Express locally and a Cloudflare Worker on Sites. D1 held demo/command transport state; R2 held private synthetic artifacts. Production was version 10, environment revision 1. Read-only CPE and mock transport were already verified.

The live factory `/Users/hudsonmyung/AI_COMMAND_CENTER` was on main at `6e781aaca1bae409aa11f66baa191fa6af2b15f8`, with five pre-existing tracked modifications and several pre-existing untracked files belonging to the other work. Those were preserved. The new bridge worktree did not exist initially. It was created from freshly fetched origin/main at that same commit on branch `codex/studio-bridge`; no merge occurred.

Runner `hudson-mac-shadow`, LaunchAgent `com.hudson.studio-bridge-shadow`, was online in MOCK mode. Its original real helper had a 120-second subprocess timeout and no renewable queue lease. Production controls were false.

## 3. FINAL ARCHITECTURE

```text
Hosted browser owner control
→ Sites access boundary + Worker authentication
→ exact disposable command validation + owner authorization
→ D1 durable command queue / idempotency indexes
← outbound authenticated Mac runner polling
→ local SQLite dispatch intent
→ detached one-command supervisor / execution receipt
→ fixed argv, shell:false, isolated factory worktree
→ official CPE create / orchestrator / approval pathways
→ authoritative CPE Supabase records and local artifacts
→ read-only DevLabStudioAdapter → hosted browser polling

Disposable artifact source
→ runner ownership + realpath + content/size checks
→ authenticated outbound upload → private R2
→ authenticated preview/download URL → browser
```

AUTHORITATIVE STATE: existing CPE Supabase tables and CPE-produced files.
COMMAND TRANSPORT: D1 command records; no CPE lifecycle copy.
LOCAL EXECUTION: isolated worktree, runner, supervisor and SQLite journal.
ARTIFACT TRANSPORT: private R2 plus a D1 publication index.
HOSTED STORAGE: existing demo state and bridge transport/publication metadata only.

## 4. EXACT AUTHORIZED SCOPE

The only REAL target is `bridge-disposable-pass2`. Worker and runner both enforce that literal value. `eagleswings-cpe2-trial`, `eagleswings`, `eagleswings-v2`, other disposable names and every other project are rejected. Hosted negative probes returned 400 for all four tested unauthorized names. No request can supply an executable, cwd, shell text or arbitrary command arguments.

CPE root is exactly `~/AI_COMMAND_CENTER-bridge`, not a user-supplied job field. Symlink roots are refused. Only the direction approval gate and its subsequent EXPERIENCE_DESIGN resume are enabled. Build/final approvals, cancellation and pause are not exposed.

## 5. CREATE_PROJECT PROOF

Command: `a6069c88-a995-498e-b7cc-00c52bcd6947`.
Idempotency key: `0b6be37e-46b3-4d5d-b377-ef09e1babb29`.
Runner: `hudson-mac-shadow`; attempt count 1; execution count 1.

| State | Time |
|---|---|
| QUEUED | 07:34:29.981 |
| CLAIMED | 07:34:53.749 |
| RUNNING / acknowledgment | 07:34:54.720 |
| SUCCEEDED | 07:34:59.030 |

The browser submitted while the runner was deliberately disconnected. Independent CPE GET at 07:34:43 found zero disposable projects; the queue still held the command. Restarting the polling service delivered it.

Mapping: fixed `command.sh creative-studio project create --client "Bridge Disposable Pass 2" --slug bridge-disposable-pass2`, with the fixed goal and fictional Lantern Room brief in `runner/executors.ts`. The official command produced project `5831d3a0-3205-4b7a-a141-d57bfc2c1782`, created at 07:34:56.352265, stage INTAKE. Independent Supabase read confirmed exactly one project and no run before START was enabled. Both same-key and different-key duplicate requests returned the original command. Creation was stopped and independently verified before enabling START.

## 6. LONG-RUN SUPERVISION

SQLite persists dispatch intent before process creation. Each REAL command has a UUID execution identity and a private task receipt. A detached supervisor launches the fixed CPE subprocess, captures bounded output and updates its receipt every 5 seconds. The poller heartbeats every 15 seconds and renews the 60-second queue lease while that receipt is fresh. Its HTTP calls have a 12-second timeout; CPE execution has no bridge timeout. CPE retains its own orchestrator lock and internal agent limits.

On restart, the runner reconciles the existing receipt; it never spawns again from an existing intent. Missing or stale evidence means uncertain execution and blocks further real dispatch. REAL RUNNING jobs do not automatically requeue when connectivity/lease expires. Completion delivery retries the original fenced identity, not execution. A late completed receipt can reconcile after a disconnected period. Unclaimed jobs remain durable; expired CLAIMED jobs require a fresh opaque claim and fenced start.

Actual proof: the poller was disconnected for 68,252 ms while START was running. Supervisor PID 8993 and child wrapper PID 8995 retained execution `c787dea8-b486-43e0-bd86-388fc8a65886`. CPE continued to the direction gate. After restart, the same command completed with attempt count 1. The resumed execution ran about 143.5 seconds from supervisor dispatch through receipt completion, exceeding the previous 120-second bridge timeout. Queue progress was fresh at 07:45:35 after over 108 seconds in RUNNING. Unit tests also advance a virtual clock through five minutes of renewals and a one-hour disconnect.

LaunchAgent uses AbandonProcessGroup=true; stopping this poller does not terminate detached CPE work. Browser closure has no process ownership. Mac sleep makes presence stale/offline after 45 seconds; no physical sleep/reboot or hours-long soak test was performed. Raw output remains bounded/private; public queue responses receive fixed summaries.

## 7. START_RUN PROOF

Command `be226fee-5205-41a0-9c14-ec3cc4cc19a6`; key `40c00947-7d4d-45a1-9ea3-34f7bd975103`.
QUEUED 07:36:38.571 → CLAIMED 07:36:40.813 → RUNNING 07:36:41.365 → SUCCEEDED 07:38:40.561. Completion acknowledgment includes the deliberate poller outage.

Execution `c787dea8-b486-43e0-bd86-388fc8a65886`; supervisor 8993; child tsx wrapper 8995; actual orchestrator process 8996. Mapping invokes the official `dashboard/scripts/creative-studio-orchestrator.ts` entrypoint through its installed tsx loader, with `run --project bridge-disposable-pass2 --mode CLEAN_ROOM --allow-sources bridge-disposable-pass2 --build-target static-single-file`. This is the same entrypoint used by the official npm script, with fixed arguments and shell:false.

CPE created run `2aa4b130-5f9b-414b-8e40-ee576c75352a` at 07:36:45.172738. Real agents produced intelligence, concepts and a concept review, then reached AWAITING_DIRECTION_APPROVAL. CPE emitted RUN_CREATED, AGENT_INVOKED, AGENT_SUCCEEDED, ARTIFACT_VALIDATED, STAGE_ADVANCED and GATE_REACHED. Duplicate requests before and after completion returned the same command; SQLite count 1 and independent run count 1 confirm no second orchestration.

## 8. LIVE STUDIO OBSERVATION

The hosted browser rendered the real project and bridge controls. Final independently observed state:

- Project: Bridge Disposable Pass 2, slug `bridge-disposable-pass2`, ID `5831d3a0-3205-4b7a-a141-d57bfc2c1782`.
- Stage: AWAITING_BUILD_APPROVAL.
- Run: `2aa4b130-5f9b-414b-8e40-ee576c75352a`, AWAITING_HUMAN_APPROVAL.
- Responsible-agent source field: null; not fabricated. Last real agent from AGENT_INVOKED: `critic-learning-director`, displayed separately.
- Latest events: RUN_LOCK_RELEASED at 07:46:13.606023; GATE_REACHED at 07:46:13.228221; STAGE_ADVANCED from EXPERIENCE_REVIEW to AWAITING_BUILD_APPROVAL at 07:46:13.101130.
- One approved direction record; build gate remains pending and disabled.
- Readiness: not-ready; CLIENT_READY=false; zero current recorded readiness reasons; iteration counter 0.
- Factory: ONLINE from authenticated Mac heartbeat. OFFLINE was also rendered during the disconnection test.

There is no fabricated QA pass: this run has not reached production QA. Project/run/gate differences before resume were preserved as CPE state; cleared project gates are no longer projected as pending just because the run has not reconciled yet.

## 9. APPROVAL FENCING

The strict request includes literal project slug, UUID run ID, expected stage, approval type, requested gate and UUID idempotency key. Only AWAITING_DIRECTION_APPROVAL is accepted as approval type/gate. The runner revalidates the schema, reads the exact authorized project and latest run, rejects archived/missing projects, rejects an active lock held by another owner, verifies run identity and project stage, matches run.current_stage and human_gate, requires AWAITING_HUMAN_APPROVAL and checks for an existing authoritative approval.

It then acquires the existing CPE run lock through the official CPE data-access module, re-reads those fences immediately before approval, invokes the official approval CLI and releases its own lock. The queue admits only one active real command; semantic uniqueness prevents a duplicate gate action across different request IDs. No generic browser 'approve current thing' payload exists.

This is a cooperating-bridge fence, not a new transactional approval API inside CPE. The legacy approval CLI itself does not take expected-run/stage arguments and has nontransactional internal writes. Competing manual writers that bypass the CPE lock are a BLOCKING concern before broad production control. No such competing writer targeted this disposable project during acceptance.

## 10. APPROVE_GATE PROOF

Successful command `8aa99db4-47fb-4209-8b35-472aa2c7903d`; key `9714895a-b61e-43e5-a5b9-da41e6fa3e2b`.
Run `2aa4b130-5f9b-414b-8e40-ee576c75352a`; expected stage, approval type and requested gate all AWAITING_DIRECTION_APPROVAL.
QUEUED 07:42:35.486 → CLAIMED 07:42:36.961 → RUNNING 07:42:37.641 → SUCCEEDED 07:42:44.760.
Execution `7942cb78-61e5-4bb5-a57d-9ad4c002b89f`; approval subprocess PID 9619; execution count 1.

Mapping: existing `command.sh creative-studio approve --project bridge-disposable-pass2 --note <fixed disposable authorization note>`, inside the verified CPE run lock. Approval row `65965688-9aa9-45b7-afa4-7ea582144a0f` was recorded at 07:42:40.649149, action_type `creative-studio:AWAITING_DIRECTION_APPROVAL:bridge-disposable-pass2`. The project moved to EXPERIENCE_DESIGN. Independent queries after duplicate tests still found exactly one approval.

Stale-run job `3fbce124-fc53-42ad-8272-8ef3b689ec6a` and stale-stage job `5478334f-79c6-4c5e-a0cd-bf8c5a2c74c3` ended FAILED/FENCE_REJECTED, each with zero CPE executions. The project gate stayed unchanged.

Initial valid attempt `ee843b38-c2b3-46d4-a1e3-348105bc3210` also failed before CPE invocation because the lock module's @/ import alias used the wrong tsx config. The supervisor now loads the isolated dashboard tsconfig; a read-only module-load check passed. A new explicit request was allowed only after the old result proved FENCE_REJECTED and executionCount=0. The old failed record remains immutable. Executed or uncertain work never becomes eligible for this correction path.

## 11. RESUME_RUN PROOF

Command `0fe2be2b-8571-4ed9-8b1c-e697c963a009`; key `b422cf37-cad0-4599-9630-5cc087829c8b`.
QUEUED 07:43:46.161 → CLAIMED 07:43:48.614 → RUNNING 07:43:49.182 → SUCCEEDED 07:46:15.588.
Execution `63d3e97c-553b-4d10-acea-587877243b8f`; supervisor 9744; tsx wrapper 9745; orchestrator 9746. Attempt and execution count both 1.

Mapping: same official orchestrator entrypoint, `run-resume` instead of `run`, same literal project and fixed clean-room arguments. Runner requires the same run, project stage EXPERIENCE_DESIGN and an approved direction transition. The official engine reconciled the gate, emitted GATE_APPROVED at 07:43:53.563733, invoked Experience Designer and Critic, then advanced to AWAITING_BUILD_APPROVAL. No new run was created. Duplicate same-key and new-key requests returned the existing completed job.

## 12. CANCEL / PAUSE STATUS

canCancelRun=false. CANCEL_RUN is rejected; no process interruption or cancellation reconciliation was attempted. Real queued commands cannot use the mock-only transport cancellation endpoint either.

canPauseRun=false. PAUSE_RUN is unsupported and rejected. No pause semantics were invented. The natural build approval gate is left closed.

## 13. ARTIFACT TRANSPORT

Source CPE artifact ID `5ac31b23-b48b-4f6f-92ce-d997b1e31988`, type creative_intelligence_pack, authored by the real Studio Director execution. Publication object ID `fcb86cba-ce80-4da1-b74c-15601314754e`; private R2 key `bridge-real/fcb86cba-ce80-4da1-b74c-15601314754e`.

MIME application/json; 1,081 bytes; SHA-256 `03fb2718e61774f653f1e28aac052d30e11bedf09aa9c1b09b4b63a9fe5a051d`.

Preview: `/api/bridge/artifacts/fcb86cba-ce80-4da1-b74c-15601314754e`.
Download: same path with `?download=1`.

Runner resolves source realpath inside the exact isolated disposable directory, rejects symlink-root escape, bounds size, checks JSON/content and computes the hash. Worker re-verifies authoritative project/artifact ownership, MIME, size, safe content and hash. Existing source publication is immutable and deduplicated. Browser URLs require Studio authentication on every request, use private/no-store, nosniff and sandbox CSP. URLs are not expiring bearer URLs; access depends on current authentication.

The hosted UI rendered the artifact, opened its JSON preview in a browser tab and downloaded it. Download bytes and hash matched. No original local path was sent to the browser. Thumbnail is not applicable to this JSON artifact. No Eagle Wings artifact was read for upload or uploaded. Only one disposable artifact is auto-published; this is not general artifact synchronization.

## 14. CAPABILITIES

Capabilities are intentionally scoped. Broad DevLabStudioAdapter direct mutations remain DISABLED. Proven real queue flags live at BridgeSnapshot.real.capabilities and carry the exact disposable slug. They do not grant production control on other projects. Acceptance admission and proven capabilities are separate settings; each proof flag was promoted only after its real evidence.

| Capability | Final state |
|---|---|
| canReadProjects | REAL |
| canReadStages | REAL |
| canReadAgents | REAL; source attribution preserved |
| canReadRuns | REAL |
| canReadEvents | REAL; bounded polling |
| canReadIterations | REAL; empty rows are not invented |
| canReadApprovals | REAL |
| canReadQA | REAL reads; this disposable run has not reached QA |
| canReadReadiness / CLIENT_READY | REAL |
| canReadArtifacts | REAL metadata; one private disposable JSON transport |
| canCreateProject | REAL in scoped bridge; direct adapter DISABLED |
| canStartRun | REAL in scoped bridge; direct adapter DISABLED |
| canResumeRun | REAL for direction-approved disposable run; direct adapter DISABLED |
| canApprove | REAL for disposable direction gate; direct adapter DISABLED |
| canPauseRun | UNSUPPORTED / false |
| canCancelRun | DISABLED / false |
| canStreamEvents | UNSUPPORTED / false; polling is not streaming |
| canControlAgents | DISABLED / false |
| canReadLibrary | UNSUPPORTED in Dev Lab adapter |
| canArchiveProject | DISABLED |
| canUpdateContext | DISABLED |
| canUploadMedia | DISABLED; runner artifact publication is a separate permission |
| canAdvanceDemo | DISABLED in Dev Lab; MOCK in demo adapter |

The MockStudioAdapter and mock bridge commands remain MOCK; the demo workflow passed unchanged. Final proven queue flags: create/start/resume/approve=true; pause/cancel=false, scoped to bridge-disposable-pass2.

## 15. FAILURE TESTS

| Required case | Observed result |
|---|---|
| A. Unauthorized real target | PASS: Worker 400; runner/unit fences reject; no job or CPE command |
| B. Duplicate create | PASS: same job for same/new keys; one project, execution count 1 |
| C. Duplicate start | PASS: same job; one run and orchestrator execution |
| D. Stale stage/run approval | PASS: two FAILED/FENCE_REJECTED jobs, zero CPE executions |
| E. Duplicate approval | PASS: same job; exactly one authoritative approval |
| F. Duplicate resume | PASS: same job, same run; execution count 1 |
| G. Disconnected queued job | PASS: CREATE stayed QUEUED until runner returned |
| H. Disconnected running job | PASS: >68-second disconnect, same supervisor/identity, no replay |

Additional tests cover owner/runner separation, anonymous access, cross-origin requests, shell/cwd/extra payload rejection, disabled cancel/pause, stale claim tokens, incompatible execution IDs, uncertain crash gaps, artifact ownership/hash/content/authentication and bounded mock failure/retry. Mock fail-once recovered on attempt 2; always-fail stopped at attempt 3.

## 16. SECURITY

Sites access remains Hudson plus the existing Annie viewer grant. Owner authentication is required for commands; runner authentication is separate and cannot submit browser commands/read CPE UI data. Operator acceptance credentials remain private. Worker and runner enforce the literal project and strict payload schema. CPE executables/cwd/argv come from local fixed code, shell:false; no arbitrary execution interface exists.

Hosted probes: anonymous 401; platform token without app identity 401; runner submitting a command 403; owner calling runner claim 403; cross-origin mutation 403. Unauthorized projects/SHELL/PAUSE/CANCEL returned 400. Unit tests cover viewer write rejection and executable/cwd injection. Private artifact responses reject anonymous requests.

Dispatch replay is prevented by requested-by/idempotency uniqueness, real semantic uniqueness, atomic claim, claim tokens, immutable execution ID and local journal. REAL executions do not automatically retry. Secrets are server/local only; exact secret-value scans found zero leaks in checked source/client output. Public results contain fixed summaries, while bounded redacted process output remains private. An early create response exposed relative CLI guidance; that was corrected before START by withholding raw output, including old stored results. Final API probes found no local paths or command guidance.

No public inbound Mac port was opened. lsof found no TCP listening socket on the observed runner/supervisor/child PIDs. All bridge network communication is outbound HTTPS. No ngrok or tunnel was created. Service-role credentials remain broader than ideal and are a production-hardening concern, not browser credentials.

## 17. EXACT FILES CHANGED

Studio repo `/Users/hudsonmyung/Desktop/Dev Lab`, branch master → origin/main: **35 tracked files: 12 created, 23 modified, 0 deleted**, relative to Pass 1 commit.

Created:

- `docs/STUDIO_LIVE_INTEGRATION_PASS_2_REPORT.md`
- `docs/evidence/pass2-acceptance.json`
- `drizzle/0002_reflective_slipstream.sql`
- `drizzle/meta/0002_snapshot.json`
- `lib/bridge/cpe-fence.server.ts`
- `runner/artifacts.ts`
- `runner/real-task.ts`
- `runner/supervision.ts`
- `server/bridge-artifacts.ts`
- `tests/bridge-real-hosted.e2e.mjs`
- `tests/bridge-real.test.ts`
- `tests/helpers/bridge-env.ts`

Modified:

- `.env.example`
- `README.md`
- `db/schema.ts`
- `docs/DEVLAB_STUDIO_ADAPTER.md`
- `drizzle/meta/_journal.json`
- `lib/bridge/types.ts`
- `lib/bridge/validation.server.ts`
- `lib/studio-adapter/devlab.server.ts`
- `lib/studio-adapter/index.server.ts`
- `lib/studio-adapter/types.ts`
- `package.json`
- `runner/README.md`
- `runner/executors.ts`
- `runner/index.ts`
- `server/bridge-api.ts`
- `server/bridge-auth.ts`
- `server/bridge-queue.ts`
- `server/hosted-storage.ts`
- `server/worker.ts`
- `src/App.tsx`
- `src/components/Bridge.tsx`
- `src/components/ProjectPage.tsx`
- `tests/bridge.test.ts`

Deleted: none.

AI_COMMAND_CENTER-bridge, branch codex/studio-bridge: **0 tracked source files created, modified or deleted**. No factory commit or merge was needed. Official CPE produced untracked files under outputs/dev-lab/client-projects/bridge-disposable-pass2 and outputs/dev-lab/runtime-executions. Isolated dashboard dependencies and ignored .env.local were installed/configured locally.

Outside Git: existing LaunchAgent modified to explicit REAL disposable mode plus AbandonProcessGroup; private runner config/journal/task receipts and verification evidence updated. No live factory file was edited by this work.

## 18. DATABASE / INFRASTRUCTURE

- CREATED and APPLIED LIVE: D1 migration `drizzle/0002_reflective_slipstream.sql`.
- CREATED: bridge_artifacts publication table and unique source-artifact index.
- MODIFIED: bridge_commands adds semantic_key, execution_id, process_id, progress_at and unique semantic index.
- UNCHANGED: studio_state authority/demo semantics; bridge_runners schema; DB and BUCKET Worker bindings.
- CREATED: one private R2 disposable artifact object; existing mock artifact transport preserved.
- UNCHANGED: Supabase schema, RLS, grants, functions and migrations. No Supabase migration applied.
- CREATED THROUGH OFFICIAL CPE: one disposable project, one production run, one direction approval, real events/artifacts. No D1 copy of production state.
- CREATED: isolated factory worktree, branch codex/studio-bridge, from origin/main.
- MODIFIED: Sites read slug allowlist, acceptance/proven command settings; final environment revision 6. Existing secrets/access audience retained.
- MODIFIED: local runner config and LaunchAgent. No tunnel, new public port or external hosting service.

## 19. ENVIRONMENT CONFIGURATION

Names only; no secret values:

| Variable/config key | Where | Configured |
|---|---|---|
| DEVLAB_ADAPTER_MODE | Worker | YES |
| DEVLAB_READ_PROJECT_SLUGS | Worker | YES |
| DEVLAB_SUPABASE_URL | Worker | YES |
| DEVLAB_SUPABASE_SERVICE_ROLE_KEY | Worker secret | YES |
| BRIDGE_OWNER_EMAIL | Worker | YES |
| BRIDGE_VIEWER_EMAILS | Worker | YES |
| BRIDGE_RUNNER_ID | Worker | YES |
| BRIDGE_RUNNER_TOKEN | Worker secret / private runner JSON | YES |
| BRIDGE_OPERATOR_TOKEN | Worker secret / private test JSON | YES |
| BRIDGE_REAL_COMMANDS | Worker acceptance admission | YES |
| BRIDGE_PROVEN_COMMANDS | Worker scoped proof flags | YES |
| BRIDGE_CONFIG | LaunchAgent | YES |
| BRIDGE_EXECUTOR_MODE | LaunchAgent; code default MOCK | YES, explicitly REAL for this pass |
| NEXT_PUBLIC_SUPABASE_URL | Isolated factory server environment | YES |
| SUPABASE_SERVICE_ROLE_KEY | Isolated factory private environment | YES |
| CREATIVE_STUDIO_AGENT_PROVIDER | Isolated CPE / fixed child environment | YES |
| TSX_TSCONFIG_PATH | Detached supervisor child environment | YES, fixed isolated dashboard config |
| PATH, HOME, USER, LANG, TMPDIR | Selected local process environment | YES where available |
| origin, runnerId, runnerToken, siteToken, mode, realProject, journal | Private runner JSON | YES |

No new model API key was introduced. CPE used its existing authenticated Codex provider. DEVLAB_ROOT and DEVLAB_API_URL are not required for this fixed local path. Local development still defaults to mock. Keep the private runner/worker credentials out of browser code and Git.

## 20. TEST RESULTS

Studio commands and actual results:

| Command | Result |
|---|---|
| npm run lint | PASS — client/server import boundary; this repo does not use ESLint for this script |
| npm run typecheck | PASS — tsc, zero errors |
| npm test | 46 tests; 46 passed; 0 failed/cancelled/skipped/todo |
| npm run build | PASS — tsc + Vite |
| npm run build:hosted | PASS — Worker/static output and migrations packaged |
| npm run test:e2e | PASS — full demo reference/intake/upload/pause/resume/feedback/approval/QA/completion/archive, mobile/previews/download/API validation |
| npm run test:bridge:hosted | PASS — all 3 mock scenarios, duplicate, invalid command, heartbeat, private synthetic artifact and Eagle Wings GET-only observation |
| node tests/bridge-real-hosted.e2e.mjs create/start/stale/approve/resume/duplicates/probes/status/artifact | PASS — separately invoked phases; 4 successful real operations, 2 intended stale rejections, 8 completed-request duplicate probes, 7 invalid target/type probes, live UI observation and artifact preview/download |
| git diff --check | PASS |
| Private security script | PASS — 5 hosted authentication/origin probes; API path check; no inbound listener |
| Exact credential scan | PASS — 0 leaks across 84 checked source/client files at the recorded scan |

Browser proof recorded zero page errors. Final build outputs: JS 326.40 kB (gzip 102.32 kB), CSS 49.71 kB (gzip 10.88 kB). No warnings were emitted in the successful final unit/typecheck/build runs. The initial valid approval's loader failure was real and corrected; it is not omitted from the evidence. One immediate launchctl bootstrap attempt returned exit 5 while bootout was still completing; retry after confirming the service had unloaded succeeded. Sites propagation briefly served the preceding Worker after deployment; no unsafe execution resulted.

Isolated factory: `npm ci --ignore-scripts` installed 414 packages, audit 0 vulnerabilities. `node --import tsx --conditions=react-server --test lib/creative-studio/orchestrator/__tests__/orchestrator.test.ts` passed 49/49, 0 failed/skipped/cancelled. The official lock module was loaded with the isolated tsconfig without calling a DB operation. No factory source changed, so a full factory lint/typecheck/build was not required or run. No tests/builds were run in the live factory tree.

## 21. PERFORMANCE

Measured samples, not benchmarks:

| Operation | Browser submit | Queue → claim | Queue → terminal result |
|---|---:|---:|---:|
| CREATE_PROJECT | 554 ms | 23,768 ms, deliberately offline | 29,049 ms |
| START_RUN | 559 ms | 2,242 ms | 121,990 ms, including disconnect/recovery |
| APPROVE_GATE | 610 ms | 1,475 ms | 9,274 ms |
| RESUME_RUN | 742 ms | 2,453 ms | 149,427 ms |

START submission to authoritative CPE run creation: approximately 6,602 ms. Approval submission to authoritative approval timestamp: approximately 5,163 ms. Final Studio project read sample: 899 ms. Final artifact retrieval sample: 553 ms. First source-artifact record to runner publication acknowledgment: approximately 5,536 ms, including polling and transport. Isolated upload-network latency, heartbeat latency, hours-long behavior and physical sleep/reboot recovery: NOT MEASURED.

## 22. CONCURRENCY SAFETY

All factory execution used `/Users/hudsonmyung/AI_COMMAND_CENTER-bridge`, branch codex/studio-bridge. Its source HEAD remained `6e781aaca1bae409aa11f66baa191fa6af2b15f8`; tracked source diff is empty. The live `/Users/hudsonmyung/AI_COMMAND_CENTER` main HEAD is unchanged. All five pre-existing modified tracked files retained their exact SHA-256 hashes, and the live Git status inventory remained the same.

Zero Eagle Wings mutation commands were issued. No Eagle Wings DB records or artifacts were changed/uploaded by this work. No live factory or Claude process was killed or restarted. Only the bridge polling LaunchAgent was stopped/restarted; its own detached disposable process continued. Git fetch/worktree metadata operations and read-only inspection did not edit the live working tree. Eagle Wings was observed only through the existing GET path. No bridge worktree merge occurred.

## 23. WHAT IS REAL NOW

- Official CPE project creation, run launch, direction approval and resume from hosted controls.
- Durable authenticated Worker queue and outbound Mac execution with persistent identities.
- Real CPE agents and artifacts; no fabricated model result or manual run launch substituted.
- Authoritative project/run/event/gate/readiness observation, including both human gates reached.
- Online/offline heartbeat and restart reconciliation without duplicate execution.
- Private real artifact preview/download with matching source hash.
- Independent project/run/approval counts and completed-request duplicate proof.

## 24. WHAT REMAINS DISABLED

- All real commands for every project except bridge-disposable-pass2.
- Build/final gate approval; broad production enablement.
- PAUSE, CANCEL, arbitrary commands/executables/cwd and direct agent control.
- Generic DevLab adapter mutation methods and whole-app saves.
- Eagle Wings artifact upload or real control.
- General media synchronization, Dev Lab design library and event streaming.
- Automatic replay of uncertain execution or automatic retry after a CPE invocation.

## 25. KNOWN LIMITATIONS

| Limitation | Rating |
|---|---|
| Legacy approval CLI does not atomically compare run/stage and write approval; manual writers can bypass its cooperating lock | BLOCKING NEXT PASS for broad production |
| No proven cancellation/process-tree cleanup/reconciliation | BLOCKING NEXT PASS if cancellation is required |
| Service-role key has broad DB privileges; reduce scope and audit production authorization before broad control | BLOCKING NEXT PASS for removing disposable fence |
| Uncertain execution blocks real dispatch and needs a reviewed reconciliation tool | BLOCKING NEXT PASS for unattended production |
| Only direction approval and its first resume are implemented/proven | BLOCKING NEXT PASS for other gates |
| Mac must remain awake/logged in/network-connected; no physical sleep/reboot/hours-long soak proof | NON-BLOCKING for this disposable pass; production validation required |
| Agent quality/production QA/CLIENT_READY not completed; run intentionally stops at build approval | NON-BLOCKING for this control acceptance |
| One JSON artifact auto-published, no general versioned artifact sync or thumbnails | FUTURE |
| Queue history/event reads are bounded; old records need retention/pagination | FUTURE |
| Polling latency and service log rotation/credential rotation need operational policy | FUTURE |
| Annie interactive browser login was not exercised this pass; existing access grant preserved and viewer policy unit-tested | NON-BLOCKING |
| Runner supervision is fail-closed, not a general process manager or exactly-once transactional CPE engine | NON-BLOCKING for disposable scope; do not overstate guarantees |

## 26. PRODUCTION ENABLEMENT READINESS

**NO.** It is not safe to remove the disposable-only fence. This pass proves one creation, one initial run, one direction approval and one resume, with real restart/idempotency evidence. It does not prove competing-writer-safe transactional approval, broad project authorization, safe cancellation, later gates, production artifact handling or unattended recovery. The existing CPE authority and disposable fence remain intact.

## 27. NEXT RECOMMENDED PASS

Keep AWAITING_BUILD_APPROVAL closed. The smallest next step is an isolated CPE-side review and test of atomic expected-run/stage approval semantics, including a competing-writer rejection test, before enabling another gate. After Hudson reviews that result, separately plan least-privilege credentials and manual uncertain-job reconciliation. Do not remove the project fence or enable all commands at once.

## 28. FINAL ACCEPTANCE CHECKLIST

- PASS — Real CREATE_PROJECT from hosted Studio.
- PASS — Duplicate create prevented.
- PASS — Real START_RUN.
- PASS — Duplicate start prevented.
- PASS — Real production state observed.
- PASS — Real approval fenced by exact identity/stage/gate and cooperating CPE lock.
- PASS — Real approval executed exactly once.
- PASS — Real RESUME_RUN.
- PASS — Duplicate resume prevented.
- PASS — Real artifact delivered safely.
- PASS — Runner long-job supervision proven beyond previous 120-second timeout.
- PASS — Runner restart uncertainty handled without automatic replay.
- PASS — No arbitrary shell execution through the bridge interface.
- PASS — No inbound public Mac port.
- PASS — Final browser/API output has no secrets/local paths; raw CLI guidance corrected.
- PASS — Eagle Wings untouched.
- PASS — PAUSE remains disabled.
- PASS — CANCEL remains disabled.

**PASS 2 COMPLETE — DISPOSABLE REAL CONTROL PROVEN**

## 29. FINAL SHORT SUMMARY

WHAT WORKS NOW:

- Real create/start/direction-approval/resume through hosted Studio for one disposable project.
- Authoritative live CPE observation and honest heartbeat presence.
- Durable queue, semantic idempotency, private execution journal and supervised process continuation.
- Stale approval rejection and exactly one real direction approval.
- Authenticated real artifact preview/download with matching SHA-256.

WHAT REMAINS DISABLED:

- Every other project's real controls.
- Build/final approvals and broad production enablement.
- Pause, cancellation and arbitrary execution.
- Automatic uncertain-work replay and generic CPE state saves.
- Eagle Wings artifact transport and general media synchronization.

NEXT SAFE STEP:

Review atomic expected-run/stage approval semantics in the isolated bridge worktree, with the disposable build gate left closed.
