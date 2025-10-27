# Runbook: Database Failover & Recovery

**Audience:** Database/SRE rotation
**Related OKRs:** `OPS-DATA-001`, `OPS-DATA-002`

## Detection

- Diagnostics CLI shows `memory-pressure` or persistent save/load failures.
- RDS/CloudSQL alerts for replication lag, failover events, or storage faults.
- Application logs report `ECONNRESET` or migration errors.

## Immediate Actions

1. **Confirm Impact**
   - Run `npm run diagnostics -- --json` and check `zones[*].issues` for
     persistence-related warnings.
   - Query the database status endpoint (`/healthz/db`) if available.
2. **Promote Standby**
   - Execute managed service failover (AWS RDS: `aws rds failover-db-cluster`).
   - Update connection strings in secrets manager (tracked by `OPS-ENV-001`).
3. **Invalidate Stale Connections**
   - Restart Node processes or recycle pods to pick up new endpoints.

## Data Integrity Validation

- Run schema migrations in dry-run mode (`npm run db:migrate -- --dry-run`).
- Execute smoke test: load top 10 active worlds and confirm persistence.
- Check backup PITR snapshots to ensure recovery point objectives met.

## Communication

- Announce failover in `#incidents` and on the status page template
  `STATUS-DB`.
- Coordinate with gameplay leads if player data rollback is required.

## Postmortem

- Link incident to `OPS-DATA-001`/`OPS-DATA-002` follow-ups.
- Document remediation notes in [Troubleshooting > Database](../troubleshooting/database.md).
- Ensure migration tooling documentation is updated with observed gaps.
