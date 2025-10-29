# Hyperfy System Requirements Document (SRD)

## 1. Mission Statement
Hyperfy enables teams to build, host, and inhabit persistent 3D virtual worlds that feel responsive, collaborative, and extensible. The platform must empower world creators, operators, and visitors with tooling that is fast to iterate on, secure to operate, and delightful to experience.

**Success criteria**
- <60s cold start for a new development world from repository checkout.
- Sub-100ms server tick latency for core simulation loops under nominal load.
- Zero data loss guarantees for world state snapshots and content uploads.
- Ability to host 100 concurrent visitors with stable frame pacing on supported hardware.

## 2. Context & Stakeholders
- **Creators** craft experiences via the in-world editor, scripting APIs, and asset pipeline.
- **Operators** deploy, secure, and scale persistent worlds across environments (development, staging, production).
- **Participants** join worlds using the web client, VR hardware, or scripted agents.
- **Automation** integrates with CI/CD, observability, and ops tooling for managed rollouts.

## 3. Functional Requirements
1. **World Hosting & Session Management**
   - Serve HTTP(S) endpoints for static assets, REST APIs, and documentation.
   - Maintain WebSocket sessions for real-time state exchange between clients and the simulation runtime.
   - Expose authentication hooks for JWT-based access control (`src/server/runtime/auth`).
2. **Simulation & Physics**
   - Execute authoritative physics using PhysX bindings exposed through the runtime pipeline.
   - Broadcast deterministic updates to subscribed clients and reconcile state drift.
3. **Content Management**
   - Persist world definitions, assets, and user-generated content to SQLite via `better-sqlite3` with Knex migrations.
   - Provide backup, restore, and cleaning scripts (`scripts/backup-world.mjs`, `scripts/clean-world.mjs`).
4. **Realtime Collaboration Tools**
   - Support live editing, avatar control, chat, and LiveKit-powered spatial audio/video sessions.
   - Offer agent automation hooks for scripted actors (`agent.mjs`).
5. **Extensibility & SDKs**
   - Ship browser (`src/client`) and Node.js (`src/node-client`) SDKs with composable component systems.
   - Support sandboxed application code via SES lockdown (`src/core/lockdown.js`).
6. **Operations & Monitoring**
   - Provide diagnostics scripts (`scripts/server-diagnostics.mjs`, `scripts/ops/*`).
   - Emit structured logs and metrics suitable for ingestion by external observability stacks (see `docs/observability.md`).

## 4. Non-Functional Requirements
- **Reliability:** Graceful startup/shutdown, resilient reconnection for clients, and automated health checks.
- **Security:** SES runtime hardening, JWT validation, and secure secret distribution through overlay config files.
- **Performance:** Efficient message encoding (`msgpackr`), GPU-friendly client rendering (Three.js, postprocessing).
- **Scalability:** Stateless Fastify edge with pluggable storage backends, LiveKit for audio scaling, and horizontal scaling via Docker/Kubernetes.
- **Maintainability:** Modular directory structure (`src/server`, `src/world`, `src/client`, `src/core`), typed contracts, and comprehensive docs.

## 5. Architectural Overview
Hyperfy is composed of four primary subsystems:
1. **Server Runtime (`src/server`)** — Fastify-based API layer, simulation orchestrator, storage abstraction, and environment loader.
2. **World Runtime (`src/world`)** — Game-loop logic, physics integration, entity/component systems, and scripting sandbox.
3. **Client Applications (`src/client`, `src/node-client`, `build/viewer`)** — Browser and Node runtimes, leveraging React, Firebolt JSX, and Three.js for rendering and UI.
4. **Tooling & Scripts (`scripts`, `agent.mjs`)** — Build pipeline (esbuild), asset packaging, diagnostics, and automation agents.

### Data Flow
```
Client SDKs ⇄ Fastify HTTP/WebSocket ⇄ Server Runtime ⇄ World Simulation ⇄ Storage (SQLite/assets)
                                   ↘ LiveKit SFU ↗
```
- Web requests load assets and bootstrap configuration.
- WebSocket channels stream state updates, commands, and chat.
- LiveKit handles media sessions alongside the core runtime.
- Storage persists world state snapshots, user inventory, and audit logs.

## 6. Module Responsibilities
| Module | Description |
| --- | --- |
| `src/server/bootstrap.js` | Initializes SES lockdown, config overlays, and plugin registrations. |
| `src/server/runtime/createServerApp.js` | Builds Fastify instance, binds routes, and wires WebSocket handlers. |
| `src/world` | Contains world loop, systems, and component registrations. |
| `src/core` | Shared primitives (lockdown, utilities, schema definitions). |
| `src/client` | Browser app shell, UI components, asset loaders, and VR/WebXR integration. |
| `src/node-client` | Headless Node adapter for automation, testing, and remote control. |
| `scripts` | Build, deploy, diagnostics, and maintenance CLI scripts. |
| `tests` | Vitest suites for unit, smoke, and integration validation. |

## 7. External Dependencies
| Category | Libraries | Purpose |
| --- | --- | --- |
| Web Server | Fastify + plugins (compress, cors, websocket, static, multipart) | Serve HTTP, WebSocket, and asset endpoints. |
| Rendering | Three.js, postprocessing, n8ao | Real-time graphics and post-processing effects. |
| UI | React 19, Firebolt JSX/CSS, Lucide | Declarative UI and component styling. |
| Realtime | LiveKit client/server SDKs, eventemitter3 | Presence, voice/video, and event bus. |
| Storage | better-sqlite3, Knex, fs-extra | Persistent storage, migrations, file I/O. |
| Security | jsonwebtoken, ses | Authentication and runtime sandboxing. |
| Tooling | esbuild, vitest, eslint, prettier | Build pipeline, testing, linting, formatting. |

## 8. Interfaces & Protocols
- **HTTP REST:** CRUD endpoints for worlds, assets, and metadata (Fastify routes).
- **WebSocket:** Binary/JSON channels for simulation events, commands, chat, and telemetry.
- **LiveKit:** SFU sessions for audio/video bridging with session tokens minted by the server runtime.
- **CLI:** `npm run dev|build|test`, `scripts/ops/*`, `agent.mjs` automation.
- **Config Overlay:** YAML-defined environment overlays resolved by `src/server/environment/load-overlay.js` with secrets sourced from Vault/Doppler/AWS SM.

## 9. Configuration & Deployment
- Environment selected via `HYPERFY_ENVIRONMENT` referencing `config/environments/<env>.yaml`.
- Secrets injected at runtime by external secret managers.
- Docker image defined in `Dockerfile`; orchestrated deployments outlined in `DOCKER.md` and `docs/deployment/*`.
- CI pipeline in `.github/workflows/ci.yml` runs lint, formatting, and Vitest suites.
- Backup/restore flows executed via `scripts/backup-world.mjs`; a dedicated runbook is tracked in the roadmap backlog.

## 10. Data Management
- **Primary Store:** SQLite for metadata, with on-disk asset directories.
- **Consistency:** Transactions managed by Knex; backups triggered via scripts.
- **Retention:** Operators configure snapshot cadence; automation ensures off-site copies.

## 11. Observability & Operations
- Structured logging with severity tagging.
- Metrics & traces forwarded through adapters described in `docs/observability.md`.
- Diagnostics CLI checks environment parity and secret drift prior to deployment.

## 12. Roadmap & Known Gaps
- Expand automated coverage for world simulation edge cases and LiveKit signalling.
- Harden multi-region scaling by abstracting storage layer beyond SQLite.
- Introduce configuration schema validation with typed contracts to prevent runtime drift.
- Optimize rendering pipeline for low-powered devices (adaptive quality, GPU profiling hooks).
- Document plugin/extension API contracts and versioning policies.

## 13. Compliance & Governance
- GPL-3.0 licensing with contributor guidelines in `CONTRIBUTING.md`.
- Code of conduct and security policies referenced in root docs.
- Iteration logs maintained in `docs/iteration-log.md` with AI collaboration notes in `.github/ai/notes.md`.
