# Hyperfy ⚡️

[![CI](https://github.com/hyperfy-xyz/hyperfy/actions/workflows/ci.yml/badge.svg)](https://github.com/hyperfy-xyz/hyperfy/actions/workflows/ci.yml)

<div align="center">
  <img src="overview.png" alt="Hyperfy Ecosystem" width="100%" />
  <p>
    <strong>Build, deploy, and experience interactive 3D virtual worlds</strong>
  </p>
</div>

## What is Hyperfy?

Hyperfy is an open-source framework for building interactive 3D virtual worlds. It combines a powerful physics engine, networked real-time collaboration, and a component-based application system to create immersive experiences that can be self-hosted or connected to the wider Hyperfy ecosystem.

## 🧬 Key Features

- **Standalone persistent worlds** - Host on your own domain
- **Realtime content creation** - Build directly in-world
- **Interactive app system** - Create dynamic applications with JavaScript
- **Portable avatars** - Connect via Hyperfy for consistent identity
- **Physics-based interactions** - Built on PhysX for realistic simulation
- **WebXR support** - Experience worlds in VR
- **Extensible architecture** - Highly customizable for various use cases

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hyperfy-xyz/hyperfy)

## 🚀 Quick Start

### Prerequisites

- Node.js 22.11.0+ (via [nvm](https://github.com/nvm-sh/nvm) or direct install)

### Installation

```bash
# Clone the repository
git clone https://github.com/hyperfy-xyz/hyperfy.git my-world
cd my-world

# Install dependencies
npm install

# Configure secrets (Vault/Doppler/AWS SM) according to config/environments/development.yaml
# and expose them before starting the dev server
export HYPERFY_ENVIRONMENT=development
# Example: doppler run -- npm run dev
npm run dev
```

### Docker Deployment

For containerized deployment, check [DOCKER.md](DOCKER.md) for detailed instructions.

### Environment overlays & managed secrets

Hyperfy no longer reads `.env` files. Instead, each environment is described in
`config/environments/<name>.yaml`, which maps every variable to a managed secret
or static value. Export `HYPERFY_ENVIRONMENT=<name>` before starting the server so
`src/server/environment/load-overlay.js` can hydrate defaults, then rely on your
secret store (Vault, AWS Secrets Manager, Doppler, etc.) to inject the sensitive
values. See [docs/deployment/rollout.md](docs/deployment/rollout.md) for rollout
and rollback steps.

## 🤖 Automation Agent

Hyperfy ships with a headless agent (`agent.mjs`) that can connect to a world, simulate
basic avatar movement, and send chat messages. This is useful for smoke testing a new
deployment, building automated demos, or populating a world with scripted behaviour.

### Running the agent

```bash
node agent.mjs --ws-url ws://localhost:3000/ws --name "Bot"
```

Use CLI flags or environment variables to tailor the behaviour:

| Capability | CLI flags | Environment variables |
| --- | --- | --- |
| Target world | `--ws-url`, `--name`, `--avatar` | `HYPERFY_AGENT_WS_URL`, `HYPERFY_AGENT_NAME`, `HYPERFY_AGENT_AVATAR` |
| Movement | `--move-mode`, `--no-move`,<br>`--keys`, `--interval`, `--press-probability`, `--max-active` | `HYPERFY_AGENT_MOVE_MODE`, `HYPERFY_AGENT_MOVE_ENABLED`,<br>`HYPERFY_AGENT_WANDER_KEYS`, `HYPERFY_AGENT_WANDER_INTERVAL_MS`, `HYPERFY_AGENT_WANDER_PRESS_PROBABILITY`, `HYPERFY_AGENT_WANDER_MAX_ACTIVE` |
| Chat | `--no-chat`, `--chat-message`,<br>`--chat-delay`, `--chat-repeat` | `HYPERFY_AGENT_CHAT_ENABLED`, `HYPERFY_AGENT_CHAT_MESSAGE`,<br>`HYPERFY_AGENT_CHAT_DELAY_MS`, `HYPERFY_AGENT_CHAT_REPEAT_MS` |
| Resilience | `--auto-reconnect`, `--reconnect-delay` | `HYPERFY_AGENT_AUTO_RECONNECT`, `HYPERFY_AGENT_RECONNECT_DELAY_MS` |
| Logging | `--silent`, `--verbose` | `HYPERFY_AGENT_VERBOSE` |

All timing arguments accept milliseconds. The default movement mode is `wander`, which
randomly toggles the configured control keys. Set `--move-mode idle` or `--no-move` to
disable locomotion while keeping chat automation enabled.

Example: keep a lightweight greeter active in a production lobby:

```bash
HYPERFY_AGENT_WS_URL=wss://my-world.example/ws \
node agent.mjs \
  --name "Lobby Guide" \
  --chat-message "Welcome! Let me know if you need help." \
  --chat-repeat 15000 \
  --keys keyW,keyA,keyS,keyD \
  --max-active 1
```

## 🧩 Use Cases

- **Virtual Events & Conferences** - Host live gatherings with spatial audio
- **Interactive Showrooms** - Create product displays and demos
- **Social Spaces** - Build community hubs for collaboration
- **Gaming Environments** - Design immersive game worlds
- **Educational Experiences** - Develop interactive learning spaces
- **Creative Showcases** - Display 3D art and interactive installations

## 📚 Documentation & Resources

- **[Community Documentation](https://docs.hyperfy.xyz)** - Comprehensive guides and reference
- **[Website](https://hyperfy.io/)** - Official Hyperfy website
- **[Sandbox](https://play.hyperfy.xyz/)** - Try Hyperfy in your browser
- **[Twitter/X](https://x.com/hyperfy_io)** - Latest updates and announcements
- **[Production Deployment Checklist](docs/deployment/checklist.md)** - Operational hardening requirements for self-hosting
- **[Hardening Plan](docs/roadmap/hardening-plan.md)** - Milestones for deployment, testing, and UX upgrades
- **[System Requirements Document](docs/system/system-requirements-document.md)** - Mission, architecture, and platform constraints
- **[System Roadmap & Scope Register](docs/roadmap/system-roadmap.md)** - Subsystem maturity map and upcoming initiatives
- **[Iteration Log](docs/iteration-log.md)** - Chronological record of autonomous improvement cycles

## 🏗️ Architecture at a Glance

Hyperfy is composed of modular subsystems that collaborate through Fastify HTTP/WebSocket services and a shared world runtime:

- **Server Runtime (`src/server`)** — Fastify services, environment overlays, storage adapters, and LiveKit integration.
- **World Simulation (`src/world`)** — Deterministic tick loop, physics pipelines, entity/component systems, and scripting sandboxing.
- **Clients (`src/client`, `src/node-client`)** — Browser and Node runtimes built on React, Firebolt JSX, and Three.js.
- **Tooling & Automation (`scripts`, `agent.mjs`)** — Build, diagnostics, deployment utilities, and programmable agents.
- **Shared Core (`src/core`)** — SES lockdown, foundational utilities, and schemas shared across runtimes.

See the [System Requirements Document](docs/system/system-requirements-document.md) for a full description of interfaces, dependencies, and success metrics.

## 📏 Project Structure

```
docs/              - Documentation and references
src/
  client/          - Client-side code and components
  core/            - Core systems (physics, networking, entities)
  server/          - Server implementation
CHANGELOG.md       - Version history and changes
```

## 🛠️ Development

### Key Commands

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Clean orphaned assets (experimental)
npm run world:clean

# Viewer only (development)
npm run viewer:dev

# Client only (development)
npm run client:dev

# Linting
npm run lint
npm run lint:fix
```

## 🖊️ Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md) before getting started.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

## 🌱 Project Status

This project is still in alpha as we transition all of our [reference platform](https://github.com/hyperfy-xyz/hyperfy-ref) code into fully self hostable worlds.
Most features are already here in this repo but still need to be connected up to work with self hosting in mind.
Note that APIs are highly likely to change during this time.
