# MMORPG Initiative OKR Tracker

This tracker replaces the raw checklist with structured OKRs that map directly
onto MMO platform epics. Each row references an internal issue ID (`MMO-*`).
Update the Status column as deliverables move through discovery, build, and
validation.

## Objective MMO-O1 — Authoritative Server & Operations

| ID | Status | Summary | Tracking | Dependencies |
| --- | --- | --- | --- | --- |
| MMO-SRV-001 | Not Started | Design multi-process topology with dedicated zone simulators, shard managers, and stateless gateways. | GitHub issue `MMO-SRV-001` | Blocks OPS-RT-002 routing work. |
| MMO-SRV-002 | Not Started | Implement cross-zone transfer protocol with hand-offs, timeout recovery, and metrics. | GitHub issue `MMO-SRV-002` | Requires topology blueprint from MMO-SRV-001. |
| MMO-SRV-003 | Not Started | Add structured telemetry (health probes, tick timing, bandwidth, error rates) exposed via `/metrics` and tracing sinks. | GitHub issue `MMO-SRV-003` | Reuse observability automation in [`docs/observability.md`](./observability.md). |
| MMO-SRV-004 | Not Started | Introduce automated crash recovery with persistent queueing/replay to restore zone state. | GitHub issue `MMO-SRV-004` | Link runbook [`docs/runbooks/livekit-outage.md`](./runbooks/livekit-outage.md). |
| MMO-SRV-005 | Not Started | Establish production-grade deployment pipelines (container builds, IaC modules, rollout/revert playbooks). | GitHub issue `MMO-SRV-005` | Aligns with OPS-INF-001/OPS-REL-001. |

## Objective MMO-O2 — Persistence, Accounts, and Security

| ID | Status | Summary | Tracking | Dependencies |
| --- | --- | --- | --- | --- |
| MMO-AUTH-001 | Not Started | Ship character service schemas (profiles, inventories, achievements, quest state) plus migration tooling. | GitHub issue `MMO-AUTH-001` | Requires OPS-DATA-001 managed database tier. |
| MMO-AUTH-002 | Not Started | Build transactional APIs for inventory updates, crafting, trading, and currency balances with audit trails. | GitHub issue `MMO-AUTH-002` | Depends on schema from MMO-AUTH-001. |
| MMO-AUTH-003 | Not Started | Integrate OAuth/OIDC login, MFA, device fingerprinting, and session management. | GitHub issue `MMO-AUTH-003` | Reference onboarding video security module. |
| MMO-AUTH-004 | Not Started | Deploy baseline anti-cheat instrumentation (rate heuristics, authoritative validation, tamper detection). | GitHub issue `MMO-AUTH-004` | Telemetry hooks from MMO-SRV-003. |
| MMO-AUTH-005 | Not Started | Document account lifecycle flows, data retention, and GDPR/CCPA compliance guarantees. | GitHub issue `MMO-AUTH-005` | Link to OPS-SEC-003 governance work. |

## Objective MMO-O3 — Gameplay & Social Systems

| ID | Status | Summary | Tracking | Dependencies |
| --- | --- | --- | --- | --- |
| MMO-GAME-001 | Not Started | Create authoritative combat pipeline (ability definitions, cooldown scheduling, deterministic rollback). | GitHub issue `MMO-GAME-001` | Requires combat schema inputs (MMO-AUTH-001). |
| MMO-GAME-002 | Not Started | Implement quest/narrative designer tools with node-based editors and live scripting hooks. | GitHub issue `MMO-GAME-002` | Depends on content pipeline ingestion (MMO-CONTENT-001). |
| MMO-GAME-003 | Not Started | Expand social systems: chat, guilds, parties, matchmaking, moderation workflows. | GitHub issue `MMO-GAME-003` | Align moderation flows with OPS-SEC-003. |
| MMO-GAME-004 | Not Started | Instrument live events tooling for seasonal updates, live ops overrides, and announcement broadcasts. | GitHub issue `MMO-GAME-004` | Observability from MMO-SRV-003. |
| MMO-GAME-005 | Not Started | Automate regression/perf testing with headless agent swarms. | GitHub issue `MMO-GAME-005` | Shares load harness with OPS-RT-003. |

## Objective MMO-O4 — Content & Asset Pipeline

| ID | Status | Summary | Tracking | Dependencies |
| --- | --- | --- | --- | --- |
| MMO-CONTENT-001 | Not Started | Build ingestion service for assets (validation, LOD baking, navmesh generation, packaging). | GitHub issue `MMO-CONTENT-001` | Leverages build scripts in `scripts/build*.mjs`. |
| MMO-CONTENT-002 | Not Started | Introduce automated build pipeline for app/game scripts with dependency analysis and sandbox enforcement. | GitHub issue `MMO-CONTENT-002` | Pair with OPS-REL-001 CI/CD. |
| MMO-CONTENT-003 | Not Started | Provide CMS-like dashboard for publishing, rollback, and experimentation (A/B, feature flags). | GitHub issue `MMO-CONTENT-003` | Requires ingestion APIs from MMO-CONTENT-001. |
| MMO-CONTENT-004 | Not Started | Harden storage layer with redundancy, versioning, and CDN invalidation control for asset updates. | GitHub issue `MMO-CONTENT-004` | Coordinate with OPS-DATA-001 persistence migration. |
| MMO-CONTENT-005 | Not Started | Publish content pipeline documentation and onboarding guides for creators/live ops. | GitHub issue `MMO-CONTENT-005` | Videos referenced in [`docs/training/onboarding-videos.md`](./training/onboarding-videos.md). |

## Objective MMO-O5 — Client Rendering & Experience

| ID | Status | Summary | Tracking | Dependencies |
| --- | --- | --- | --- | --- |
| MMO-CLIENT-001 | Not Started | Develop next-gen renderer path (WebGPU/native) with fallback tiers and frame budget enforcement. | GitHub issue `MMO-CLIENT-001` | Build upon stats HUD telemetry docs. |
| MMO-CLIENT-002 | Not Started | Implement advanced animation system (state machines, blend trees, IK, ragdolls) integrated with combat/emotes. | GitHub issue `MMO-CLIENT-002` | Depends on avatar consolidation roadmap. |
| MMO-CLIENT-003 | Not Started | Add accessibility/input support: controller mappings, remappable keybinds, UI scaling, color blindness options. | GitHub issue `MMO-CLIENT-003` | Feed into onboarding video #3. |
| MMO-CLIENT-004 | Not Started | Optimize asset streaming and visibility culling aligned with server interest management. | GitHub issue `MMO-CLIENT-004` | Requires MMO-SRV-002 routing metrics. |
| MMO-CLIENT-005 | Not Started | Expand UI/UX documentation covering lifecycle, scripting APIs, performance tuning. | GitHub issue `MMO-CLIENT-005` | Link to docs in `docs/scripting`. |

## Objective MMO-O6 — Documentation & Knowledge Base

| ID | Status | Summary | Tracking | Notes |
| --- | --- | --- | --- | --- |
| MMO-DOC-001 | Complete | Close outstanding TODOs in scripting/systems docs with up-to-date lifecycle explanations. | GitHub issue `MMO-DOC-001` | ✅ Completed per October 2024 audit. |
| MMO-DOC-002 | Not Started | Produce end-to-end developer walkthroughs from world bootstrap to live publishing. | GitHub issue `MMO-DOC-002` | Pair with onboarding video #1. |
| MMO-DOC-003 | Planned | Create operational runbooks for on-call, incident response, maintenance tasks. | GitHub issue `MMO-DOC-003` | ✅ Runbooks available in [`docs/runbooks`](./runbooks). Update status post adoption. |
| MMO-DOC-004 | Not Started | Maintain change logs linking systems to roadmap milestones and deployment readiness criteria. | GitHub issue `MMO-DOC-004` | Integrate with OPS-REL-003 release notes. |
| MMO-DOC-005 | Not Started | Establish governance for keeping docs, diagrams, dashboards synchronized with shipped features. | GitHub issue `MMO-DOC-005` | RACI stored in `docs/roadmap/hardening-plan.md`. |

> Mirror `MMO-*` IDs in the shared project board so progress snapshots roll up
> cleanly to executive OKR reviews.
