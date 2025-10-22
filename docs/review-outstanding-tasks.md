# Outstanding Tasks Review

This document captures engineering work that surfaced while reviewing TODO markers and surrounding context in the current codebase. The goal is to convert implicit reminders into discrete backlog items that can be scheduled.

## Status

The initial backlog identified in the March 2024 pass has been delivered. A fresh October 2024 sweep uncovered a new cluster of TODOs worth tracking:

- [x] Require a recent user gesture before apps bind input via `entity.control`, surface a persistent release affordance in the core UI, and broadcast release events so builders can safely regain control.
- [x] Respect blueprint freezing by disabling editing affordances across the sidebar and menu flows, including script, metadata, model, and custom field editors.
- [x] Reduce noise from `Stage.getEntity` by returning entities when present and logging a single warning when an instanced entity is missing unexpectedly.
- [x] Replace the physics constraint-break placeholder with event emission and callback hooks so gameplay systems can react, and free PhysX query results during teardown to avoid memory growth when worlds reload.
- [x] Lower the avatar upload cap to a realistic 50 MB limit with matching user-facing copy.
- [x] Ensure the world cleanup script runs database migrations up-front by reusing the shared `getDB` helper and fixing the assets directory path.
- [x] Tighten SES lockdown defaults in production builds while keeping developer-friendly diagnostics during local development.

### October 2024 Audit Summary

| Area | File / Context | Issue | Next Step |
| --- | --- | --- | --- |
| Avatar pipeline | `src/core/entities/PlayerLocal.js`, `src/core/extras/createVRMFactory.js` | Duplicate VRM factory logic drifts across the builder and runtime entry points. | ✅ Shared avatar context exported via `avatar/createVRMAvatar` and reused by loaders, players, and emote tooling. |
| VRM bone lookups | `src/core/extras/createEmoteFactory.js` | Emote rigging looks up bones through helper APIs even when VRM exposes them directly. | ✅ Emote conversion now consumes the VRM humanoid bone map provided by the shared avatar factory. |
| Asset loading | `src/core/libs/gltfloader/GLTFLoader.js` | Instanced meshes with skinning are rejected, blocking efficient crowds. | ✅ `ENABLE_INSTANCED_SKINNING` flag enables instanced skinned mesh decoding; the loader falls back gracefully when disabled. |
| Physics teardown | `src/core/systems/Physics.js` | Query results are never destroyed, leaking on world reloads despite earlier cleanup work. | ✅ Physics teardown now releases ray/sweep/overlap buffers alongside controller filter callbacks before destroying the scene. |
| Filter data updates | `src/core/nodes/Controller.js`, `src/core/nodes/Collider.js` | Updating collision filtering requires full node rebuilds. | ✅ Controllers and colliders refresh `PxFilterData` in place, allowing live layer edits without recreation. |
| Node runtime naming | `src/core/createNodeClientWorld.js` | Loader names imply server/client symmetry but diverge in behaviour. | ✅ Renamed loaders to `BrowserLoader` and `NodeLoader`, aligning terminology with runtime behaviour. |
| Telemetry UI | `src/core/libs/stats-gl/index.js` | GPU analytics channel uses same colour as WebGL, obscuring context when both enabled. | ✅ Palette tokens shipped with classic/high-contrast options and documented controls (`docs/extras/stats-hud.md`). |

See `docs/todo-roadmap-2024-10.md` for detailed requirements, sequencing, and validation criteria for each item.
