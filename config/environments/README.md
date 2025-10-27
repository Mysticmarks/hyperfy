# Environment Overlays

These YAML overlays describe how each Hyperfy environment is configured and where its
secrets originate. They are consumed at runtime by `src/server/environment/load-overlay.js`
when the `HYPERFY_ENVIRONMENT` variable is set.

Each entry inside `variables` documents whether the value is statically defined or
fetched from a managed secrets provider. Static values are injected into `process.env`
when an overlay is loaded, while secrets are represented as `secret://` URIs that
operators resolve at deploy time (for example through Vault agents, Doppler CLI,
or Kubernetes SecretStore CSI drivers).

```yaml
environment: staging
variables:
  - name: FASTIFY_PUBLIC_URL
    source: static
    value: https://api.staging.hyperfy.example
    description: Public API endpoint exposed through the ingress layer.
  - name: LIVEKIT_API_KEY
    source: secret
    provider: aws-secretsmanager
    secret: hyperfy/staging/livekit
    field: api_key
```

To apply an overlay locally:

```bash
export HYPERFY_ENVIRONMENT=development
# inject secrets with your preferred tool, e.g. Doppler or AWS SSM
npm run dev
```

For Kubernetes or Nomad deployments the manifests reference the same environment
variables, so that the overlays, IaC stacks, and runtime configuration stay in sync.
