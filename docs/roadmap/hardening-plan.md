# Hyperfy Hardening Plan

This plan translates the broad alpha-stage gaps (deployment automation, test fidelity, and UI/UX polish) into concrete, assignable work streams. Each milestone can be broken into GitHub Projects epics or sprint backlogs.

## 1. Deployment Automation
**Objective:** Replace bespoke, manual steps with repeatable automation.

### Milestone A — Baseline Infrastructure
- Author Terraform/Pulumi modules for the API, authoritative server, LiveKit, and CDN buckets.
- Provide sample environment overlays (`env/development`, `env/staging`, `env/production`).
- Ship container orchestration manifests (Kubernetes or Nomad) with autoscaling policies and liveness probes.

### Milestone B — Operational Tooling
- Add GitHub Actions workflows for lint, test, build, and Docker image publication.
- Integrate observability stack bootstrap scripts (Grafana Agent, Promtail, Tempo/OTLP exporters).
- Document incident response playbooks, escalation paths, and SLO targets.

## 2. Test Fidelity Expansion
**Objective:** Move from mocked coverage toward real system validation.

### Milestone A — Deterministic Simulation Tests
- Build replayable physics and animation fixtures sourced from real-world gameplay captures.
- Add latency injection harnesses that simulate packet loss, re-ordering, and jitter within Vitest or Playwright-based tests.
- Validate agent reconnection and failover (see `tests/integration/agent-scenarios.test.js`).

### Milestone B — End-to-End Scenarios
- Stand up a headless multi-client test harness that spins up server, client, and LiveKit components inside the CI runner.
- Capture rendering snapshots for the viewer build (WebGL regression tests) and compare against golden images.
- Introduce soak tests that sustain hundreds of simulated players for ≥30 minutes to measure CPU/memory trends.

## 3. UI/UX & Creator Experience
**Objective:** Deliver the “awesome AF” interactive experience requested by the community.

### Milestone A — Design System Upgrades
- Extend the existing dark theme with hue/saturation controls, contrast presets, and accessible typography scales.
- Add interaction states (focus rings, keyboard shortcuts overlays, command palette).
- Provide motion tokens (timings, easing curves) and wire them into critical flows (dialogs, inspector panels).

### Milestone B — Guided Onboarding
- Embed contextual help in the creator UI (tooltips, quick-start tours, searchable help panel).
- Implement input remapping and accessibility toggles (colorblind filters, text-to-speech hooks).
- Capture analytics on onboarding friction and iterate using UX research sprints.

## 4. Governance & Program Management
- Maintain a living RACI chart for deployment, test, and UX initiatives.
- Review this plan quarterly; mark milestones as `✅` when complete and link to changelogs/PRs.
- Align hiring/contracting plans with the workload (e.g., DevOps, QA automation, UX motion designer).

> _Next step:_ spin this plan into a GitHub Project board with swimlanes for each milestone, ensuring “definition of done” includes updated docs, telemetry, and rollback procedures.
