# Runbook: CDN Degradation or Asset Outage

**Audience:** Platform/SRE rotation
**Related OKRs:** `OPS-INF-003`, `MMO-CONTENT-004`

## Detection

- Monitoring shows increased asset load times or 5xx errors from CDN edge.
- Players report missing textures, avatars, or streaming content stalls.
- Synthetic checks from CI flag asset delivery failures.

## Immediate Actions

1. **Validate CDN Health**
   - Use provider status pages and API diagnostics.
   - Confirm origin (object storage) availability.
2. **Engage Provider**
   - Open support ticket with priority `P1` referencing customer ID.
   - Share traceroutes and request mitigation ETA.
3. **Enable Fallback Origin**
   - Switch DNS to backup CDN (if configured) or direct origin with aggressive
     caching headers.
   - Purge stale caches post cutover.

## Asset Integrity Checks

- Run `npm run build -- --verify-assets` if available to ensure packaging.
- Spot check high-traffic worlds for missing textures or scripts.
- Ensure `scripts/backup-world.mjs` backups exist in case of corruption.

## Communication

- Update `#incidents` and status page template `STATUS-CDN`.
- Notify creators via broadcast message once mitigation complete.

## Postmortem

- Record incident in [Troubleshooting > CDN](../troubleshooting/cdn.md).
- File follow-up issues against `OPS-INF-003` and `MMO-CONTENT-004` for
  automation or redundancy gaps.
