# STUDIO LIVE INTEGRATION — PASS 3
# PRODUCTION CONTROL HARDENING REPORT

**PASS 3 INCOMPLETE — KEEP PRODUCTION FENCE**

## 1. Executive verdict

Atomic approvals, hosted build approval, same-run resume, scoped hosted reads, reconciliation reporting, and private report previews are real and tested. The disposable run reached IMPLEMENTATION and stopped honestly at REVISION_REQUIRED because its authoritative implementation definition is absent. It did not execute an implementation agent, reach technical validation, or become CLIENT_READY. Final approval semantics were proven on clearly marked temporary CPE fixtures and the fixtures were removed. Normal project control remains disabled: the shared CPE database has pre-existing anonymous write grants on tables with RLS disabled, and normal-project provisioning/authorization and full production recovery still need proof.

| Question | Result |
|---|---|
| Hosted real CPE observation | REAL |
| Atomic build approval | REAL |
| Resume same disposable run | REAL |
| Implementation/technical validation completion | PARTIAL — blocked before implementation work |
| Final approval | REAL — TEST_FIXTURE only |
| Private JSON + rendered HTML/PNG report delivery | REAL |
| Original implemented-site screenshot/HTML | DISABLED — no such output exists yet |
| Normal-project control | DISABLED |
| Cancel / pause | DISABLED / UNSUPPORTED |

Live site: https://hudson-dev-lab.hudsonmyung.chatgpt.site/bridge

## 2. Starting state

- Studio: `/Users/hudsonmyung/Desktop/Dev Lab`, branch `master` tracking GitHub `origin/main`, starting commit `c62943cacee1c9962e2ccbc61b65339d8c274b34`.
- React 19, React Router 7, TypeScript 5.9, Vite 7; Express local development, Cloudflare Worker hosted API, D1 command transport/demo persistence, private R2 artifacts.
- Hosted version 14, environment revision 6, custom audience preserved (Hudson owner, existing Annie viewer access).
- Outbound REAL runner `hudson-mac-shadow`, LaunchAgent `com.hudson.studio-bridge-shadow`, disposable-only controls, durable local SQLite journal and detached command supervisors already existed.
- Factory bridge: `/Users/hudsonmyung/AI_COMMAND_CENTER-bridge`, `codex/studio-bridge`, based on `6e781aaca1bae409aa11f66baa191fa6af2b15f8`. No tracked bridge changes at start; generated Pass 2 output directories existed.
- Live factory: `/Users/hudsonmyung/AI_COMMAND_CENTER`, same main HEAD with five pre-existing modified tracked files. No live working-tree writes were made by this pass.
- Disposable project `5831d3a0-3205-4b7a-a141-d57bfc2c1782`; run `2aa4b130-5f9b-414b-8e40-ee576c75352a`; stage AWAITING_BUILD_APPROVAL; status AWAITING_HUMAN_APPROVAL; CLIENT_READY=false.

## 3. Atomic approval architecture — REAL

```text
Hosted owner action → authenticated Worker → durable D1 command
← outbound Mac runner → fixed command.sh arguments in bridge worktree
→ public.studio_approve_gate (invoker wrapper)
→ studio_private.approve (dedicated non-login executor)
→ authoritative CPE project + shared approval + CPE approval receipt
→ existing CPE run-resume reconciliation → Studio read adapter
```

The operation requires project slug, CPE run ID, expected stage, approval type, and approved-by identity. Supported gates are direction, build, and final. Final approval additionally requires authoritative CLIENT_READY=true. CPE remains the lifecycle owner; D1 stores transport status, not a parallel production state machine.

## 4. Database transaction semantics — REAL

The RPC locks the project row FOR UPDATE, locks its explicit authorization row FOR SHARE, then locks the latest CPE production run FOR UPDATE. It verifies project authorization, current run identity, CLEAN_ROOM mode, stage, gate, approval type, human-approval status, and final readiness. A unique `(project_id, run_id, expected_stage)` receipt prevents duplicate approvals. The shared approval and project transition are written in that same transaction; direction materialization is transactional too.

The shared `approvals.run_id` references the older `runs` table, not CPE production runs. The new CPE receipt stores the correct CPE run relationship without corrupting that foreign key. Identical same-actor retries return the existing receipt; another actor's stale request receives HTTP 409. Business conflicts use PT409 rather than SQL serialization code 40001, which caused retry/time-out behavior during initial testing and was corrected.

Database triggers reject legacy project gate transitions, approval inserts, and direction-artifact inserts for enrolled disposable projects unless performed by the non-login atomic executor. They do not rely on the runner's cooperative lock. The temporary executor membership needed for function ownership changes was revoked. Existing non-enrolled projects retain their legacy path; broad promotion is not enabled.

## 5. Competing-writer proof — REAL

Live database evidence, not an in-memory substitute:

| Scenario | Observed result |
|---|---|
| Two identical direction requests race | One new receipt/approval; one duplicate response; identical approval ID |
| Stale expected stage | HTTP 409 STALE_STAGE_OR_GATE |
| Stale run ID | HTTP 409 STALE_RUN |
| Run state changes after preflight read | HTTP 409; no approval |
| Competing writer advances project from build gate to IMPLEMENTATION | Original actor rejected with STALE_GATE_APPROVED_BY_ANOTHER_WRITER |
| Already-approved gate, same actor | Existing receipt returned; no additional approval |
| Legacy manual CLI competes with atomic request | Legacy writer rejected; one build approval |
| Final approval before CLIENT_READY | HTTP 409 CLIENT_READY_REQUIRED |
| Two final approvals race on final RPC revision | One new approval, one duplicate response |

The first fixture used project `f016ddf3-3a62-4e26-b943-6ea26b05825f`, run `db5ac26a-b11d-4129-a940-775c62549ef9`. The second used project `1d2feb45-e7e6-48ea-8b85-ce526df2a254`, run `d2015094-317f-4a67-8a3a-aabd7396ad3f`. Both were named TEST_FIXTURE, used slug `bridge-disposable-pass3`, and were deleted after their proofs. Final checks found zero fixture projects and zero fixture approval rows.

## 6. Direction approval regression — REAL, fixture regression

The direction race produced exactly one approval `bee17518-ccd5-439a-9ffa-a6b88f83a926` and a transactional creative-direction artifact. The existing real disposable direction approval from Pass 2 was not repeated or changed. The isolated legacy CLI now requires explicit atomic flags for the disposable slugs before it can perform any artifact side effect. Other projects retain CLI compatibility; the live factory CLI was not edited.

## 7. Hosted build approval proof — REAL

- UI: **Approve Build**, clicked on the hosted Studio.
- Command: `395029bf-eff3-4abf-8a5c-4a85b88642ca`.
- Idempotency key: `338736e3-36c5-4fed-b738-862e6cc8c2ae`.
- Runner: `hudson-mac-shadow`; execution `66dd9af1-f8a9-4918-a6d6-21db0fddfc85`; child PID 21630.
- QUEUED 22:36:37.068Z → CLAIMED 22:36:38.369Z → RUNNING 22:36:38.937Z → SUCCEEDED 22:36:50.701Z, 2026-09-18 UTC.
- Attempts 1; actual invocation count 1.
- Authoritative approval `50444bf1-be57-49c3-98ee-94b5b6edd5c5`; receipt `a0e03f82-e50d-4849-9dd8-c96fb5f8fdda`.
- Project moved AWAITING_BUILD_APPROVAL → IMPLEMENTATION. The run remained at its approval gate until the explicit resume, matching existing CPE semantics.
- Same-key and new-key duplicates returned the same command before and after completion. A direct authoritative duplicate returned the same receipt with `duplicate=true`; database count remained one.

## 8. Hosted resume after build — REAL invocation; PARTIAL production progression

- UI: **Resume disposable run**, clicked on hosted Studio.
- Command `7c699e56-703d-45e4-843c-21c2e5f705e6`; key `c6c11354-d6bf-416e-9a81-861f08b6191d`.
- Execution `6024d869-49ee-492a-80c6-318599539fa7`; child PID 21732; runner `hudson-mac-shadow`.
- QUEUED 22:37:50.028Z → CLAIMED 22:37:50.557Z → RUNNING 22:37:51.165Z → SUCCEEDED 22:37:59.041Z.
- One attempt, one invocation, same original CPE run ID, total authoritative run count one. Duplicates reused the command.
- CPE emitted GATE_APPROVED, HUMAN_DECISION_REQUIRED, and RUN_LOCK_RELEASED. It recorded IMPLEMENTATION / REVISION_REQUIRED, responsible agent null, CLIENT_READY=false, and the missing implementation-definition blocker.
- The isolated CPE script now records this stop honestly before resolving a nonexistent workspace. No implementation agent ran and no technical-validation stage is claimed.
- Queue SUCCEEDED means the command completed correctly; it does **not** mean the production run completed.

## 9. Final approval proof — REAL TEST_FIXTURE, not real project readiness

The disposable website could not naturally reach CLIENT_READY without unrelated implementation work. Temporary CPE fixtures were explicitly marked TEST_FIXTURE. A final request failed while CLIENT_READY=false; after fixture-only readiness setup, atomic final approval moved the project to COMPLETE. The existing official CPE run-resume reconciler then set FINAL_APPROVED and emitted its normal gate event. This was performed twice, including a final-stage concurrency race against the final RPC revision.

Final race approval: `046758d4-2e4f-469a-b7ef-b2c0a2069375`; one creation and one duplicate. Both fixture runs reached FINAL_APPROVED before cleanup. This proves final-gate transaction semantics, not production-quality readiness. The real `bridge-disposable-pass2` remains CLIENT_READY=false.

## 10. Least-privilege read credential — REAL narrow replacement

The hosted service-role secret was removed. `DEVLAB_READ_TOKEN` authenticates a dedicated `studio-read` Supabase function, which calls only the fixed `studio_read_rows` interface. Tokens are SHA-256 hashed in a private, RLS-protected table, project-scoped, revocable, and expire after 90 days. The Worker receives neither a service-role key nor the existing anonymous Supabase credential.

The read RPC uses a dedicated non-login SELECT-only executor, explicit table/column lists, bounded limits, fixed query operators, and project ownership filters. PostgreSQL privilege checks confirmed SELECT=true, INSERT/UPDATE/DELETE=false, and that the API authenticator cannot assume this executor role. Anonymous callers cannot execute atomic approvals. The function uses custom token authentication (`verify_jwt=false`) and rejects absent/wrong tokens; it is not an unauthenticated read endpoint.

Seven live negative probes passed: missing token, invalid token, write HTTP method, arbitrary table, filesystem-path column, arbitrary operator, and approval endpoint. An out-of-scope fixture query returned zero rows. This is the narrow alternative to giving the hosted Worker a broadly privileged database credential.

**Remaining issue:** existing CPE project/run tables have anonymous-role write grants with RLS disabled. This pass did not change those shared permissions while the factory was active. Security-advisor results retain 52 RLS-disabled-table findings, four pre-existing definer views, and eight RLS-without-policy findings across the shared project. No new inactive-policy warning remains. See [Supabase RLS remediation](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

## 11. Uncertain-job reconciliation — REAL classification, PARTIAL operational recovery

The runner reads the durable task intent and completion receipt, hashes kernel PID/start-time/command identity, reads the authoritative CPE run and latest events, and inspects the original claimed queue record. It reports all five requested classifications to D1 and Studio:

- STILL_RUNNING: matching live process and running command.
- COMPLETED_SUCCESS / COMPLETED_FAILURE: matching completion receipt and authoritative execution context.
- SAFE_TO_RETRY: proven zero-execution preflight rejection, or never-dispatched queued/claimed evidence.
- MANUAL_REVIEW_REQUIRED: missing, stale, conflicting, or unavailable evidence.

Classification never changes CPE lifecycle state or automatically launches work. Completion delivery requires the original claim, runner, and execution ID. Unknown work remains durable and blocks REAL dispatch. A new explicit request is required even after SAFE_TO_RETRY; executed/uncertain requests remain deduplicated.

Controlled unit tests covered all classifications, changed run, mismatched receipt, still-live process after a supposed completion, unavailable authority, and absent intent. Live stale-run command `b13a47af-5be2-490e-862a-a7449fdbd637` recovered result delivery after a runner restart with zero CPE invocations and SAFE_TO_RETRY. Live build/resume commands reported COMPLETED_SUCCESS. A classifier ordering issue found during this test initially held that zero-execution stale-run rejection for review; it was corrected and tested without replaying the task.

There is no force-clear/replay button for uncertain executed work. Ambiguous historical execution still needs human investigation. This pass did not repeat an hours-long production run or kill an active CPE process to manufacture a recovery case.

## 12. Cancellation investigation — DISABLED; pause UNSUPPORTED

The existing `run-cancel` implementation changes the run status and records RUN_CANCELLED. It does not establish process-group identity, stop children, reconcile partial artifacts, or release the execution lock safely. Those guarantees are unproven; canCancelRun remains false and CANCEL_RUN is rejected. Pause has no genuine engine semantic and remains unsupported. No cancellation was attempted.

## 13. Artifact transport expansion — REAL transport; PARTIAL production artifact coverage

Five original disposable CPE JSON files are now privately delivered. A passive HTML report and PNG screenshot are derived from the first real report and clearly labeled as report previews. They are not fabricated implementation outputs.

| Representation | Object ID | Bytes | MIME |
|---|---|---:|---|
| Original report | fcb86cba-ce80-4da1-b74c-15601314754e | 1081 | application/json |
| Rendered report | c3fa785e-b2df-4c66-8ee4-b4555787d4a4 | 1675 | text/html |
| Report screenshot | 2776183d-9530-49d3-803d-9d31d4d8a18e | 125946 | image/png |

All three reference authoritative artifact `5ac31b23-b48b-4f6f-92ce-d997b1e31988`.

- Original SHA-256: `03fb2718e61774f653f1e28aac052d30e11bedf09aa9c1b09b4b63a9fe5a051d`.
- HTML SHA-256: `6744d5b86df5fc72125b905ff6ad7a7e8b506a56f0fe84a60b78007eaca16165`.
- PNG SHA-256: `b883ef80088ca6a714733d7aad6d85edf703e723e1f0d2d784d32c0d91a0dac2`.

R2 keys are `bridge-real/<object-id>`. Authenticated URLs are `/api/bridge/artifacts/<object-id>`, with `?download=1` for downloads and an image URL for thumbnails. Authorization is checked on every request; URLs themselves do not expire. The runner validates canonical source location, project ownership, MIME and size; the Worker independently verifies enrollment/ownership, safe bytes, MIME and SHA-256. Limit: 500,000 bytes each. HTML is passive and served under sandbox CSP, no external/script/form execution, and nosniff. A fresh non-browser probe exposed Cloudflare HTML script injection; artifact responses now set Cache-Control no-transform to preserve byte integrity ([Cloudflare guidance](https://developers.cloudflare.com/rules/configuration-rules/response-body-inspection/)). All seven preview/download hashes and byte counts passed; HTML rendered in the browser. No Eagle Wings artifact was transported.

## 14. Project authorization model — PARTIAL, explicit fence retained

The authoritative private registry records project ID, enabled state, historical denial, and clean-room requirement. Worker and runner verify a real CPE project, matching registry identity, explicit enrollment, no historical denial, and clean-room mode. Protected namespaces are denied independently. Owner authentication remains mandatory for mutations.

The single disposable fence is now an additional constraint over enrollment, not the only authorization check. Nevertheless the schema, queue, executor and atomic RPC intentionally retain disposable scope. Exactly one project is enrolled after cleanup. Normal-project provisioning, protected-alias coverage, repeated-run approval history, and normal-project acceptance are not proven. CREATE_PROJECT is currently disabled in the capability model because the existing-project enrollment policy has no new-project provisioning flow; the Pass 2 creation proof is retained as historical evidence.

## 15. Capability flags

Global DevLabStudioAdapter direct writes remain false. Proven scoped actions use the authenticated bridge queue; they do not bypass it.

| Capability | Actual state |
|---|---|
| canReadProjects | REAL / true |
| canReadStages | REAL / true |
| canReadAgents | REAL / true |
| canReadRuns | REAL / true |
| canReadEvents | REAL / true, polling |
| canReadIterations | REAL / true |
| canReadApprovals | REAL / true |
| canReadQA | REAL / true |
| canReadReadiness | REAL / true, includes CLIENT_READY |
| canReadArtifacts | REAL / true metadata; disposable private transport |
| canCreateProject | DISABLED / false in current bridge and real adapter |
| canStartRun | REAL / true only scoped bridge; false direct adapter |
| canResumeRun | REAL / true only scoped bridge; false direct adapter |
| canApprove | REAL / true only scoped bridge; false direct adapter |
| canPauseRun | UNSUPPORTED / false |
| canCancelRun | DISABLED / false |
| canStreamEvents | UNSUPPORTED / false |
| canControlAgents | UNSUPPORTED / false |
| canReadLibrary | UNSUPPORTED / false in real mode; demo still supported |
| canArchiveProject | DISABLED / false |
| canUpdateContext | DISABLED / false |
| canUploadMedia | DISABLED / false |
| canAdvanceDemo | DISABLED in real adapter; MOCK capability preserved |

Feature capability does not override stage eligibility. At the current REVISION_REQUIRED stop, ordinary start/resume/approval buttons are disabled.

## 16. UI behavior — REAL

Bridge controls now use current capabilities, explicit enrollment, owner permission, fresh online presence, pending command state, and authoritative CPE gate/stage. Direction, Build, and Final approval labels correspond to the actual gate. Start/resume are unavailable while inappropriate; offline controls were verified disabled. A failed request refreshes authoritative state. Reconciliation appears in command history. Original and rendered report artifacts are distinguished, and image thumbnails are browser-safe. Existing project detail renders the real blocker, run, events and readiness; demo workflow remains intact.

## 17. Security model — REAL safeguards, broader DB limitation retained

Preserved: authenticated Worker requests, separate runner authentication, owner-only commands, strict vocabulary, strict payloads, fixed executable/cwd/argument arrays, shell:false, exact disposable fence, enrollment, semantic/request idempotency, process identity fencing, no automatic uncertain replay, bounded mock retries, bounded private output, credential redaction, private artifact access, and server/client import checks. New atomic guards protect against noncooperative legacy approval writes for the enrolled disposable scope.

No inbound public Mac port was opened. The runner makes outbound HTTPS requests. A live lsof check found zero runner TCP listeners. Built client output was scanned for private credentials and local factory paths: ten client files, zero leaks. Shared anonymous database grants remain a separate unresolved production risk; the scoped Studio token cannot exercise them.

## 18. Failure and concurrency tests — REAL + controlled unit tests

- Four hosted stale approval requests, before and after build/resume: FAILED/FENCE_REJECTED, invocation count zero.
- Same-key/new-key build and resume duplicates: same command, one attempt and one invocation.
- Ten live approval-database proof groups across the fixture tests, including identical races, changed project/run state, actor competition and final readiness.
- Three hosted MOCK scenarios: success, transient failure recovered on attempt two, permanent failure exhausted at attempt three.
- Restarted bridge polling service with a completed zero-invocation rejection; result delivery resumed without execution replay.
- Five reconciliation classifications plus identity/authority conflict cases tested deterministically.
- Missing/wrong read token and five other read-endpoint security probes rejected; scope escape returned zero rows.
- Existing authorization, arbitrary shell, protected-project, artifact and client-boundary regressions passed.

## 19. Exact tracked files changed

STUDIO UI: 33 files relative to the starting commit; branch master. Generated private runner journals/logs and temporary test reports are not tracked source files.

**Created: 14**

- `docs/STUDIO_LIVE_INTEGRATION_PASS_3_REPORT.md`
- `docs/STUDIO_PASS_3_OPERATIONS.md`
- `docs/evidence/pass3-acceptance.json`
- `docs/evidence/pass3-atomic-approval.json`
- `docs/evidence/pass3-database.json`
- `drizzle/0003_panoramic_leech.sql`
- `drizzle/0004_curious_crystal.sql`
- `drizzle/meta/0003_snapshot.json`
- `drizzle/meta/0004_snapshot.json`
- `lib/bridge/artifact-content.server.ts`
- `lib/bridge/project-authorization.server.ts`
- `runner/reconciliation.ts`
- `tests/bridge-pass3-hosted.e2e.mjs`
- `tests/bridge-pass3.test.ts`

**Modified: 19**

- `db/schema.ts`
- `drizzle/meta/_journal.json`
- `lib/bridge/cpe-fence.server.ts`
- `lib/bridge/types.ts`
- `lib/bridge/validation.server.ts`
- `lib/studio-adapter/cpe-source.server.ts`
- `lib/studio-adapter/devlab.server.ts`
- `runner/artifacts.ts`
- `runner/executors.ts`
- `runner/index.ts`
- `runner/real-task.ts`
- `server/bridge-api.ts`
- `server/bridge-artifacts.ts`
- `server/bridge-auth.ts`
- `server/bridge-queue.ts`
- `server/worker.ts`
- `src/components/Bridge.tsx`
- `tests/bridge-real.test.ts`
- `tests/helpers/bridge-env.ts`

**Deleted: 0**

None.

AI_COMMAND_CENTER bridge: 13 files relative to clean origin/main; branch codex/studio-bridge; final factory source commit `7abf6ab0689314bd434093780b21960fbb460a20`. No merge or factory-branch push.

**Created: 11**

- `command/creativestudio/tests/test_atomic_approval.py`
- `dashboard/supabase/functions/studio-read/index.ts`
- `dashboard/supabase/migrations/20260918220859_studio_atomic_approval.sql`
- `dashboard/supabase/migrations/20260918221301_studio_approval_authorization_lock.sql`
- `dashboard/supabase/migrations/20260918221438_studio_scoped_read_transport.sql`
- `dashboard/supabase/migrations/20260918221516_studio_approval_conflict_codes.sql`
- `dashboard/supabase/migrations/20260918221803_studio_project_authorization_read.sql`
- `dashboard/supabase/migrations/20260918222544_studio_direction_artifact_guard.sql`
- `dashboard/supabase/migrations/20260918223339_studio_remove_inactive_policies.sql`
- `dashboard/supabase/migrations/20260918223840_studio_approval_actor_idempotency.sql`
- `scripts/studio-atomic-approval-proof.py`

**Modified: 2**

- `command/creativestudio/creative_studio.py`
- `dashboard/scripts/creative-studio-orchestrator.ts`

**Deleted: 0**

None.

## 20. Database, migrations and infrastructure

**Applied live:** eight additive Supabase migrations, named by the migration files above. They create the private schema, two non-login executor roles, project authorization / approval receipt / read credential tables, atomic approval/read functions, three approval-related guards, and an invoker authorization view. Follow-ups correct row-lock privilege, conflict codes and actor-aware idempotency, and remove this pass's redundant policies on existing RLS-disabled tables. New private tables have RLS. Existing shared-table grants and live project data outside the disposable scopes were not changed.

D1 migrations `0003_panoramic_leech.sql` and `0004_curious_crystal.sql` applied during hosted deployment: reconciliation/classification timestamps, artifact representation column, and representation-aware uniqueness. No CPE production snapshot was moved into D1. R2 gained six new disposable objects; the prior JSON object was reused. The fixed synthetic transport test was repeated separately.

Supabase `studio-read` function deployed with custom token authentication. One expiring hashed read token and one retained project enrollment exist. Test fixtures, their approvals, receipts and events were removed. One real atomic build receipt remains. Worker DB/BUCKET bindings and site access audience are unchanged. Environment revision changed from 6 to 7, removing the hosted service-role key and adding the read token. Acceptance ran on hosted version 15; final publication includes the follow-up capability/reconciliation hardening and this report.

## 21. Environment variables — names only

| Location | Names | Configured |
|---|---|---|
| Worker reads | DEVLAB_ADAPTER_MODE, DEVLAB_SUPABASE_URL, DEVLAB_READ_PROJECT_SLUGS, DEVLAB_READ_TOKEN | YES |
| Worker access | BRIDGE_OWNER_EMAIL, BRIDGE_VIEWER_EMAILS, BRIDGE_OPERATOR_TOKEN | YES |
| Worker runner/commands | BRIDGE_RUNNER_ID, BRIDGE_RUNNER_TOKEN, BRIDGE_REAL_COMMANDS, BRIDGE_PROVEN_COMMANDS | YES |
| Worker old broad credential | DEVLAB_SUPABASE_SERVICE_ROLE_KEY | REMOVED |
| Local runner service | BRIDGE_CONFIG, BRIDGE_EXECUTOR_MODE | YES |
| Isolated CPE runtime | NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CREATIVE_STUDIO_AGENT_PROVIDER | YES, private local configuration |
| Detached supervisor | TSX_TSCONFIG_PATH and fixed runtime path variables | YES, supplied by launcher |
| Supabase read function | SUPABASE_URL, SUPABASE_ANON_KEY | YES, platform runtime |

Runner/operator authentication and Sites bypass credentials remain in existing private local JSON files; they are not browser environment variables or tracked files. No secret values are included here.

## 22. Exact validation commands and results

Studio:

| Command | Result |
|---|---|
| npm run lint | PASS; client/server boundary check, no warnings |
| npm run typecheck | PASS; zero TypeScript errors |
| npm test | 53 tests, 53 passed, 0 failed, 0 skipped |
| npm run build | PASS; Vite client build and typecheck |
| npm run test:e2e | PASS; full demo workflow, responsive layouts, upload/download and API validation |
| npm run build:hosted | PASS; client plus Worker and generated migration packaging |
| npm run test:bridge:hosted | PASS; three hosted mock scenarios, existing read observation, no browser errors |
| node tests/bridge-pass3-hosted.e2e.mjs offline | PASS; real controls disabled |
| node tests/bridge-pass3-hosted.e2e.mjs stale | PASS before and after approval; four zero-invocation rejections |
| node tests/bridge-pass3-hosted.e2e.mjs build | PASS; actual hosted approval and duplicate proof |
| node tests/bridge-pass3-hosted.e2e.mjs resume | PASS; same run, one invocation, honest CPE blocker |
| node tests/bridge-pass3-hosted.e2e.mjs artifacts | PASS; seven hash/size/authenticated deliveries and rendered HTML |
| node tests/bridge-pass3-hosted.e2e.mjs status | PASS; actual project/run/events/readiness; no browser errors |

Factory bridge:

- `python3 -m unittest discover -s command/creativestudio/tests -v`: 4 passed, 0 failed.
- `python3 -m compileall -q command/creativestudio/creative_studio.py command/creativestudio/tests scripts/studio-atomic-approval-proof.py`: PASS.
- `node --import tsx --conditions=react-server --test --test-concurrency=1 lib/creative-studio/__tests__/*.test.ts lib/creative-studio/orchestrator/__tests__/*.test.ts`: 221 passed, 0 failed, 0 skipped.
- `npm run lint` in dashboard: PASS, no warnings.
- `npx next typegen`, followed by `npx tsc --noEmit`: PASS. The initial typecheck lacked generated LayoutProps and the edge-runtime declaration; both were corrected, with no ignored build errors.
- `./node_modules/.bin/esbuild scripts/creative-studio-orchestrator.ts --bundle --platform=node --packages=external --format=esm --outfile=/private/tmp/pass3-cpe-orchestrator.mjs`: PASS, 315.6 kB CLI bundle.
- `python3 scripts/studio-atomic-approval-proof.py`: live fixture proof passed; complementary project-writer and final-race probes passed.

A full Next.js dashboard production build was not run: no Next page/UI code changed, and that unrelated dashboard includes the protected R&T surface. The affected CPE CLI was built, and the complete dashboard was typechecked/linted. Initial test/implementation failures were corrected; final counts above are the actual passing reruns.

## 23. Performance measurements

| Measurement | Observed |
|---|---:|
| Build UI submit | 1261 ms |
| Build queue → claim | 1301 ms |
| Build UI round trip | 17516 ms |
| Resume UI submit | 1441 ms |
| Resume queue → claim | 529 ms |
| Resume UI round trip | 10728 ms |
| Hosted disposable project snapshot | 1066 ms |
| Original JSON preview + download | 1235 ms |
| HTML preview + download | 1587 ms |
| PNG preview + download | 1468 ms |

These are single acceptance samples, not benchmarks or percentiles. Artifact timings include two requests. Exact process-launch latency, database-lock duration, heartbeat latency and hours-long workload performance were NOT MEASURED in Pass 3. The isolated CPE CLI bundle completed in 12 ms in the recorded build.

## 24. Concurrency safety

All factory edits stayed in the bridge worktree. Its commits were not merged or pushed to live main. No Eagle Wings or R&T mutation, approval, resume, cancellation, artifact upload, file edit or process termination was issued. Only the dedicated Studio bridge polling service was restarted; its completed/stale transport task had no CPE invocation. Disposable CPE commands and fixture final reconciliations exited naturally.

The live main HEAD remains `6e781aaca1bae409aa11f66baa191fa6af2b15f8`; Git status has the same pre-existing paths. Four of the five dirty tracked files retained their baseline hashes. The already-modified live `dashboard/scripts/creative-studio-orchestrator.ts` changed contents during the session and differs from the bridge copy. This pass made no write to that live path, and did not revert the concurrent change. Therefore an assertion that the entire live working tree remained byte-identical would be false; the evidence records that limitation explicitly.

## 25. What is real now

- Atomic authoritative approval with expected project/run/stage/type and actor-aware idempotency.
- Database guards against legacy disposable approval writes and direction-artifact side effects.
- Hosted build approval and same-run resume; actual CPE blocker and events visible.
- Direction/build/final fixture proofs against the real database, with fixture cleanup.
- Scoped expiring hosted read credential; Worker broad credential removed.
- Durable reconciliation reporting, identity-fenced result delivery and no uncertain replay.
- Explicit authoritative project enrollment plus retained disposable fence.
- Private real JSON transport and clearly labeled HTML/PNG report previews.
- Offline/capability/gate-aware UI, passing demo workflow and security regressions.

## 26. What remains disabled or unproven

- All ordinary-project controls; no broad enablement.
- New-project creation under the new enrollment policy.
- Pause, cancel, agent control, event streaming, real library/archive/context/media mutation.
- Natural disposable implementation, technical validation and CLIENT_READY.
- Original screenshot/HTML output of an implemented disposable site.
- Force-replay/force-clear of ambiguous executed work.
- Broad shared-table permission remediation and normal-project/repeated-run approval acceptance.

## 27. Known limitations and risk ratings

| Limitation | Rating |
|---|---|
| Shared CPE anonymous-role write grants and RLS disabled | BLOCKING NORMAL PROJECT CONTROL |
| Normal-project enrollment/provisioning and repeated-run approval history unproven | BLOCKING NORMAL PROJECT CONTROL |
| Missing disposable implementation definition prevents full production progression | BLOCKING FULL PRODUCTION ACCEPTANCE |
| Original implemented-site image/HTML unavailable; current image is a report screenshot | BLOCKING FULL PRODUCTION ARTIFACT ACCEPTANCE |
| Ambiguous execution still requires human investigation; no unsafe override | NON-BLOCKING safety property; operational recovery needs further proof |
| Cancel unsafe; pause absent | NON-BLOCKING while disabled |
| Mac must stay awake, online and supervised; polling adds latency | NON-BLOCKING, operational constraint |
| 90-day read-token rotation required | NON-BLOCKING maintenance requirement |
| Artifact cap 500 KB; publication happens at runner startup and currently does not continuously sync new artifacts after success | FUTURE IMPROVEMENT before broad artifact use |
| Concurrent live orchestrator file changed outside this bridge work | NON-BLOCKING to disposable proof; prevents byte-identical live-tree claim |

## 28. Production enablement verdict

**NO. Do not remove the disposable fence.** The bridge's new approval/read boundaries are materially stronger and real disposable control worked. That does not prove safe ordinary-project operation while the shared CPE grants remain broad, provisioning/repeated-run authorization is untested, and full implementation/artifact progression has not been demonstrated.

## 29. Recommended next step

First review and test CPE table grants/RLS in an isolated database with the factory's actual service-role access pattern. Do not alter the active factory's permissions blindly. Then supply the disposable project's authoritative implementation definition, resume through Studio under the existing fence, verify real implementation/QA artifacts, and test one explicitly enrolled non-protected project only after those prerequisites pass. Keep pause/cancel off.

## 30. Final acceptance checklist

| Criterion | Result |
|---|---|
| Atomic approval transaction and authoritative expected-state checks | PASS |
| Competing-writer and duplicate proof | PASS |
| Direction regression | PASS — fixture + unchanged historical approval |
| Hosted build approval exactly once | PASS |
| Hosted resume on the same CPE run | PASS |
| Honest implementation progression | PASS to IMPLEMENTATION; blocked afterward |
| Technical validation reached | FAIL — no implementation definition |
| Final approval semantics | PASS — TEST_FIXTURE; fixtures removed |
| Least-privilege hosted read boundary | PASS |
| Shared CPE database permissions safe for normal control | FAIL |
| Five reconciliation classifications and no uncertain replay | PASS; broader operational recovery remains partial |
| Cancellation enabled only if proven | PASS — disabled |
| Pause remains unsupported | PASS |
| Private JSON/HTML/PNG report transport | PASS |
| Original production screenshot/rendered site artifact | FAIL — unavailable |
| Explicit enrollment and protected-project denial | PASS within disposable scope |
| Normal-project provisioning/control proven | FAIL — fence retained |
| Owner/runner auth, fixed shell:false execution, no browser secrets/paths | PASS |
| No public inbound Mac port | PASS |
| No bridge-issued Eagle Wings or R&T mutation/process action | PASS |
| Live main HEAD preserved; bridge not merged | PASS |
| Entire live tree byte-identical throughout | FAIL — concurrent live script change, not overwritten |

**PASS 3 INCOMPLETE — KEEP PRODUCTION FENCE**

Stopping for Hudson review.
