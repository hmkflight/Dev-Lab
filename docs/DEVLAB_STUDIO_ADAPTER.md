# Dev Lab Studio adapter — Pass 1 mapping

The authoritative engine is the existing CPE 2.0 under AI_COMMAND_CENTER. Studio does not own its lifecycle. The live working tree was inspected read-only; no engine files, production records, processes, or Eagle Wings artifacts were modified by this integration.

## Sources verified on 2026-09-18 UTC

| Studio model | Verified source | Projection |
|---|---|---|
| Project | creative_studio_projects (migration 018) | UUID, slug, client_name, project_type, current_stage, status, brief_summary, goal, timestamps; no materials_path |
| Stages | project.current_stage + production_run_events STAGE_ADVANCED.detail.from/to | Observed stages only; no copied lifecycle or inferred future stages |
| Agents | labs.slug=dev-lab → agents.lab_id; run.responsible_agent | Names/roles/IDs from registered agents, project responsibility from current run; not proof of process liveness |
| Production run | creative_studio_production_runs (migration 029) | Latest run_number; raw status, stage, responsible_agent, iteration counter, timestamps |
| Events | creative_studio_production_run_events.run_id | Newest 200; event_type, timestamp and whitelisted stage/route/agent details |
| Artifacts | creative_studio_artifacts (018) | ID/type/title/version/created_by_agent/timestamp only; filesystem_path and unknown metadata excluded |
| Approval history | approvals.action_type creative-studio:<gate>:<slug> (including decision suffixes) | Exact project token match, approved_at determines approved/pending |
| Pending approval | run.human_gate / run.blockers HUMAN_DECISION_REQUIRED | Read-only pending display; synthesized view ID, never a second approval record |
| Iterations | creative_studio_production_iterations (027) | Real rows only; empty is honest. Run iteration counter remains separate. Local base_url/source_ref/output paths excluded |
| Review/QA | creative_studio_reviews.scores/decision; iteration.dimension_scores | Data-driven dimensions; no replacement grading rules |
| Readiness/CLIENT_READY | run.client_ready, client_ready_result.reasons, blockers | Display the recorded result; do not recompute CPE quality gates |
| Library | Not enabled in this pass | Capability false, explicit unsupported error |
| Media bytes | Not synchronized in this pass | Real metadata only; no Eagle Wings upload |

The read client has a fixed table allowlist, GET-only transport, project-slug allowlist, 15-second timeout, bounded reads, and manual redirect handling that rejects non-success responses. Requests never forward credentials to a redirect target. Production credentials stay server-side. The currently configured Supabase credential is the existing service-role credential; its database privileges are broader than this adapter's GET-only interface. A dedicated least-privilege read credential is a recommended hardening step before broadening access. No Supabase schema, grants, RLS, or live factory rows were changed.

## Commands and ownership

Browser → authenticated Worker → D1 bridge_commands ← outbound Mac runner → MOCK executor → acknowledged result → Worker/UI.

D1 stores command transport, heartbeat presence, and the existing independent demo state. It never stores an authoritative CPE project snapshot. R2 holds only published synthetic proof content and existing demo uploads.

Pass 1 commands: CREATE_PROJECT, START_RUN, RESUME_RUN, APPROVE_GATE, all mode=MOCK and project=bridge-smoke-test. Every production mutation capability is false. CANCEL_RUN and PAUSE_RUN are rejected. Unclaimed transport jobs can be cancelled separately; this does not cancel a CPE run. Strict payloads contain only the synthetic test scenario, never arbitrary command strings.

Prepared real translations in runner/executors.ts:

- CREATE_PROJECT → command.sh creative-studio project create --client <name> --slug <disposable-slug>
- START_RUN → npm run creative-studio:orchestrator -- run --project <disposable-slug>
- RESUME_RUN → npm run creative-studio:orchestrator -- run-resume --project <disposable-slug>
- APPROVE_GATE → verified command.sh creative-studio approve --project <slug>; deliberately disabled until expected-stage/run fencing is implemented
- CANCEL_RUN → run-cancel exists, but its inspected path updates run state without visibly acquiring the orchestrator lock. Safe cancellation is NOT VERIFIED and not exposed.

Real helpers require a separate non-symlink AI_COMMAND_CENTER-bridge root and bridge-disposable-* slug. executeReal additionally requires its explicit disposable-only opt-in. The Pass 1 hosted queue and runner cannot invoke that helper. No real executor was exercised.

See [the comprehensive report](STUDIO_LIVE_INTEGRATION_PASS_1_REPORT.md) for measured evidence, limitations, file inventory, setup, and acceptance results.

## Pass 2 disposable command boundary

Real controls use `/api/bridge/commands`; the read adapter does not acquire a
whole-state save method. Its direct mutation methods remain disabled. Scoped
bridge capabilities are returned under `BridgeSnapshot.real.capabilities`,
with `projectSlug=bridge-disposable-pass2`; general Studio/project controls
remain read-only. `BRIDGE_REAL_COMMANDS` admits explicit acceptance commands;
`BRIDGE_PROVEN_COMMANDS` advertises only operations actually verified afterward.

CPE CLI mappings were inspected at origin/main commit
`6e781aaca1bae409aa11f66baa191fa6af2b15f8` in the separate bridge worktree.
CREATE uses `command.sh creative-studio project create`. START/RESUME invoke
`dashboard/scripts/creative-studio-orchestrator.ts` through its installed tsx
loader (the same entrypoint used by the official npm script). APPROVE calls
`command.sh creative-studio approve` only after acquiring the existing CPE run
lock and verifying the exact run, project stage and direction gate. No CPE
business logic or second production state machine was added to Studio.

D1 stores transport state, immutable execution identity, last progress timestamp,
and published artifact metadata. Supabase remains authoritative for projects,
runs, gates, events, reviews and readiness. Private R2 objects contain only
approved disposable JSON bytes. No Eagle Wings artifact synchronization exists.
