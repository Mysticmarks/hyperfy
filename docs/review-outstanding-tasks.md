# Outstanding Tasks Review

This document captures engineering work that surfaced while reviewing TODO markers and surrounding context in the current codebase. The goal is to convert implicit reminders into discrete backlog items that can be scheduled.

## Status

All actionable TODOs identified in this review have been addressed:

- [x] Require a recent user gesture before apps bind input via `entity.control`, surface a persistent release affordance in the core UI, and broadcast release events so builders can safely regain control.
- [x] Respect blueprint freezing by disabling editing affordances across the sidebar and menu flows, including script, metadata, model, and custom field editors.
- [x] Reduce noise from `Stage.getEntity` by returning entities when present and logging a single warning when an instanced entity is missing unexpectedly.
- [x] Replace the physics constraint-break placeholder with event emission and callback hooks so gameplay systems can react, and free PhysX query results during teardown to avoid memory growth when worlds reload.
- [x] Lower the avatar upload cap to a realistic 50 MB limit with matching user-facing copy.
- [x] Ensure the world cleanup script runs database migrations up-front by reusing the shared `getDB` helper and fixing the assets directory path.
- [x] Tighten SES lockdown defaults in production builds while keeping developer-friendly diagnostics during local development.

With these fixes in place the outstanding review items have been closed.
