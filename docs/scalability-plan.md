# Scalability Targets and Parallel Simulation Research

This document formalizes realistic performance goals for Hyperfy's large-scale simulations, reports on backend and orchestration
investigations, summarizes prototype benchmarks, and connects the findings to the limitations previously documented in
`docs/DEPLOYMENT_STATUS.md`.

## 1. Realistic Scalability Targets

| Category | Goal | Notes |
| --- | --- | --- |
| Concurrent users per shard | 2,000 active clients (4,000 warm standby connections) | Aligns with WebSocket fan-out limits and LiveKit relay capacity while keeping per-zone replication manageable. |
| Global concurrency | 50,000 players across a 24-zone cluster | Requires horizontal scaling with deterministic sharding and cross-zone replication. |
| Dynamic entities per shard | 20,000 simulated actors (AI + avatars) | Active set that participates in full physics/network replication. |
| Background/static entities | 150,000 world objects streamed via interest management | Streamed progressively with hierarchical LOD and content baking. |
| Simulation tick budget | 16.67 ms (60 Hz) authoritative tick; 4 ms reserved for spatial queries; 6 ms for AI/skills; 6 ms for replication | Leaves headroom for GC and platform jitter. |
| Frame budget (client) | 11 ms rendering, 3 ms scripting, 2 ms resource streaming | Designed for 90 FPS VR fallback to 60 FPS 2D. |
| Storage throughput | 500 MB/s asset egress per shard | Supports high-resolution PBR textures with CDN edge caching. |
| Network budget | 256 Kbit/s per client avg, 1.5 Mbit/s burst | Matches WebRTC uplink in constrained networks while allowing voice + state sync. |

Key implications:

- Workloads scale approximately with active entities; O(1) guarantees for world updates remain mathematically impossible, as noted in
  the deployment status assessment.【F:docs/DEPLOYMENT_STATUS.md†L31-L47】
- Budgets are framed to allow gradual degradation (interest management, adaptive LOD) rather than unrealistic constant-time operations.

## 2. Backend, ECS, and Orchestration Investigation

### WebGPU vs. Native Rendering

- **WebGPU** unlocks compute passes for GPU-driven culling, skinning, and light clustering. The investigation identified modern browsers
  and Electron shells as the fastest path to WebGPU adoption while retaining Hyperfy's JavaScript-first workflow.
- **Native backends** (Rust + wgpu, C++ + Vulkan) would enable tighter VRAM control and offline compilation, but require a parallel
  tooling stack and diverge from the current Three.js pipeline. The migration cost outweighs the gains until WebGPU parity gaps are
  closed for advanced features such as bindless textures and ray tracing.

### ECS Partitioning Strategy

- Adopt a **two-tier ECS**: a deterministic authoritative ECS for the server and a thin predictive ECS on the client. Partition
  simulation data by zone + interest group, with spatial layers (grid + loose octree) feeding into the job system prototype.
- Implement **component hotness tiers** (per-tick, per-second, on-demand) to keep cache pressure low and match the tick budgets.

### Worker Threads, Clusters, and Processes

- **Worker threads** in Node.js handle sub-millisecond per-tick work for 20K entities when fed contiguous memory blocks, as evidenced by
  the job system benchmark below.【F:scripts/simulation-benchmarks.mjs†L108-L180】【215214†L1-L12】
- **Process clusters** remain necessary for isolating shards and physics-heavy zones; gRPC or Bun workers can bridge WebSocket ingress
  to compute nodes.
- **Edge workers / CDN compute** are earmarked for read-mostly queries (matchmaking, inventory) to keep latency-sensitive simulation
  threads focused on entity updates.

## 3. Prototype Benchmarks

The `scripts/simulation-benchmarks.mjs` script prototypes spatial partitioning, job scheduling, and a lock-free queue built on
`SharedArrayBuffer` + `Atomics`.【F:scripts/simulation-benchmarks.mjs†L1-L220】 Default runs target 50K entities, four worker threads,
60 ticks, and a queue of 1,024 slots. The resulting measurements are:

| Prototype | Goal Budget | Result | Status |
| --- | --- | --- | --- |
| Spatial grid build + neighborhood query | ≤ 12 ms per tick | 84.14 ms per run (1.36 ms per 1K entities) | Needs SIMD/tiling optimizations and per-zone decomposition. |
| Worker-thread job system | ≤ 16.67 ms per tick | 1.88 ms per tick (113.05 ms over 60 ticks) | Meets target; next step is integrating with authoritative ECS messaging. |
| Lock-free queue throughput | ≤ 16 ms for 200K jobs | 107.28 ms (1.86 M ops/s) | Requires batching and per-core queues to satisfy target throughput. |

Configuration used for the benchmark run is embedded in the script output for reproducibility.【215214†L1-L12】

## 4. Trade-offs and Relation to Impossibility Results

- The prototypes confirm the earlier conclusion: eliminating entity count dependence is not feasible; optimizations must aim for
  amortized sub-linear access while keeping workloads within defined tick budgets.【F:docs/DEPLOYMENT_STATUS.md†L31-L47】
- WebGPU-native hybrids introduce deployment complexity; sticking with the browser stack keeps parity with existing Hyperfy tooling at
  the cost of delayed access to advanced GPU features.
- Queue contention and partition rebuilds are the dominant gaps to meeting the stated goals; they motivate further research into
  batched command buffers and GPU-accelerated broadphase queries.

## 5. Next Actions

1. Integrate the job system prototype with real ECS data to validate serialization and replication costs.
2. Replace the prototype spatial grid with a Morton-coded loose quadtree and benchmark per-zone builds.
3. Convert the lock-free queue into sharded ring buffers with cooperative scheduling to reach the 16 ms goal.
4. Establish CI perf harnesses that run the benchmarks on representative hardware to track regressions.
