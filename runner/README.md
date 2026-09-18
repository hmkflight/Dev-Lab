# Studio bridge runner

Default executor mode is MOCK. Pass 2 REAL dispatch requires both `mode: "REAL"`
and `realProject: "bridge-disposable-pass2"` in the private runner configuration.
The hosted Worker separately admits only commands named in `BRIDGE_REAL_COMMANDS`.
Every other real project is rejected in both processes. No inbound port is opened.

Start from the Studio repository with `npm run bridge:runner`. The installed
LaunchAgent `com.hudson.studio-bridge-shadow` normally starts it automatically.
Do not start a second copy. Its private configuration is `.studio/runner.json`
(or `BRIDGE_CONFIG`), with origin, runnerId, runnerToken, siteToken, mode,
realProject and journal. Never commit these values.

REAL commands run in the exact separate `~/AI_COMMAND_CENTER-bridge` worktree.
Install that worktree's dashboard lockfile dependencies, and configure its
ignored `dashboard/.env.local` with NEXT_PUBLIC_SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY and CREATIVE_STUDIO_AGENT_PROVIDER=codex. The official
provider uses the existing Codex subscription login. No mock agent output is used.

The polling service heartbeats every 15 seconds and polls every 2 seconds.
Network calls have a 12-second timeout; CPE execution has no bridge timeout.
A detached one-command supervisor writes a private execution receipt every
5 seconds. The service renews its 60-second queue lease with that identity.
The LaunchAgent uses AbandonProcessGroup=true so stopping the poller does not
terminate its detached CPE supervisor. A browser has no ownership of execution.

SQLite records dispatch intent before spawning. A crash gap, missing receipt,
or stale supervisor receipt is **uncertain**, never permission to relaunch.
REAL RUNNING jobs never automatically expire into a retry. They block further
real dispatch until completion is reconciled or a human investigates. Do not
manually delete the journal, task receipts or queue rows to force a retry.
Completion delivery can retry without repeating CPE execution.

Only fixed arguments to official CPE commands are used with shell:false.
CREATE is unique for the disposable slug; START is unique for its lifetime;
APPROVE and RESUME are unique per run and expected stage. Approval additionally
holds the existing CPE run lock, re-reads authoritative state and calls the
existing approval CLI. Only the direction gate is enabled for this pass.
There is no PAUSE or CANCEL handler.

Private output is bounded to the last 8,000 characters per stream, redacted to
4,000 characters in the local receipt. Browser results receive a fixed summary,
not raw command output. Task receipts and SQLite are under ignored `.studio/`.
Service log files require normal OS log retention maintenance.

Artifact transport automatically selects at most one non-sensitive JSON artifact
owned by the disposable project, resolves its real path inside that exact project
folder, checks size/content, hashes bytes, and sends it outbound to authenticated
Worker/R2 storage. Eagle Wings is never a transport source.
