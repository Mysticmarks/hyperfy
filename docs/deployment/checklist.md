# Production Deployment Checklist

This checklist captures the minimum hardening required to move a Hyperfy self-hosted deployment from the current alpha baseline toward a professionally operated environment. It consolidates the expectations described across `DEPLOYMENT_STATUS.md`, `observability.md`, and the October 2024 roadmap so they can be tracked in a single place.

## 1. Environment & Secrets Management
- [x] Provision environment variables through a managed secrets store (Vault, AWS Secrets Manager, Doppler) rather than `.env` files committed to hosts. Refer to `config/environments/*.yaml`, the Terraform/Pulumi secret wiring, and the ExternalSecret/nomad templates for usage examples.
- [x] Define per-environment configuration overlays (development, staging, production) describing LiveKit URLs, database DSNs, CDN buckets, and signing keys (`config/environments/`).
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
