# Studio / Dev Lab

A desktop-first, functional web studio prototype for operating an existing Dev Lab. It does not rebuild the lab, execute agents, or generate websites. **DEMO MODE is visible whenever the mock adapter is active.**

## Run

Requires Node.js 22.12+ (tested with Node 26).

```sh
npm install
npm run dev
```

Open http://localhost:4173. The server binds to loopback only. Set `PORT` to use another local port. Set `STUDIO_DATA_DIR` to choose a different local data folder.

```sh
npm run build  # TypeScript checks + production bundle
npm start      # Serve the production bundle and API
npm test       # Adapter workflow and persistence tests
npm run test:e2e # Browser workflow tests (requires installed Google Chrome)
```

## Try the workflow

1. Open **New project**. Add a name, client context, multiple URLs, contact details, and files.
2. Press **Start factory**. Your intake and uploaded files are saved locally.
3. On **Progress**, press **Continue demo** to advance illustrative stages. Nothing progresses on a timer.
4. Review direction/build/final gates when they appear. Approve or request changes with feedback.
5. In **Review**, choose a device width, iteration, or compare the previous iteration.
6. Complete the final approval, then archive the project if desired.

Seed projects include Forma (building), Offscript (approval), Kinfolk (content blockers), and Orbit (complete). Kinfolk has an explicit **Demo: mark supplied** action to try unblocking it. Change requests preserve feedback and immediately prepare a fresh demo gate; no real revision is produced.

The library supports selecting several design references and passing them into a new intake. Uploaded files can be downloaded from the project’s Media section. Each file is limited to 25 MB, with up to 20 per request.

## Storage and demo boundaries

- `.studio/demo-state.json`: local demo data, saved by the server.
- `.studio/uploads/`: locally uploaded assets, served as downloads.
- `public/previews/`: four illustrative websites with distinct iteration treatments. They are sample output, not generated from client input.
- Google Fonts is optional; system fonts provide an offline fallback.
- No authentication, multi-user coordination, real production jobs, live QA, or Dev Lab connection is included.
- Stop the server and remove `.studio/` to reset the demo. This also deletes uploaded demo files.

See [INTEGRATION.md](./INTEGRATION.md) for the adapter contract and integration path.

## ChatGPT hosting

`npm run db:generate` generates hosted schema migrations; `npm run build:hosted` builds the Sites Worker and client. The hosted site is owner-private and uses D1 for demo state and R2 for uploaded files. It starts with sample projects; existing `.studio` data is not uploaded. Hosted uploads support 25 MB total per batch (up to 20 files). Local development continues to use `.studio` storage. The hosted demo does not execute real Dev Lab agents.

## Adapter foundation

See [docs/DEVLAB_STUDIO_ADAPTER.md](docs/DEVLAB_STUDIO_ADAPTER.md). The server resolver defaults to `mock`; `DEVLAB_ADAPTER_MODE=devlab` selects a deliberately unconfigured skeleton whose operations fail clearly. No real Dev Lab integration runs. `npm run lint` validates the browser/server import boundary, and `npm run typecheck` checks TypeScript.

## Studio bridge — Pass 1

Hosted Studio now observes an explicitly allowlisted CPE project through Supabase reads. Production controls remain disabled. The **Factory bridge** page tests authenticated, durable synthetic commands through a separately supervised Mac runner; D1 is command transport, never CPE's source of truth.

- Runner setup and safety: [runner/README.md](runner/README.md)
- Verified mappings: [docs/DEVLAB_STUDIO_ADAPTER.md](docs/DEVLAB_STUDIO_ADAPTER.md)
- Full acceptance report: [docs/STUDIO_LIVE_INTEGRATION_PASS_1_REPORT.md](docs/STUDIO_LIVE_INTEGRATION_PASS_1_REPORT.md)
- `npm run bridge:runner` starts the MOCK runner using a private `.studio/runner.json`.
- `npm run test:bridge:hosted` explicitly tests hosted CPE reads and synthetic commands using private `.studio/operator.json` test credentials.

The local Express preview remains a loopback-only demo/development server. Hosted API access uses Sites identity plus an explicit owner/viewer allowlist; machine requests additionally require an application token. No public inbound Mac listener is used.
