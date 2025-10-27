# Deployment Preflight Automation

The `npm run ops:preflight` command executes a lightweight readiness scan
before promoting a world build to staging or production. It validates critical
infrastructure expectations without requiring operators to manually check each
system.

## What the script verifies

1. **Secrets & configuration** – Every environment variable flagged in
   `config/environments/*.yaml` and the deployment checklist must be present
   and non-empty before a rollout. Missing values halt the preflight.
2. **World assets** – Ensures the configured world, assets, and collections
   directories exist so the server boots with the expected content payloads.
3. **Build artifacts** – Confirms `build/index.js` is available, catching missed
   `npm run build` steps in CI or ad-hoc deployments.
4. **Worker thread readiness** – Spins up the shared `TaskPool` to validate the
   worker-based quest/metrics scheduler. This catches container runtimes that
   disable worker threads or misconfigure CPU quotas.

## Running the check

```bash
npm run ops:preflight
```

The command emits ✅ passes, ⚠️ warnings, and ❌ blocking failures. The CI/CD
pipeline should fail if any blocking failures are reported.

## Extending the script

- Wire additional checks into `scripts/ops/preflight.mjs`, such as database
  migrations, CDN write access, or observability endpoints.
- Export metrics from the preflight into your monitoring stack so repeated
  failures surface as alerts.
- Pair the script with infrastructure drift detection (OPS-ENV-003) to close the
  loop between pre-deployment validation and long-term secrets governance.
