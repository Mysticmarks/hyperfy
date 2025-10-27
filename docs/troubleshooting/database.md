# Troubleshooting: Database Connectivity & Persistence

**Related runbook:** [Database Failover](../runbooks/database-failover.md)
**OKRs:** `OPS-DATA-001`, `OPS-DATA-002`

## Common Symptoms

- Persistent save failures or timeouts during world serialization.
- Diagnostics CLI shows `memory-pressure` coupled with DB retry errors.
- Managed service reports elevated replication lag.

## Investigation Checklist

1. Review application logs for `ECONNRESET`/`ETIMEDOUT` entries.
2. Inspect managed database dashboards (RDS, CloudSQL) for health alerts.
3. Validate secrets manager credentials align with current primary endpoint.
4. Confirm migrations are up-to-date (`npm run db:migrate -- --status`).

## Mitigation Notes

- Promote standby replicas before restarting application pods.
- Run targeted migration rollbacks if schema drift detected.
- Communicate any data loss risk to product leads immediately.

## Lessons Learned Template

| Date | Issue | Root Cause | Follow-up |
| --- | --- | --- | --- |
| YYYY-MM-DD | e.g., US-East failover delay | Manual secrets rotation lagged automation | Complete OPS-ENV-001 automation. |
