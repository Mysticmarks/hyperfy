# MMORPG Systems Integration Guide

This guide summarizes how the current Hyperfy platform stitches together the
infrastructure, gameplay, and operations layers that the MMORPG roadmap calls
for. Use it alongside the [roadmap](./mmorpg-roadmap.md) to confirm which
systems already exist in the repository and where additional engineering is
required.

## 1. Infrastructure & Networking

| Capability | Current Implementation | Dependencies |
| --- | --- | --- |
| Multi-zone world hosting | `WORLD_ZONES` bootstraps isolated worlds with their own persistence directories while sharing the asset pipeline. | [Server entrypoint](../src/server/index.js) and [multi-zone runbook](./server-zones.md). |
| Gateway endpoints | `/zones`, `/status`, `/metrics`, and `/health` expose zone state for orchestrators and dashboards. | [Server entrypoint](../src/server/index.js). |
| Interest-managed networking | `ServerNetwork` exposes per-zone tick rate tuning; interest management and throttling remain to be implemented. | [Server networking system](../src/core/systems/ServerNetwork.js). |

## 2. Persistence & Player State

| Capability | Current Implementation | Dependencies |
| --- | --- | --- |
| Zone storage | Each zone provisions a dedicated SQLite database and JSON storage to avoid data collisions. | [Server entrypoint](../src/server/index.js). |
| Collections hydration | Base collections load once, then clone into every zone during boot. | [Server entrypoint](../src/server/index.js). |
| Character data services | Not yet implemented; roadmap calls for account, inventory, and quest schemas. | [Roadmap section](./mmorpg-roadmap.md#2-persistence--progression). |

## 3. Gameplay & Social Layers

| Capability | Current Implementation | Dependencies |
| --- | --- | --- |
| Authoritative combat & abilities | Pending. Requires deterministic resolvers and rollback. | [Roadmap section](./mmorpg-roadmap.md#3-gameplay--social-systems). |
| Quest tooling | Pending. Leverages the existing scripting API and app system. | [Creator docs](./README.md) and [roadmap](./mmorpg-roadmap.md#3-gameplay--social-systems). |
| Social systems | Chat, guilds, and moderation workflows are roadmap items and require backend services. | [Roadmap section](./mmorpg-roadmap.md#3-gameplay--social-systems). |

## 4. Content & Live Operations

| Capability | Current Implementation | Dependencies |
| --- | --- | --- |
| Asset ingestion | Server exposes hashed asset uploads, but automated LOD/navmesh pipelines remain a roadmap item. | [Server entrypoint](../src/server/index.js) and [roadmap](./mmorpg-roadmap.md#4-world-building--content-pipeline). |
| Live operations tooling | Pending. Requires CMS-style controls on top of builder. | [Roadmap section](./mmorpg-roadmap.md#4-world-building--content-pipeline). |
| Testing automation | Headless agent exists, broader regression suite is still planned. | [Project README](../README.md). |

## 5. Client, Rendering & UX

| Capability | Current Implementation | Dependencies |
| --- | --- | --- |
| Renderer stack | WebGL renderer with AO/bloom is present; WebGPU/native clients are roadmap items. | [Client graphics system](../src/core/systems/ClientGraphics.js) and [deployment status](./DEPLOYMENT_STATUS.md). |
| Input accessibility | Remappable controls and accessibility options are open tasks. | [Roadmap section](./mmorpg-roadmap.md#5-client-rendering--ux). |
| Performance budgets | Requires future instrumentation and streaming hints. | [Roadmap section](./mmorpg-roadmap.md#5-client-rendering--ux). |

## 6. DevOps & Compliance

| Capability | Current Implementation | Dependencies |
| --- | --- | --- |
| Build & deployment | Manual scripts exist; CI/CD, container images, and IaC are roadmap work. | [Project README](../README.md) and [roadmap](./mmorpg-roadmap.md#6-devops--compliance). |
| Monitoring & support | Needs integration with alerting, log aggregation, and support tooling. | [Roadmap section](./mmorpg-roadmap.md#6-devops--compliance). |
| Legal & data protection | Compliance frameworks must be added before MMORPG launch. | [Roadmap section](./mmorpg-roadmap.md#6-devops--compliance). |

## 7. Suggested Implementation Order

1. Harden infrastructure (multi-zone orchestration, interest management, and
   telemetry) so gameplay services have a reliable foundation.
2. Introduce persistent character/account services with transactional storage
   and security controls.
3. Build gameplay loops (combat, quests, social features) on top of the
   authoritative servers.
4. Expand content tooling and automated testing to keep shipping velocity high.
5. Iterate on client fidelity, accessibility, and performance budgets as new
   features land.
6. Formalize DevOps, monitoring, and compliance to prepare for live operations.

Working through the roadmap in this order ensures every layer has the required
underpinnings from the previous steps, reducing rework as the MMORPG feature set
matures.
