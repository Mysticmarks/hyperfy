# Troubleshooting: LiveKit Realtime Failures

**Related runbook:** [LiveKit Outage](../runbooks/livekit-outage.md)
**OKRs:** `OPS-RT-001`, `MMO-SRV-004`

## Common Symptoms

- Voice/video drops for subsets of players.
- `/metrics` reports `tick-rate-degraded` and `cpu-saturation` simultaneously.
- Packet loss spikes on LiveKit dashboards.

## Investigation Checklist

1. Confirm incident ticket is open and linked to `OPS-RT-001`.
2. Capture diagnostics CLI output (`npm run diagnostics -- --json`).
3. Inspect LiveKit control plane logs for failed nodes.
4. Validate ingress certificate expiry (ties to `OPS-INF-003`).

## Mitigation Notes

- Scaling SFU nodes typically resolves jitter within 5 minutes.
- If packet loss persists, route traffic through backup regions.
- Update status page entries to reflect degraded regions.

## Lessons Learned Template

| Date | Issue | Root Cause | Follow-up |
| --- | --- | --- | --- |
| YYYY-MM-DD | e.g., EU West packet loss | Misconfigured autoscaling thresholds | Update Terraform module (`OPS-INF-001`). |

Add new rows after each incident and link to relevant PRs/issues.
