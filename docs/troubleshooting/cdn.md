# Troubleshooting: CDN & Asset Delivery

**Related runbook:** [CDN Degradation](../runbooks/cdn-degradation.md)
**OKRs:** `OPS-INF-003`, `MMO-CONTENT-004`

## Common Symptoms

- 5xx errors when fetching static assets or avatars.
- Intermittent missing textures when loading worlds.
- Elevated asset download time in RUM dashboards.

## Investigation Checklist

1. Confirm CDN provider status and regional impact.
2. Run spot checks on multiple regions using `curl -I` requests.
3. Verify origin bucket health and recent deployment history.
4. Check cache purge logs to ensure invalidations completed.

## Mitigation Notes

- Enable backup CDN profile if available; document DNS changes in incident log.
- Adjust cache TTLs to reduce load on origin during failover.
- Trigger asset rebuild pipeline to confirm packaging integrity.

## Lessons Learned Template

| Date | Issue | Root Cause | Follow-up |
| --- | --- | --- | --- |
| YYYY-MM-DD | e.g., APAC CDN 5xx burst | Provider POP outage | Add multi-CDN failover automation (`OPS-INF-003`). |
