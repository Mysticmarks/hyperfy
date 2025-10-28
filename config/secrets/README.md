# Secrets Inventory

The `inventory.yaml` file captures every managed secret that Hyperfy expects
for each environment. The drift audit (`npm run ops:secrets`) compares the
inventory against the environment overlays in `config/environments/*.yaml`
to guarantee that:

1. Each secret referenced by an overlay is documented with an owner,
   description, and managed location.
2. Every secret field in the inventory is actually consumed by the runtime so
   unused credentials are flagged.
3. Missing or renamed secrets are surfaced before rollout so operators can
   remediate drift in the underlying secrets manager.

The inventory intentionally omits the secret values. Instead, it records the
provider (for example Doppler or AWS Secrets Manager), the secret identifier,
and the expected fields. At deploy time, automation pulls the real values from
the configured provider.

When new secrets are introduced:

- Update the relevant overlay in `config/environments/`.
- Add the provider/identifier entry plus any required fields to
  `inventory.yaml`.
- Run `npm run ops:secrets` to confirm the overlays and inventory stay in
  sync.
