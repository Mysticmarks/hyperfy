# Observability & Diagnostics

Hyperfy now exposes richer runtime telemetry that makes it easier to diagnose
server pressure before it becomes a player-facing outage. This page summarises
the `/metrics` endpoint additions and how to work with the accompanying
command-line tooling.

## `/metrics` payload

Every configured zone reports the following structure:

| Field | Description |
| ----- | ----------- |
| `ticks.expectedRate` | The configured server tick rate for the zone. |
| `ticks.observedRate` | Rolling average of ticks-per-second measured over the last 10 seconds. |
| `ticks.averageDurationMs` | Mean wall-clock duration of each simulation tick in the sample window. |
| `ticks.maxDurationMs` | Maximum tick duration observed during the window. |
| `ticks.averageDeltaMs` | Average simulation delta (in milliseconds) derived from the physics step cadence. |
| `ticks.sampleCount` | Number of ticks contributing to the current statistics. |
| `ticks.windowMs` | Size of the sampling window (currently 10 seconds). |
| `eventLoop.*` | Event-loop delay histogram in milliseconds (`minMs`, `maxMs`, `meanMs`, `p99Ms`). |
| `issues` | Array of diagnostic flags raised when thresholds are exceeded. |

`issues` currently includes:

- `tick-rate-degraded` – observed tick rate is more than 10% below the target.
- `tick-duration-spike` – a tick lasted more than 2× the expected frame budget.
- `event-loop-lag` – the 99th percentile event-loop delay exceeds 50 ms.
- `cpu-saturation` – instantaneous CPU usage is above 90 % of available cores.
- `memory-pressure` – RSS exceeds 90 % of system memory.

These signals do not halt the process, but they highlight bottlenecks that are
likely to cause hitching, desync, or crashes under load.

## CLI: `npm run diagnostics`

A new diagnostics runner polls `/metrics` and renders a human-readable summary.
It is useful both for local development (sanity checking your world while you
stress-test it) and for lightweight production monitoring.

```bash
# Show a single snapshot from the local server
npm run diagnostics

# Poll a remote deployment every five seconds
npm run diagnostics -- --url https://example.com --watch --interval 5

# Emit raw JSON (useful for piping to `jq`)
npm run diagnostics -- --json
```

The script respects the `HYPERFY_DIAGNOSTICS_URL` environment variable if you
prefer not to pass `--url` on every invocation.

## Operational tips

- A sustained `tick-rate-degraded` issue suggests the simulation loop cannot
  keep up with the configured cadence. Consider reducing expensive scripts,
  lowering the configured tick rate, or scaling out to additional zones.
- `event-loop-lag` often indicates blocking work on the main thread (for
  example, synchronous filesystem operations). Profiling with Node's inspector
  or moving heavy tasks to workers can help.
- `cpu-saturation` and `memory-pressure` are early warnings that the host is at
  capacity. Schedule failover or horizontal scaling before they become hard
  outages.
- Export `/metrics` into your existing observability stack (Prometheus, DataDog,
  etc.) for alerting. The JSON schema is stable and designed to be easy to map
  into custom dashboards.

## Automation and Alerting

The diagnostics CLI implemented in [`scripts/server-diagnostics.mjs`](../scripts/server-diagnostics.mjs)
underpins the observability automation referenced in the deployment OKRs. Use
`npm run diagnostics` inside CI smoke tests and attach its JSON output to
`OPS-OBS-*` issues. Planned GitHub Actions (see `OPS-REL-001`) should execute
this script against staging deployments after each rollout.

Recommended alert thresholds mirror those in the
[Diagnostics CLI runbook](./runbooks/diagnostics-cli.md). When thresholds are
breached, create incidents tied to the appropriate OKR IDs so program tracking
remains consistent.

## Linked Runbooks and Troubleshooting

- [Diagnostics CLI Runbook](./runbooks/diagnostics-cli.md)
- [LiveKit Outage Runbook](./runbooks/livekit-outage.md)
- [Database Failover Runbook](./runbooks/database-failover.md)
- [CDN Degradation Runbook](./runbooks/cdn-degradation.md)
- [Troubleshooting Index](./troubleshooting/README.md)

These documents ensure observability expectations stay synchronized with the
automation delivered across deployment and MMO initiatives.
