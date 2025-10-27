# Runbook: LiveKit Outage or Degradation

**Audience:** Realtime/SRE rotation
**Related OKRs:** `OPS-RT-001`, `MMO-SRV-004`

## Detection

- Alerts from diagnostics CLI (`tick-rate-degraded`, `cpu-saturation`).
- LiveKit health dashboards show failed SFU nodes or high packet loss.
- Player reports of missing voice/video or movement jitter.

## Immediate Actions

1. **Acknowledge Alerts** – Claim the incident in the paging system.
2. **Verify Scope** – Run `npm run diagnostics -- --url <zone>` to confirm
   multiple zones affected. Capture `/metrics` output.
3. **Check LiveKit Control Plane** – Use the provider console or Terraform
   state to confirm cluster health. If automation indicates drift, trigger the
   `terraform apply` job associated with `OPS-INF-001`.

## Remediation Steps

1. **Scale Replacement SFU Nodes**
   - Apply Terraform workspace `livekit/<region>`.
   - Wait for health checks to pass (approx. 5 minutes).
2. **Drain Impacted Nodes**
   - Use `livekit-cli` or console to migrate participants.
   - Confirm diagnostics CLI shows stabilized tick rates.
3. **Switch Traffic**
   - Update DNS/ingress if necessary (`OPS-INF-003`).
   - Validate WebSocket negotiation via `npm run diagnostics -- --json` and
     ensure `issues` array clears.

## Communication

- Post status updates every 15 minutes in `#incidents`.
- Notify creators via status page template `STATUS-LIVEKIT` once mitigated.

## Postmortem Checklist

- Link incident to OKRs `OPS-RT-001` and `MMO-SRV-004`.
- Update [Troubleshooting entry](../troubleshooting/livekit.md) with root cause
  and preventive actions.
- File follow-up issues for automation gaps (e.g., missing canary tests).
