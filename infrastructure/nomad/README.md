# Hyperfy Nomad Jobs

These Nomad job files run the Hyperfy stack on a HashiCorp Nomad cluster with Consul
service discovery and Vault-backed secrets. Each job definition includes:

- `check` blocks for HTTP/TCPS liveness and readiness
- Autoscaling policies driven by Nomad's native application autoscaler (AAS)
- TLS termination via Fabio or Traefik (depending on deployment) with certificates sourced from Vault

Apply the jobs with `nomad job run <jobfile>` after updating the placeholders for images,
Vault paths, and hostnames.
