# Hyperfy Deployment Rollout & Rollback Guide

This guide standardises how Hyperfy environments are updated and recovered. It pairs
with the Terraform/Pulumi stacks (`infrastructure/terraform`, `infrastructure/pulumi`)
and the Kubernetes/Nomad manifests.

## Prerequisites

1. Secrets replicated into your managed store following `config/environments/<env>.yaml`.
2. Terraform or Pulumi state locked and backed up (Terraform Cloud, S3+DynamoDB, or Pulumi Cloud).
3. Container images published to GHCR via the signed GitHub Actions workflow.
4. Observability sinks reachable (OTLP, Loki/Tempo, Prometheus) for rollback telemetry.

## Rollout Steps

1. **Plan infrastructure changes**
   - `cd infrastructure/terraform && terraform init`
   - `terraform plan -var-file=env/<env>.tfvars` (or `pulumi preview -s <stack>`)
   - Review database, networking, and scaling adjustments before approving.
2. **Apply infrastructure**
   - `terraform apply` (or `pulumi up`) and wait for load balancers, RDS, and Secrets Manager updates.
   - Verify outputs against expected endpoints (`terraform output` / `pulumi stack output`).
3. **Prepare runtime secrets**
   - Ensure ExternalSecret/SecretStore definitions reference the new secret versions.
   - For Nomad, run `vault kv metadata get` to confirm rotation timestamps.
4. **Deploy workloads**
   - Kubernetes: `kubectl apply -f infrastructure/kubernetes/<component>.yaml`.
   - Nomad: `nomad job plan fastify.nomad.hcl` followed by `nomad job run`.
   - Confirm HPAs/autoscaling policies register with metrics backends.
5. **Post-deploy validation**
   - Execute smoke tests: `npm run test:smoke` pointing to the freshly deployed endpoints.
   - Check liveness/readiness probes with `kubectl get pods -w` or `nomad alloc status`.
   - Update `docs/deployment/checklist.md` with the change reference (PR/commit SHA).

## Rollback Steps

1. **Identify the last known-good release**
   - Inspect signed image tags in GHCR and select the previous digest.
   - Record the Terraform/Pulumi state version (Terraform Cloud run ID or Pulumi update).
2. **Restore infrastructure**
   - `terraform apply -refresh-only` (or `pulumi refresh`) to detect drift.
   - `terraform apply -target=module.fastify_api` if only the API needs reverting; otherwise revert the entire stack to the prior state snapshot.
   - For databases, restore from the Aurora automated snapshot (`aws rds restore-db-cluster-from-snapshot`).
3. **Redeploy workloads**
   - Kubernetes: set image back via `kubectl set image deployment/fastify-api fastify-api=ghcr.io/...@sha256:<digest>` then `kubectl rollout undo` if needed.
   - Nomad: `nomad job revert fastify-api -to=<deployment id>`.
4. **Validate recovery**
   - Ensure readiness probes return `200` within SLA and LiveKit publishes telemetry.
   - Run targeted integration tests (`npm run test:integration -- --grep "failover"`).
   - Update incident documentation with timelines, root cause, and preventative actions.

## Operational Tips

- Treat `config/environments/*.yaml` as the source of truth for variable provenance.
- Keep Terraform and Pulumi locked to the same account/region; never mix states.
- Use Git tags (`vX.Y.Z`) to coordinate signed image digests, IaC commits, and rollout notes.
- Document every rotation or rollback in the runbook to satisfy `docs/deployment/checklist.md` section 5.
