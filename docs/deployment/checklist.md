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
| OPS-ENV-003 | In Progress | Introduce automated drift detection for secrets (Terraform state or rotation alerts). | GitHub issue `OPS-ENV-003` | Preflight automation (`scripts/ops/preflight.mjs`) now validates required secrets before deployment; integrate with observability alerts next. |

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
# Production Deployment Checklist

This checklist captures the minimum hardening required to move a Hyperfy self-hosted deployment from the current alpha baseline toward a professionally operated environment. It consolidates the expectations described across `DEPLOYMENT_STATUS.md`, `observability.md`, and the October 2024 roadmap so they can be tracked in a single place.

## 1. Environment & Secrets Management
- [x] Provision environment variables through a managed secrets store (Vault, AWS Secrets Manager, Doppler) rather than `.env` files committed to hosts. Refer to `config/environments/*.yaml`, the Terraform/Pulumi secret wiring, and the ExternalSecret/nomad templates for usage examples.
- [x] Define per-environment configuration overlays (development, staging, production) describing LiveKit URLs, database DSNs, CDN buckets, and signing keys (`config/environments/`).
- [x] Run the automated deployment preflight (`npm run ops:preflight`) to validate required secrets, world assets, and worker thread readiness before a rollout (`scripts/ops/preflight.mjs`).
- [ ] Introduce automated drift detection for secrets (e.g., Terraform state or secrets rotation alerts).

## 2. Infrastructure Automation
- [x] Codify Fastify/Node services, LiveKit, databases, and asset/CDN storage in infrastructure-as-code (Terraform or Pulumi) with reproducible environments (`infrastructure/terraform`, `infrastructure/pulumi`).
- [x] Provide container orchestration manifests (Kubernetes, Nomad, or ECS) that cover horizontal scaling, health probes, resource limits, and rolling deployments (`infrastructure/kubernetes`, `infrastructure/nomad`).
- [x] Automate TLS certificate management (Let’s Encrypt/ACME or platform-managed certs) and configure HTTP/2 or WebSocket upgrades through the chosen ingress stack (`infrastructure/kubernetes/ingress.yaml`, Nomad Traefik tags).

## 3. Data & Persistence
- [ ] Migrate the default SQLite world persistence to a managed Postgres/MySQL tier with automated backups and PITR.
- [ ] Document migration tooling and rollback procedures for schema upgrades.
- [ ] Validate long-running save/load flows with large worlds and avatars to guarantee no blocking I/O in the simulation tick.

## 4. Networking & Real-Time Services
- [ ] Stand up multi-region LiveKit or equivalent SFU clusters with observability hooks (metrics, logging, tracing).
- [ ] Implement interest-management aware gateways (zonal routing, session affinity, and cross-zone handoff strategies).
- [ ] Add automated load tests that replay representative player and agent traffic to observe CPU, memory, and bandwidth ceilings.

## 5. Observability & Operations
- [ ] Wire structured logging, metrics, and tracing sinks (OpenTelemetry exporters, Loki/Tempo/Prometheus) for server, agent, and client builds.
- [x] Publish runbooks for the diagnostics CLI, alert thresholds, and failure recovery steps (LiveKit outage, database failover, CDN degradation). See `docs/deployment/rollout.md` for rollout/rollback, validation, and smoke-test instructions.
- [ ] Integrate log redaction and privacy policies that align with GDPR/CCPA expectations.

## 6. Security & Compliance
- [ ] Perform dependency vulnerability scans (Snyk, OSV-Scanner, or GitHub Dependabot) and document the triage cadence.
- [ ] Harden Fastify middleware: CSP headers, strict CORS rules, rate limiting, and JWT auditing.
- [ ] Establish account lifecycle policies (account recovery, data export/delete) for eventual end-user operations.

## 7. Release Engineering
- [ ] Set up CI/CD that lint, test, build, and package artifacts across Node, web client, and viewer targets.
- [ ] Publish versioned Docker images with SBOM metadata and signed attestations.
- [ ] Maintain release notes that map features to operational toggles and migration requirements.

## 8. Documentation & Training
- [ ] Keep diagrams and operator docs synchronized with the automation scripts.
- [ ] Provide onboarding workshops or screencasts for SREs and creators so human error during setup is minimized.
- [ ] Track outstanding risks in a living document reviewed every release.

> ✅ Tip: Treat this checklist as an issue template. When a line item is completed, link the relevant PR or change request next to the checkbox to maintain institutional memory.
