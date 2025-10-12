# Multi-Zone Server Operations

Hyperfy's server can now host multiple authoritative simulation zones within a single
process. This functionality supports the "Authoritative multi-zone servers" milestone in
the [MMORPG roadmap](./mmorpg-roadmap.md) by allowing isolated persistence and runtime
state per zone while continuing to share the existing asset and collection pipelines.

## Configuration

Set the `WORLD_ZONES` environment variable alongside the existing `WORLD` setting when
booting the server. The value accepts either a JSON array or a comma-separated list.
Each zone definition must include a unique `id`; optional fields provide a user-facing
`label`, a relative `dataDir` for persistence, and a `tickRate` override (updates per
second) that controls both simulation and networking frequency for that zone.

```bash
# minimal comma-separated example
WORLD=my-world \
WORLD_ZONES="lobby,raid-01" \
node src/server/index.js
```

```bash
# JSON configuration with custom persistence folders and tick rates
WORLD=my-world \
WORLD_ZONES='[
  {"id": "lobby", "label": "Public Lobby", "tickRate": 12},
  {"id": "raid", "label": "Raid Instance", "dataDir": "zones/raid", "tickRate": 20}
]' \
node src/server/index.js
```

- When omitted, `WORLD_ZONES` defaults to a single `primary` zone that matches the
  legacy behaviour.
- `dataDir` values are validated to remain inside the repository and are created
  automatically if they do not exist.
- All zones reuse the shared asset pipeline (`/assets`) so existing CDN/CDN cache
  flows continue to work.

### Network tuning

Global environment variables provide coarse-grained control over how each zone replicates
player state:

- `SERVER_NETWORK_INTEREST_RADIUS` defines the distance (in world units) at which player
  updates are treated as high-priority for other clients (default: `120`).
- `SERVER_NETWORK_REPLICATION_BUDGET` limits how many player updates are delivered to a
  single socket each network tick, ensuring hotspots cannot starve other traffic
  (default: `48`).
- `SERVER_NETWORK_THROTTLE_MS` enforces the minimum interval between updates about the
  same player to the same socket, preventing redundant packets (default: `50`).

These knobs combine with each zone's `tickRate` to let operators balance simulation
fidelity against bandwidth usage as populations grow.

## Runtime Behaviour

- Each zone receives a dedicated SQLite database and storage file inside its configured
  `dataDir`, ensuring player inventories and blueprint state do not collide across
  instances.
- The WebSocket handshake accepts an optional `zone` query parameter. When omitted or
  unknown, clients are routed to the default zone.
- Server-side systems expose `world.zoneId` and `world.zoneLabel` to enable
  zone-aware scripting or logging extensions.

## Observability & Operations

Three new HTTP endpoints expose zone health for orchestration and dashboards:

| Endpoint | Description |
| --- | --- |
| `GET /zones` | Lists configured zones, their tick settings, and player counts. |
| `GET /status` | Extends the existing status payload with per-zone connection details. |
| `GET /metrics` | Reports CPU/memory samples and tick counters per zone for monitoring. |

The `GET /health` endpoint also returns a zone summary to aid load balancers that track
instance vitality.

These additions provide the foundation for sharded orchestration, load-aware routing,
and automated monitoring pipelines that are essential for operating an MMORPG-scale
deployment.
