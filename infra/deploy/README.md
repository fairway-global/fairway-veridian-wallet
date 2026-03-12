# Deployment Automation

## Key scripts
- `scripts/deploy.sh`: Promote a release to an inactive slot, switch Nginx, and run smoke checks.
- `scripts/rollback.sh`: Switch traffic back to a previous slot.
- `scripts/install-nginx-config.sh`: Install rendered Nginx server blocks and initial slot upstream map.
- `scripts/bootstrap-certbot.sh`: Issue multi-domain TLS certificate and run renewal dry-run.
- `scripts/install-gcp-ops-agent.sh`: Install/configure Google Cloud Ops Agent for centralized VM logs/metrics.
- `scripts/print-gcp-debug-links.sh`: Print Cloud Console links and real-time `gcloud logging tail` commands.
- `scripts/create-gcp-log-sink.sh`: Create/update a Cloud Logging sink for third-party integrations (Pub/Sub, BigQuery, GCS).
- `scripts/logs.sh`: Tail logs for active slot or specific slot/service.
- `scripts/backup-slot-volumes.sh`: Backup slot-specific Docker volumes.
- `scripts/restore-slot-volume.sh`: Restore a single slot volume from an archive.
- `scripts/reset-vm.sh`: Destructive reset to wipe all deployment runtime state from a VM.
- `scripts/reset-dns-clouddns.sh`: Delete Veridian DNS A records from a GCP Cloud DNS zone.

## Environment files
Place runtime env files on the VM:
- `infra/deploy/env/staging.env`
- `infra/deploy/env/production.env`

Start from `*.env.example` and never commit real secrets.
