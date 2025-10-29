# Task Pool Runtime

The task pool runs background jobs inside Node.js worker threads so the main simulation loop stays responsive. This document outlines the concurrency controls that back those workers and how to tune them for different workloads.

## Default Behaviour

The pool eagerly spins up a baseline set of workers on startup (defaulting to the previously fixed size of up to four CPUs) and dispatches registered tasks to those workers. If worker creation fails at boot time the pool drops into inline execution so the system continues to function.

## Adaptive Scaling

To better support bursty MMO workloads the pool can now scale beyond the baseline size. Provide a `maxSize` larger than the `minSize` (or legacy `size`) option and the pool will spawn extra workers whenever the queue depth per busy worker meets the `scaleThreshold` you set. Extra workers are reclaimed once they remain idle for longer than `idleTimeout`.

```js
import { TaskPool } from '#server/runtime/TaskPool.js'

const pool = new TaskPool({
  minSize: 2,
  maxSize: 8,
  scaleThreshold: 1.5,
  idleTimeout: 15_000,
})
```

The example above starts with two workers, grows up to eight during queue spikes, and retires surplus workers after 15 seconds of idleness. All configuration knobs are optional—omitting `maxSize` preserves the original fixed-size behaviour.

## Diagnostics

Call `pool.metrics()` to inspect the live state of the pool:

| Field | Description |
| --- | --- |
| `workers` | Current worker count. |
| `idleWorkers` | Workers waiting for jobs. |
| `pendingJobs` | Jobs queued but not yet assigned. |
| `inFlightJobs` | Jobs currently running in workers. |
| `peakWorkers` | Maximum concurrent workers observed since creation. |
| `inlineFallback` | `true` when the pool is executing tasks inline. |

The new `diagnostics:delay` task handler offers a lightweight way to simulate work in development environments while validating scaling behaviour.

## Operational Notes

* Scaling is opt-in; keep the legacy `size` parameter for deterministic worker counts during soak testing.
* Set `idleTimeout` to `0` to disable worker retirement when you want to pin the pool at peak capacity.
* Inline fallback remains as before: if every worker crashes or the runtime cannot spawn worker threads, the pool keeps serving tasks synchronously so that critical pipelines do not stall.
