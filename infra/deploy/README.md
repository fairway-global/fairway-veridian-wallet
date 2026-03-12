# Deployment Automation

## Key scripts
- `scripts/deploy.sh`: Promote a release to an inactive slot, switch Nginx, and run smoke checks.
- `scripts/rollback.sh`: Switch traffic back to a previous slot.
- `scripts/install-nginx-config.sh`: Install rendered Nginx server blocks and initial slot upstream map.
- `scripts/bootstrap-certbot.sh`: Issue multi-domain TLS certificate and run renewal dry-run.
- `scripts/logs.sh`: Tail logs for active slot or specific slot/service.
- `scripts/backup-slot-volumes.sh`: Backup slot-specific Docker volumes.
- `scripts/restore-slot-volume.sh`: Restore a single slot volume from an archive.

## Environment files
Place runtime env files on the VM:
- `infra/deploy/env/staging.env`
- `infra/deploy/env/production.env`

Start from `*.env.example` and never commit real secrets.
