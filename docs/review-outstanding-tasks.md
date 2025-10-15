# Outstanding Tasks Review

This document captures engineering work that surfaced while reviewing TODO markers and surrounding context in the current codebase. The goal is to convert implicit reminders into discrete backlog items that can be scheduled.

## Apps System Interaction Safety
- Enforce explicit user interaction before binding controls through `entity.control` and expose a release affordance in the UI so creators cannot accidentally lock input. The current control flow in `Apps.js` binds immediately with TODO comments noting the missing safeguards.
- Audit blueprint freezing to disable editing surfaces (code editor, model upload, metadata/flag panels) in both the sidebar and menu flows. Two separate components still expose interactive controls while TODO markers acknowledge the missing guard rails.

## Stage Instancing Diagnostics
- Confirm whether `Stage.getEntity` is still exercised. The helper logs a TODO message on every call, indicating it may be obsolete or should log only when unexpected.

## Physics Resource Lifecycle
- Replace the placeholder constraint-break handler with actionable recovery logic (e.g., rebuilding joints or notifying gameplay systems). The callback currently prints a TODO error.
- Ensure PhysX query results (`PxRaycastResult`, `PxSweepResult`, `PxOverlapResult`) are properly disposed during teardown to prevent memory pressure when scenes reload.

## Avatar Upload Guardrails
- Revisit the hard-coded 1 TB avatar upload allowance and placeholder label (`1LOLS`). Define realistic limits and user-facing copy that align with server validation.

## World Cleanup Automation
- Run pending database migrations before purging assets when executing `scripts/clean-world.mjs` so schema drift does not cause runtime errors during cleanup.

## Lockdown Configuration Review
- Review SES lockdown taming options for production hardening. The current configuration intentionally leaves error taming unsafe with a TODO noting the need to flip the settings outside of development builds.

These items can be tracked individually to reduce the risk of TODOs lingering unnoticed throughout the platform.
