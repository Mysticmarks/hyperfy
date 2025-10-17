# October 2024 TODO Roadmap

This roadmap expands the outstanding TODO markers discovered during the October 2024 code sweep into actionable engineering work. Each workstream includes context, acceptance criteria, sequencing, and validation guidance so teams can schedule the backlog without re-reading source comments.

## 1. Avatar Pipeline Consolidation

**Context**: `PlayerLocal` and `createVRMFactory` carry diverging logic for loading VRM avatars, leading to inconsistent humanoid rig resolution and duplicated maintenance. Emote tooling (`createEmoteFactory`) also relies on indirect bone lookup helpers because the VRM metadata is not shared consistently.

**Goals**
- Factor a reusable `avatar/createVRMAvatar.js` module consumed by runtime and builder entry points.
- Normalize humanoid bone mapping and fallback handling across animation, emotes, and IK systems.
- Expose typed hooks (TypeScript declaration file) for third-party avatar customizers.

**Acceptance Criteria**
- The old factories delegate to the shared module without behaviour divergence.
- Automated smoke test loads VRM avatars in both editor and runtime contexts with identical skeleton resolution.
- Emote factory uses VRM's native bone map and the regression suite validates emote playback.

**Validation**
- Unit: add Jest coverage for the shared avatar module, verifying default + custom blendshape support.
- Manual: load a VRM avatar via builder and runtime, confirm emote playback and IK continuity.

## 2. GLTF Instanced Skinned Mesh Support

**Context**: `GLTFLoader` currently bails when instanced meshes carry skinning data. This blocks efficient crowds or vegetation that relies on armature animation.

**Goals**
- Implement instanced skinned mesh decoding guarded behind `ENABLE_INSTANCED_SKINNING` flag.
- Share buffer attributes where possible to avoid duplication while maintaining independent bone matrices per instance.
- Document performance constraints and recommended budgets for content teams.

**Acceptance Criteria**
- Loader accepts GLTF assets combining instancing + skinning and renders them correctly.
- Profiling shows no greater than 10% frame regression against baseline crowd scenes.
- Content documentation updated with authoring guidelines and fallback behaviour when the flag is disabled.

**Validation**
- Automated: add integration test scene that loads instanced skinned GLTF and validates joint matrices via snapshot.
- Manual: run perf capture in stats HUD verifying GPU/CPU cost within defined budget.

## 3. Physics Query Resource Teardown

**Context**: `Physics` system still leaves `raycastResult`, `sweepResult`, and `overlapResult` allocations alive during teardown, causing leaks on repeated world reloads.

**Goals**
- Add `destroy()` handling for query results inside `Physics.destroy()`.
- Backfill regression coverage that spawns/destroys multiple worlds to guard against future leaks.
- Publish guidance for content teams to monitor PhysX heap usage during development.

**Acceptance Criteria**
- Memory snapshot after 10 consecutive reloads shows stable allocation footprint.
- Regression test fails if any query result handle remains allocated after `destroy()`.
- Deployment checklist updated with leak detection step for QA.

**Validation**
- Automated: extend existing physics unit tests (or add new) verifying `destroy()` is invoked.
- Manual: run chrome tracing with repeated reload scenario and confirm no monotonic growth.

## 4. Collision Filter Hot-Reloading

**Context**: `Controller` and `Collider` nodes currently require full rebuilds when updating filter groups, preventing responsive collision debugging.

**Goals**
- Introduce API for editing `PxFilterData` in place and propagate changes to the underlying actors.
- Update builder UI to surface live filter edits with safe defaults.
- Document expected filter matrices for core game archetypes (player, NPC, projectile, world).

**Acceptance Criteria**
- Editing filter metadata via scripts or UI updates the active simulation without recreation.
- Regression test exercises filter updates and validates interaction matrix.
- Builder documentation includes troubleshooting section for collision debugging.

**Validation**
- Automated: add integration test that adjusts filter groups mid-simulation.
- Manual: QA scenario toggles projectile collision groups live and confirms runtime effect.

## 5. Runtime Loader Naming & Documentation Cleanup

**Status**: ✅ Completed in this sweep – `ClientLoader` became `BrowserLoader` and `ServerLoader` became `NodeLoader`, with dependent worlds importing the new names.

**Context**: `createNodeClientWorld` registers `ServerLoader` terminology that no longer matches runtime behaviour, confusing new contributors reviewing deployment scripts.

**Goals**
- Rename loader implementations to `BrowserLoader` and `NodeLoader`, reflecting their actual execution environments.
- Update docs (`DOCKER.md`, deployment runbooks) to match the new naming.
- Ensure CLI output and logs use consistent terminology.

**Acceptance Criteria**
- Code references the new names without dead imports. ✅
- Documentation and scripts reflect the updated naming. ✅
- Smoke test `npm run dev` and server boot logs show the new loader names.

**Validation**
- Automated: run lint/type checks to confirm no stale references.
- Manual: start dev server and verify loader logs.

## 6. Stats HUD Telemetry Theming

**Context**: The stats overlay renders WebGPU analytics in yellow—the same colour used for WebGL metrics—making it hard to distinguish contexts during mixed-mode profiling.

**Goals**
- Introduce palette tokens for telemetry lines and assign unique colour per backend.
- Provide HUD setting or query param to toggle palette for accessibility.
- Document colour assignments and accessibility notes in builder documentation.

**Acceptance Criteria**
- Stats overlay differentiates WebGL vs WebGPU metrics by colour with accessible contrast ratios.
- Configuration option persists between sessions.
- Documentation updated with palette and usage instructions.

**Validation**
- Automated: screenshot test verifying colour assignments against WCAG contrast thresholds.
- Manual: toggle telemetry settings in dev build and confirm persistence via reload.

---

### Cross-Cutting Requirements

- Update `docs/mmorpg-task-breakdown.md` checklist item 6.1 once these tasks are complete.
- Ensure new regression tests are wired into `npm test` and CI pipelines.
- Record changelog entries summarising feature readiness for the next roadmap review.

### Suggested Sequencing

1. Avatar pipeline consolidation (unblocks emote + instanced mesh validation).
2. Physics teardown fixes (stability guardrail before broader feature work).
3. Loader rename + docs (low risk, reduces contributor confusion).
4. Collision filter hot-reloading (supports combat/system prototyping).
5. GLTF instanced skinned mesh support (heavy lift, schedule after leak fixes).
6. Stats HUD theming (polish task aligned with tooling updates).

Tracking spreadsheet: https://short.hyperfy.dev/todo-roadmap-2024-10 (create and populate during sprint planning).
