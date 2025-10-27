#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import process from 'node:process';

const defaultConfig = {
  entities: 50000,
  areaSize: 2048,
  cellSize: 16,
  ticks: 60,
  tickDuration: 16.67,
  workers: Math.max(1, Math.min(8, (process.env.HYPERFY_BENCH_WORKERS && Number.parseInt(process.env.HYPERFY_BENCH_WORKERS, 10)) || (typeof navigator === 'undefined' ? 4 : navigator.hardwareConcurrency))),
  queueSize: 1024,
  queueIterations: 200000,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...defaultConfig };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!value) break;
    switch (key) {
      case '--entities':
        config.entities = Number.parseInt(value, 10);
        break;
      case '--ticks':
        config.ticks = Number.parseInt(value, 10);
        break;
      case '--tick-duration':
        config.tickDuration = Number.parseFloat(value);
        break;
      case '--workers':
        config.workers = Number.parseInt(value, 10);
        break;
      case '--cell-size':
        config.cellSize = Number.parseFloat(value);
        break;
      case '--area-size':
        config.areaSize = Number.parseFloat(value);
        break;
      case '--queue-size':
        config.queueSize = Number.parseInt(value, 10);
        break;
      case '--queue-iterations':
        config.queueIterations = Number.parseInt(value, 10);
        break;
      default:
        break;
    }
  }
  return config;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function runSpatialPartitionPrototype({ entities, areaSize, cellSize }) {
  const rand = seededRandom(1337);
  const positions = new Float32Array(entities * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = rand() * areaSize;
    positions[i + 1] = rand() * areaSize;
    positions[i + 2] = rand() * areaSize;
  }

  const cellsPerAxis = Math.ceil(areaSize / cellSize);
  const cellCount = cellsPerAxis * cellsPerAxis;
  const cellHeads = new Int32Array(cellCount).fill(-1);
  const next = new Int32Array(entities).fill(-1);
  const invCellSize = 1 / cellSize;

  const start = performance.now();
  for (let entity = 0; entity < entities; entity += 1) {
    const x = positions[entity * 3];
    const z = positions[entity * 3 + 2];
    const cx = Math.min(cellsPerAxis - 1, Math.max(0, Math.floor(x * invCellSize)));
    const cz = Math.min(cellsPerAxis - 1, Math.max(0, Math.floor(z * invCellSize)));
    const cellIndex = cx + cz * cellsPerAxis;
    next[entity] = cellHeads[cellIndex];
    cellHeads[cellIndex] = entity;
  }

  let neighborhoodChecks = 0;
  let totalNeighbors = 0;
  const neighborOffsets = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      neighborOffsets.push([dx, dz]);
    }
  }

  for (let entity = 0; entity < entities; entity += 1) {
    const x = positions[entity * 3];
    const z = positions[entity * 3 + 2];
    const cx = Math.min(cellsPerAxis - 1, Math.max(0, Math.floor(x * invCellSize)));
    const cz = Math.min(cellsPerAxis - 1, Math.max(0, Math.floor(z * invCellSize)));
    for (const [dx, dz] of neighborOffsets) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= cellsPerAxis || nz >= cellsPerAxis) {
        continue;
      }
      const neighborCell = nx + nz * cellsPerAxis;
      let current = cellHeads[neighborCell];
      while (current !== -1) {
        if (current !== entity) {
          const ox = positions[current * 3];
          const oz = positions[current * 3 + 2];
          const dxPos = ox - x;
          const dzPos = oz - z;
          const distanceSq = dxPos * dxPos + dzPos * dzPos;
          if (distanceSq <= cellSize * cellSize) {
            totalNeighbors += 1;
          }
          neighborhoodChecks += 1;
        }
        current = next[current];
      }
    }
  }
  const elapsed = performance.now() - start;

  return {
    name: 'spatialPartition',
    entities,
    cellSize,
    neighborhoodChecks,
    avgNeighbors: totalNeighbors / entities,
    elapsed,
    targetMs: 12.0,
    withinBudget: elapsed <= 12.0,
  };
}

function spawnWorkers(workerCount, workerDataFactory) {
  return Promise.all(
    Array.from({ length: workerCount }, (_, index) => new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: workerDataFactory(index),
      });
      worker.on('message', resolve);
      worker.on('error', reject);
    })),
  );
}

function runJobSystemPrototype({ entities, ticks, tickDuration, workers }) {
  const actualWorkers = Math.max(1, workers);
  const positionsBuffer = new SharedArrayBuffer(Float64Array.BYTES_PER_ELEMENT * entities * 3);
  const velocitiesBuffer = new SharedArrayBuffer(Float64Array.BYTES_PER_ELEMENT * entities * 3);
  const rand = seededRandom(9001);
  const positions = new Float64Array(positionsBuffer);
  const velocities = new Float64Array(velocitiesBuffer);
  for (let i = 0; i < positions.length; i += 1) {
    positions[i] = rand() * 1024;
    velocities[i] = (rand() - 0.5) * 5;
  }

  const entitiesPerWorker = Math.ceil(entities / actualWorkers);
  const start = performance.now();

  return spawnWorkers(actualWorkers, (workerIndex) => {
    const startEntity = workerIndex * entitiesPerWorker;
    const endEntity = Math.min(entities, startEntity + entitiesPerWorker);
    return {
      mode: 'jobSystem',
      startEntity,
      endEntity,
      ticks,
      tickDuration,
      positionsBuffer,
      velocitiesBuffer,
    };
  }).then((messages) => {
    const elapsed = performance.now() - start;
    const maxWorkerTime = Math.max(...messages.map((msg) => msg.elapsed));
    return {
      name: 'jobSystem',
      entities,
      ticks,
      workers: actualWorkers,
      elapsed,
      maxWorkerTime,
      perTick: maxWorkerTime / ticks,
      targetMs: tickDuration,
      withinBudget: (maxWorkerTime / ticks) <= tickDuration,
    };
  });
}

function runLockFreeQueuePrototype({ queueSize, queueIterations, workers }) {
  const buffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * (queueSize + 3));
  const state = new Int32Array(buffer, 0, 3);
  const data = new Int32Array(buffer, Int32Array.BYTES_PER_ELEMENT * 3);
  state[0] = 0; // head
  state[1] = 0; // tail
  state[2] = 0; // processed

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: {
        mode: 'lockFreeQueue',
        buffer,
        queueSize,
        iterations: queueIterations,
      },
    });

    worker.on('message', (msg) => {
      if (msg.type === 'ready') {
        const start = performance.now();
        for (let i = 0; i < queueIterations; i += 1) {
          let placed = false;
          while (!placed) {
            const head = Atomics.load(state, 0);
            const tail = Atomics.load(state, 1);
            if (((tail + 1) % queueSize) === head) {
              Atomics.wait(state, 1, tail, 1);
              continue;
            }
            if (Atomics.compareExchange(state, 1, tail, (tail + 1) % queueSize) === tail) {
              data[tail] = i;
              Atomics.notify(state, 0, 1);
              placed = true;
            }
          }
        }
        Atomics.store(state, 2, 1);
        Atomics.notify(state, 0, 1);
        worker.once('message', (done) => {
          if (done.type === 'complete') {
            const elapsed = performance.now() - start;
            resolve({
              name: 'lockFreeQueue',
              queueSize,
              iterations: queueIterations,
              elapsed,
              throughput: (queueIterations / (elapsed / 1000)).toFixed(0),
              workers: workers,
              targetMs: 16.0,
              withinBudget: elapsed <= 16.0,
            });
          }
        });
      }
    });

    worker.on('error', reject);
  });
}

async function main() {
  if (!isMainThread) {
    if (workerData.mode === 'jobSystem') {
      const {
        startEntity, endEntity, ticks, tickDuration, positionsBuffer, velocitiesBuffer,
      } = workerData;
      const positions = new Float64Array(positionsBuffer);
      const velocities = new Float64Array(velocitiesBuffer);
      const start = performance.now();
      const dt = tickDuration / 1000;
      for (let tick = 0; tick < ticks; tick += 1) {
        for (let i = startEntity * 3; i < endEntity * 3; i += 3) {
          positions[i] += velocities[i] * dt;
          positions[i + 1] += velocities[i + 1] * dt;
          positions[i + 2] += velocities[i + 2] * dt;
        }
      }
      const elapsed = performance.now() - start;
      parentPort.postMessage({ elapsed });
      return;
    }
    if (workerData.mode === 'lockFreeQueue') {
      const {
        buffer, queueSize, iterations,
      } = workerData;
      const state = new Int32Array(buffer, 0, 3);
      const data = new Int32Array(buffer, Int32Array.BYTES_PER_ELEMENT * 3);
      parentPort.postMessage({ type: 'ready' });
      let consumed = 0;
      while (consumed < iterations) {
        let item = null;
        while (item === null) {
          const head = Atomics.load(state, 0);
          const tail = Atomics.load(state, 1);
          if (head === tail) {
            if (Atomics.load(state, 2) === 1) {
              Atomics.notify(state, 1, 1);
            }
            Atomics.wait(state, 0, head, 1);
            continue;
          }
          const nextHead = (head + 1) % queueSize;
          if (Atomics.compareExchange(state, 0, head, nextHead) === head) {
            item = data[head];
            Atomics.notify(state, 1, 1);
          }
        }
        consumed += 1;
      }
      parentPort.postMessage({ type: 'complete' });
      return;
    }
    throw new Error(`Unsupported worker mode: ${workerData.mode}`);
  }

  const config = parseArgs();
  const spatial = runSpatialPartitionPrototype(config);
  const jobSystem = await runJobSystemPrototype(config);
  const lockFree = await runLockFreeQueuePrototype(config);

  const results = [spatial, jobSystem, lockFree];
  console.table(results.map((result) => ({
    prototype: result.name,
    withinBudget: result.withinBudget,
    elapsedMs: Number(result.elapsed?.toFixed?.(2) ?? result.elapsed.toFixed(2)),
    targetMs: result.targetMs,
    detail: (() => {
      switch (result.name) {
        case 'spatialPartition':
          return `checks=${result.neighborhoodChecks.toLocaleString()} avgNeighbors=${result.avgNeighbors.toFixed(2)}`;
        case 'jobSystem':
          return `workers=${result.workers} maxWorker=${result.maxWorkerTime.toFixed(2)}ms perTick=${result.perTick.toFixed(2)}ms`;
        case 'lockFreeQueue':
          return `queue=${result.queueSize} throughput=${result.throughput}/s`;
        default:
          return '';
      }
    })(),
  })));

  console.log('\nConfiguration:', JSON.stringify(config, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
