# Production Deployment OKR Tracker

The previous checklist has been promoted into a lightweight OKR tracker so each
workstream can be mirrored in GitHub issues and quarterly planning. Reference
the **Tracking** column when filing issues (e.g., `OPS-ENV-001`) and update the
Status field during weekly ops reviews.

## Objective OPS-O1 — Environment & Secrets Management

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| OPS-ENV-001 | Not Started | Provision environment variables via a managed secrets store (Vault, AWS Secrets Manager, Doppler). | GitHub issue `OPS-ENV-001` | Blocks automated rollouts; requires Terraform module ownership defined in [ops runbook](../runbooks/diagnostics-cli.md). |
| OPS-ENV-002 | Not Started | Define per-environment configuration overlays (dev/staging/prod) with LiveKit URLs, database DSNs, CDN buckets, and signing keys. | GitHub issue `OPS-ENV-002` | Config bundles should align with IaC layouts captured in [`docs/roadmap/hardening-plan.md`](../roadmap/hardening-plan.md). |
| OPS-ENV-003 | Not Started | Introduce automated drift detection for secrets (Terraform state or rotation alerts). | GitHub issue `OPS-ENV-003` | Surface alerts through the observability pipeline described in [`docs/observability.md`](../observability.md). |

## Objective OPS-O2 — Infrastructure Automation

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| OPS-INF-001 | Not Started | Codify Fastify/Node services, LiveKit, databases, and asset/CDN storage with Terraform/Pulumi. | GitHub issue `OPS-INF-001` | Target automation matches the IaC stub in [`scripts/`](../../scripts). |
| OPS-INF-002 | Not Started | Provide Kubernetes/Nomad/ECS manifests covering scaling, health probes, resource limits, and rolling deployments. | GitHub issue `OPS-INF-002` | Link manifests to the deployment automation pipeline documented below. |
| OPS-INF-003 | Not Started | Automate TLS certificate management (ACME or platform-managed certs) and configure HTTP/2/WebSocket upgrades. | GitHub issue `OPS-INF-003` | Ensure ingress automation is validated against the incident playbooks in [`docs/runbooks/livekit-outage.md`](../runbooks/livekit-outage.md). |

## Objective OPS-O3 — Data & Persistence

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| OPS-DATA-001 | Not Started | Migrate from SQLite to managed Postgres/MySQL with automated backups and PITR. | GitHub issue `OPS-DATA-001` | Coordinate with the failover runbook in [`docs/runbooks/database-failover.md`](../runbooks/database-failover.md). |
| OPS-DATA-002 | Not Started | Document migration tooling and rollback procedures for schema upgrades. | GitHub issue `OPS-DATA-002` | Share validation steps with QA via the troubleshooting index (../troubleshooting/README.md). |
| OPS-DATA-003 | Not Started | Validate long-running save/load flows with large worlds and avatars for non-blocking I/O. | GitHub issue `OPS-DATA-003` | Track load-test output alongside the automated diagnostics CLI captures. |

## Objective OPS-O4 — Networking & Real-Time Services

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| OPS-RT-001 | Not Started | Stand up multi-region LiveKit (or equivalent SFU) clusters with metrics/logging/tracing hooks. | GitHub issue `OPS-RT-001` | Execution steps captured in [`docs/runbooks/livekit-outage.md`](../runbooks/livekit-outage.md). |
| OPS-RT-002 | Not Started | Implement interest-management-aware gateways (zonal routing, session affinity, cross-zone handoffs). | GitHub issue `OPS-RT-002` | Coordinate with MMO objectives in [`docs/mmorpg-task-breakdown.md`](../mmorpg-task-breakdown.md#objective-mmo-o1--authoritative-server--operations). |
| OPS-RT-003 | Not Started | Add automated load tests replaying player/agent traffic to observe CPU, memory, bandwidth ceilings. | GitHub issue `OPS-RT-003` | Reuse the diagnostics automation described in [`docs/observability.md`](../observability.md#automation-and-alerting). |

## Objective OPS-O5 — Observability & Operations

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| OPS-OBS-001 | Not Started | Wire structured logging, metrics, and tracing sinks (OpenTelemetry exporters, Loki/Tempo/Prometheus). | GitHub issue `OPS-OBS-001` | See [`docs/observability.md`](../observability.md) for pipeline requirements. |
| OPS-OBS-002 | Planned | Publish diagnostics CLI runbooks, alert thresholds, and failure recovery steps. | GitHub issue `OPS-OBS-002` | ✅ Runbooks landed in [`docs/runbooks`](../runbooks). Update status once teams adopt them. |
| OPS-OBS-003 | Not Started | Integrate log redaction and privacy policies aligned with GDPR/CCPA. | GitHub issue `OPS-OBS-003` | Map data classifications in the privacy appendix of the troubleshooting guide. |

## Objective OPS-O6 — Security & Compliance

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| OPS-SEC-001 | Not Started | Perform vulnerability scans (Snyk, OSV-Scanner, Dependabot) and document triage cadence. | GitHub issue `OPS-SEC-001` | Automate findings export into the compliance dashboard. |
| OPS-SEC-002 | Not Started | Harden Fastify middleware: CSP headers, strict CORS, rate limiting, JWT auditing. | GitHub issue `OPS-SEC-002` | Ensure changes are reflected in creator onboarding video #2 (security guardrails). |
| OPS-SEC-003 | Not Started | Establish account lifecycle policies (recovery, data export/delete) for end-user operations. | GitHub issue `OPS-SEC-003` | Link decisions into the governance appendix of the MMO OKR tracker. |

## Objective OPS-O7 — Release Engineering

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| OPS-REL-001 | Not Started | Set up CI/CD to lint, test, build, and package Node, web client, and viewer artifacts. | GitHub issue `OPS-REL-001` | Mirror automation hooks from `scripts/build*.mjs`. |
| OPS-REL-002 | Not Started | Publish versioned Docker images with SBOM metadata and signed attestations. | GitHub issue `OPS-REL-002` | Align with supply-chain controls defined in ops governance docs. |
| OPS-REL-003 | Not Started | Maintain release notes that map features to operational toggles and migrations. | GitHub issue `OPS-REL-003` | Template lives in `docs/roadmap/hardening-plan.md`. |

## Objective OPS-O8 — Documentation & Training

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| OPS-DOC-001 | In Progress | Keep diagrams and operator docs synchronised with automation scripts. | GitHub issue `OPS-DOC-001` | This update links deployment automation to observability tooling. |
| OPS-DOC-002 | Planned | Provide onboarding workshops or screencasts for SREs and creators. | GitHub issue `OPS-DOC-002` | New recordings catalogued in [`docs/training/onboarding-videos.md`](../training/onboarding-videos.md). |
| OPS-DOC-003 | Not Started | Track outstanding risks in a living document reviewed every release. | GitHub issue `OPS-DOC-003` | Seed risk register in `docs/roadmap/hardening-plan.md`. |

> ✅ Tip: Mirror these IDs in your issue tracker (e.g., GitHub Projects) so
> progress automatically feeds quarterly rollups.
