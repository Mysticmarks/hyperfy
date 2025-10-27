# Hyperfy Kubernetes Manifests

These manifests deploy the Fastify API, LiveKit SFU, and authoritative simulation
servers onto a Kubernetes cluster. They assume:

- `cert-manager` manages TLS certificates via the `letsencrypt-production` ClusterIssuer
- `external-secrets` synchronises Secrets Manager entries into namespace-scoped Secrets
- `metrics-server` is available so HPAs can react to CPU and memory load

Apply manifests in the following order after adjusting hostnames and secret references:

```bash
kubectl apply -f namespaces.yaml
kubectl apply -f secretstores.yaml   # if you need the example AWS SecretStore
kubectl apply -f fastify-api.yaml
kubectl apply -f livekit.yaml
kubectl apply -f simulation.yaml
kubectl apply -f ingress.yaml
```

The resources expose:

- Liveness and readiness probes hitting `/healthz` (or `/status` for LiveKit)
- Autoscaling rules targeting 60% CPU / 70% memory
- Pod disruption budgets to maintain quorum during rollouts
- TLS termination through an NGINX ingress with HTTP/2 and WebSocket upgrades enabled
