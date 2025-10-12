# 🐳 Docker Deployment

This guide walks through running Hyperfy with Docker for local development and
production-style deployments.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+ (Docker Desktop or the
  Docker Engine/CLI)
- Optional: [Docker Compose](https://docs.docker.com/compose/) 2.20+ if you
  prefer declarative configuration

## 1. Prepare configuration

Create your environment file before building the image:

```bash
cp .env.example .env
# Edit .env with the values you need (domain, secrets, feature flags, etc.)
```

The runtime expects `DOMAIN`, `PORT`, `ASSETS_DIR`, and public URLs to be
defined. These values can come either from the `.env` file you mount into the
container or from `docker run -e` flags.

## 2. Build the image

```bash
docker build -t hyperfy .
```

You only need to rebuild when dependencies or build tooling change. Code inside
`src/` can be bind-mounted for live editing without rebuilding the image.

## 3. Run the container

```bash
docker run -d -p 3000:3000 \
  -v "$(pwd)/src:/app/src" \
  -v "$(pwd)/world:/app/world" \
  -v "$(pwd)/.env:/app/.env" \
  -e DOMAIN=demo.hyperfy.host \
  -e PORT=3000 \
  -e ASSETS_DIR=/world/assets \
  -e PUBLIC_WS_URL=https://demo.hyperfy.host/ws \
  -e PUBLIC_API_URL=https://demo.hyperfy.host/api \
  -e PUBLIC_ASSETS_URL=https://demo.hyperfy.host/assets \
  --name hyperfy \
  hyperfy
```

This command:

- Runs Hyperfy in detached mode (`-d`) and maps the container’s port 3000 to the
  host
- Mounts local `src/`, `world/`, and `.env` files so code and content updates
  are reflected immediately
- Injects the key environment variables required for public access URLs

Adjust the domain, ports, and URLs to match your deployment target. The
`--name` flag makes it easier to stop or inspect the container later:

```bash
docker logs -f hyperfy
docker stop hyperfy
docker start hyperfy
```

## 4. Updating the running container

If you change dependencies or the Dockerfile itself, rebuild and restart:

```bash
docker build -t hyperfy .
docker stop hyperfy && docker rm hyperfy
# then run the `docker run` command again
```

For source-only tweaks (JavaScript, assets) the bind mounts allow instant
updates without a rebuild.

## Optional: Docker Compose

For more complex setups (databases, multiple services) you can use Docker
Compose. Save the following as `docker-compose.yml` and adjust as needed:

```yaml
services:
  hyperfy:
    build: .
    image: hyperfy
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      DOMAIN: demo.hyperfy.host
      ASSETS_DIR: /world/assets
      PUBLIC_WS_URL: https://demo.hyperfy.host/ws
      PUBLIC_API_URL: https://demo.hyperfy.host/api
      PUBLIC_ASSETS_URL: https://demo.hyperfy.host/assets
    volumes:
      - ./src:/app/src
      - ./world:/app/world
      - ./.env:/app/.env
```

Bring the stack up or down with:

```bash
docker compose up -d
docker compose down
```

## Cleanup

To reclaim disk space after experimenting:

```bash
docker stop hyperfy && docker rm hyperfy
docker image rm hyperfy
docker volume prune
```

The last command removes unused volumes. Skip it if you have other containers
relying on named volumes.
