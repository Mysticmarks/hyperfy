# Runbook: Hyperfy Diagnostics CLI

**Audience:** SREs and operators responsible for monitoring Hyperfy zones.
**Related automation:** `scripts/server-diagnostics.mjs`

## Purpose

This runbook covers how to use the diagnostics CLI to interrogate `/metrics`
endpoints, capture baselines, and raise alerts when thresholds are exceeded.

## Preconditions

1. Node.js 18+ installed on the operator workstation or jump host.
2. Network access to the Hyperfy deployment (direct or via VPN/bastion).
3. `HYPERFY_DIAGNOSTICS_URL` exported if you want a default target.

## Procedure

### 1. Capture a Single Snapshot

```bash
npm run diagnostics -- --url https://world.example.com --json > metrics.json
```

- Validate the command succeeds (`exit code 0`).
- Store raw output for incident timelines.

### 2. Continuous Watch Mode

```bash
npm run diagnostics -- --url https://world.example.com --watch --interval 5
```

- Leave the process running while triaging performance issues.
- Copy the console output into the incident channel every 10 minutes.

### 3. Interpret KPIs

| Signal | Normal Range | Alert Threshold | Action |
| --- | --- | --- | --- |
| `ticks.observedRate` | ≥ target − 5% | Drop > 10% below target for 60s | Page on-call and scale out zone capacity. |
| `ticks.maxDurationMs` | ≤ frame budget (16.7 ms @ 60 Hz) | > 2× frame budget | Investigate heavy scripts or physics spikes. |
| `eventLoop.p99Ms` | ≤ 20 ms | > 50 ms for 3 consecutive samples | Offload blocking work to workers. |
| `cpu` | < 75% | ≥ 90% for 5 mins | Trigger auto-scaling workflow. |
| `memory` | < 70% | ≥ 90% | Capture heap dump; consult [LiveKit outage runbook](./livekit-outage.md). |

### 4. Escalation Workflow

1. If any alert threshold is crossed, create an incident in the ticketing
   system using template `INC-HFY-OBS`.
2. Attach the diagnostics output and reference the relevant OKR ID
   (e.g., `OPS-OBS-001`).
3. If the CLI cannot reach `/metrics`, confirm network ACLs, then failover
   using the [database runbook](./database-failover.md) if persistence health is
   suspect.

## Post-Incident Review

- File a follow-up ticket linked to the triggering OKR (`OPS-OBS-*`).
- Update dashboards/alerts to prevent recurrence.
- Record learnings in the troubleshooting log (../troubleshooting/README.md).
