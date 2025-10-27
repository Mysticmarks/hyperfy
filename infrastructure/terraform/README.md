# Hyperfy Terraform Stack

This stack provisions the core infrastructure required for a production-grade Hyperfy
deployment. It targets AWS Fargate/ECS for compute, Aurora Postgres for the persistent
database, CloudFront/S3 for asset delivery, and dedicated Auto Scaling services for
LiveKit and the authoritative simulation servers.

## Layout

```
infrastructure/terraform
├── main.tf               # Entry point wiring the modules together
├── outputs.tf            # Exported connection details
├── providers.tf          # Required providers and authentication options
├── variables.tf          # Input variables shared across modules
└── modules/
    ├── container_service # Generic ECS/Fargate service module (Fastify, LiveKit, Sim)
    ├── network           # VPC, subnets, and security groups
    ├── database          # Aurora PostgreSQL cluster
    └── cdn               # S3 bucket with CloudFront distribution
```

Each service module expects secrets to live in AWS Secrets Manager; the references
line up with the environment overlays in `config/environments`. Container definitions
consume these secrets at runtime using the native ECS `valueFrom` mechanism.

## Usage

```bash
terraform init
terraform plan \
  -var project=hyperfy \
  -var aws_region=us-east-1 \
  -var domain=hyperfy.example \
  -var fastify_image="ghcr.io/hyperfy-xyz/hyperfy:latest" \
  -var livekit_image="ghcr.io/hyperfy-xyz/hyperfy-livekit:latest" \
  -var sim_image="ghcr.io/hyperfy-xyz/hyperfy-sim:latest"
terraform apply
```

After apply succeeds you will receive:

- The VPC, subnets, and security groups for the cluster
- TLS-terminated load balancers for the API, LiveKit, and authoritative simulation tier
- An Aurora PostgreSQL cluster with connectivity restricted to the VPC
- An S3 bucket and CloudFront distribution ready for CDN asset pushes

Use the exported outputs to wire secrets into the Kubernetes/Nomad manifests or the
GitHub Actions deployment workflows.
