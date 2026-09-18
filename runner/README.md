# Studio Mac runner — Pass 1

This outbound-only Node service processes the hosted D1 command queue. It runs in the Studio checkout, not inside AI_COMMAND_CENTER. Start with `npm run bridge:runner`; set `BRIDGE_CONFIG` to an absolute private JSON file when starting from another working directory.

Private configuration fields: `origin` (HTTPS Studio URL), `runnerId`, `runnerToken`, `siteToken` (existing Sites machine-access credential), `mode: "MOCK"`, and absolute `journal` path. Keep the file mode 0600 and its directory 0700. No credentials belong in Git, browser storage, arguments to CPE, or logs.

The service heartbeats every 15 seconds and polls every 2 seconds; requests time out after 12 seconds. The Worker expires presence at 45 seconds and command leases at 60 seconds. SIGTERM/SIGINT finishes the current bounded request, marks the runner offline, closes its local SQLite journal, and exits. A launchd LaunchAgent can supervise it with KeepAlive and ThrottleInterval; see the Pass 1 report for the installed instance.

The runner's persistent journal records execution by command ID. Completed results can be returned without re-executing. A crash during an uncertain execution is quarantined, never replayed automatically. Mock failures occur before any synthetic execution; retryable failures are bounded to three attempts. A lost completion response is retried with the same claim token.

REAL execution helpers exist only for future disposable-project review. The hosted queue accepts MOCK only, and this Pass 1 runner refuses REAL startup. `realCommandPlan` translates CREATE_PROJECT, START_RUN, and RESUME_RUN to existing CPE entrypoints. `executeReal` requires the explicit `DISPOSABLE_PROJECT_ONLY` opt-in and a non-symlink AI_COMMAND_CENTER-bridge worktree. It is not called by the Pass 1 runner. APPROVE_GATE requires expected-stage/run fencing before it can be enabled. CANCEL_RUN and PAUSE_RUN remain unsupported. No CPE process was executed by these helpers in Pass 1.
