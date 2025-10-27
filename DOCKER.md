# 🐳 Docker Deployment

This guide walks through running Hyperfy with Docker for local development and
production-style deployments.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+ (Docker Desktop or the
  Docker Engine/CLI)
- Optional: [Docker Compose](https://docs.docker.com/compose/) 2.20+ if you
  prefer declarative configuration

## 1. Prepare configuration

Review `config/environments/production.yaml` (or the overlay matching your target)
and ensure every secret exists in your managed store. Hyperfy reads
`HYPERFY_ENVIRONMENT` to decide which overlay to hydrate and expects the remaining
sensitive values to come from Vault, Doppler, AWS Secrets Manager, etc.

Example using Doppler to inject secrets when running the container:

```bash
doppler run --project hyperfy --config production -- \
  docker run -d -p 3000:3000 \
  -e HYPERFY_ENVIRONMENT=production \
  -e PUBLIC_BASE_URL=https://api.hyperfy.example \
  --name hyperfy \
  hyperfy
```

If you prefer AWS Secrets Manager, generate an env file on the fly:

```bash
docker run -d -p 3000:3000 \
  --env-file <(aws secretsmanager get-secret-value \
    --secret-id hyperfy/production/server \
    --query 'SecretString' --output text | jq -r 'to_entries|map("\(.key)=\(.value)")|.[]') \
  -e HYPERFY_ENVIRONMENT=production \
  --name hyperfy \
  hyperfy
```

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
  -e HYPERFY_ENVIRONMENT=development \
  -e PUBLIC_BASE_URL=http://localhost:3000 \
  -e PUBLIC_WS_URL=ws://localhost:3000/ws \
  -e PUBLIC_ASSETS_URL=http://localhost:3000/assets \
  --name hyperfy \
  hyperfy
```

This command:

- Runs Hyperfy in detached mode (`-d`) and maps the container’s port 3000 to the
  host
- Mounts local `src/` and `world/` directories so code and content updates are
  reflected immediately
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
    environment:
      HYPERFY_ENVIRONMENT: production
      PUBLIC_WS_URL: https://demo.hyperfy.host/ws
      PUBLIC_API_URL: https://demo.hyperfy.host/api
      PUBLIC_ASSETS_URL: https://demo.hyperfy.host/assets
    volumes:
      - ./src:/app/src
      - ./world:/app/world
    secrets:
      - doppler-production
```

Bring the stack up or down with:

```bash
docker compose up -d
docker compose down
```

Where `doppler-production` (or an equivalent secret definition) is declared under
`secrets:` in your Compose file, pointing to a CLI command or file that pulls the
managed secrets at runtime.

## Cleanup

To reclaim disk space after experimenting:

```bash
docker stop hyperfy && docker rm hyperfy
docker image rm hyperfy
docker volume prune
```

The last command removes unused volumes. Skip it if you have other containers
relying on named volumes.
