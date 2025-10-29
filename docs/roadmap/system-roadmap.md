# Hyperfy System Roadmap & Scope Register

## Overview
This roadmap captures the current maturity of Hyperfy subsystems, outstanding risks, and prioritized improvements required to deliver a production-ready, self-optimizing virtual world platform.

## Scope Register
| Domain | Owner (default) | Current Maturity | Notes |
| --- | --- | --- | --- |
| Core runtime (`src/world`, `src/core`) | Platform team | Stable beta | Deterministic simulation loop validated in smoke tests; requires stress-test coverage. |
| Server APIs (`src/server`) | Platform team | Stable beta | Fastify stack proven in production; JWT + LiveKit flows need threat modeling refresh. |
| Client apps (`src/client`, `build/viewer`) | Experience team | Stable beta | WebXR support functional; responsive design polish required for tablets. |
| Node SDK (`src/node-client`) | Automation team | Alpha | Useful for scripted bots but lacks typed bindings and examples. |
| Tooling & scripts (`scripts`, `agent.mjs`) | DevOps | Stable | Ops preflight + diagnostics cover majority of deployment checks. |
| Tests (`tests`) | QA | Beta | Vitest suites cover unit/smoke/integration; e2e soak suite only run in CI and needs documentation. |
| Documentation (`docs`, README) | Docs guild | Beta | Extensive docs exist; SRD/roadmap newly established and require ongoing updates. |

## System Health Audit (2025-02-15)
- **Architecture:** Modular separation between server, world runtime, and client is healthy.
- **Dependencies:** Fastify 5, React 19, Three.js 0.173; continue monitoring for security advisories.
- **Tooling:** Build system relies on esbuild scripts; ensure Node 22.11.0 baseline is enforced.
- **Operations:** Secret overlays in `config/environments/*.yaml`; automation must validate secret presence.
- **Testing:** Integration suite exists but lacks load/regression scenarios for 100+ concurrent avatars.

## Prioritized Initiatives
1. **Stabilization & Modernization (Q1)**
   - Refresh LiveKit SDK usage with latest signalling changes.
   - Add startup health probes and server readiness checks.
   - Expand Vitest smoke tests to cover environment overlay loading failures.
2. **Performance & Scalability (Q1-Q2)**
   - Implement adaptive tick rate scheduling informed by server load metrics.
   - Profile WebSocket throughput under 100 concurrent sessions.
   - Introduce caching for static asset manifests.
3. **Developer Experience (Q2)**
   - Ship TypeScript definitions or JSDoc typedefs for Node SDK.
   - Provide world template generator CLI for quick bootstraps.
   - Document plugin lifecycle events and extension points.
4. **Observability & Automation (Q2)**
   - Integrate metrics exporters (OpenTelemetry) with default dashboards.
   - Automate backup verification and retention reporting.
   - Expand `.github/workflows` with nightly soak tests and documentation publish jobs.
5. **Intelligence & Adaptivity (Q3)**
   - Capture player behaviour telemetry to enable adaptive difficulty/world layout suggestions.
   - Prototype reinforcement learning agent for NPC behaviours using Node SDK.
   - Add personalization hooks in client UI for content recommendations.
6. **UX & Aesthetic Enhancements (Q3)**
   - Dark-mode-first UI polish with procedural color themes.
   - Improve VR interactions with haptic feedback cues.
   - Add accessibility options (captioning, high-contrast overlays).

## Risks & Mitigations
- **Secret Drift:** Mitigated by `scripts/ops/check-secrets-drift.mjs`; needs documentation in deployment runbooks.
- **Physics Regression:** Add deterministic replay tests and snapshot comparisons.
- **Asset Storage Limits:** Plan for S3-compatible offload with signed URLs.
- **LiveKit Outages:** Follow `docs/runbooks/livekit-outage.md`; evaluate multi-region fallback.

## Iteration Cadence
- Update SRD, roadmap, and iteration log after each major change set.
- Maintain AI collaboration notes in `.github/ai/notes.md` to preserve architectural intent.
- Schedule quarterly architecture reviews to reassess scope register maturity.

## Next Steps
1. Formalize config schema validation layer.
2. Author load-testing strategy for world runtime (100 concurrent avatars target).
3. Draft plugin contract documentation with version guarantees.
4. Align build pipeline with containerized dev environment for parity with production.
