# Hyperfy Pulumi Stack

The Pulumi program mirrors the Terraform baseline using TypeScript. It provisions:

- A VPC with public and private subnets
- An ECS/Fargate cluster for the Fastify API, LiveKit, and authoritative simulation services
- An Aurora PostgreSQL database with the password stored in Secrets Manager
- An S3 bucket + CloudFront CDN for world assets

Configuration is managed through Pulumi config entries that map to the managed secrets
referenced in `config/environments`. Example configuration (dev stack):

```bash
cd infrastructure/pulumi
npm install
pulumi stack init dev
pulumi config set aws:region us-east-1
pulumi config set hyperfy:domain hyperfy.example
pulumi config set hyperfy:fastifyImage ghcr.io/hyperfy-xyz/hyperfy:latest
pulumi config set hyperfy:livekitImage ghcr.io/hyperfy-xyz/hyperfy-livekit:latest
pulumi config set hyperfy:simImage ghcr.io/hyperfy-xyz/hyperfy-sim:latest
pulumi config set --secret hyperfy:fastifySecrets '{"FASTIFY_JWT_SECRET":"arn:aws:secretsmanager:..."}'
pulumi config set --secret hyperfy:livekitSecrets '{"LIVEKIT_API_KEY":"arn:aws:secretsmanager:..."}'
pulumi config set --secret hyperfy:simSecrets '{"SIM_CLUSTER_TOKEN":"arn:aws:secretsmanager:..."}'
pulumi config set hyperfy:apiCertificateArn arn:aws:acm:...
pulumi config set hyperfy:livekitCertificateArn arn:aws:acm:...
pulumi config set hyperfy:simCertificateArn arn:aws:acm:...
pulumi config set hyperfy:cdnCertificateArn arn:aws:acm:...
pulumi config set hyperfy:databaseUsername hyperfy_admin
pulumi up
```

Secrets should be stored using Pulumi's encrypted config (`--secret`) or a backend like
AWS KMS. The resulting outputs surface the same values as Terraform for downstream tooling.
