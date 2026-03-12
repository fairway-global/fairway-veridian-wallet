# GCP VM Deployment (Nginx + Blue/Green + Observability)

This repository now includes an operational deployment stack for Veridian with:
- Nginx + Certbot TLS termination
- Blue/green deployment slots on each VM
- Self-hosted observability (Loki, Promtail, Prometheus, Grafana, cAdvisor, node-exporter, blackbox-exporter)
- GitHub Actions deployment pipelines (`deploy-staging`, `deploy-prod`)

## 1) Prepare each VM

Install Docker, Docker Compose plugin, Nginx, and Certbot.

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo usermod -aG docker "$USER"
```

Reconnect your shell after adding your user to the `docker` group.

## 2) DNS records

Create A records for the VM static IP:
- `keria.<domain>`
- `keria-ext.<domain>`
- `keria-boot.<domain>`
- `cred-issuance.<domain>`
- `cred-issuance-ui.<domain>`
- `witness-0.<domain>` ... `witness-5.<domain>`

## 3) Copy env contract file on VM

Create `infra/deploy/env/production.env` (or `staging.env`) from the corresponding `*.env.example`.

```bash
cp infra/deploy/env/production.env.example infra/deploy/env/production.env
```

Fill all required secrets and database settings.

## 4) Bootstrap TLS certificate first

```bash
./infra/deploy/scripts/bootstrap-certbot.sh admin@example.com example.com
```

## 5) Install Nginx config

```bash
./infra/deploy/scripts/install-nginx-config.sh production example.com
```

## 6) Start observability stack

```bash
docker compose -f infra/observability/docker-compose.observability.yaml up -d
```

Update `infra/observability/prometheus/targets/veridian-targets.yml` with your real domains if they differ from defaults.

## 7) Deploy application release

Promote to inactive slot and switch traffic atomically:

```bash
./infra/deploy/scripts/deploy.sh \
  --environment production \
  --release-sha <image-tag-or-git-sha> \
  --target-slot auto \
  --action promote
```

Rollback switch:

```bash
./infra/deploy/scripts/rollback.sh production auto
```

## 8) Logs and operations

Follow active slot logs:

```bash
./infra/deploy/scripts/logs.sh production active
```

Follow a specific service:

```bash
./infra/deploy/scripts/logs.sh production active cred-issuance
```

Renewal test:

```bash
sudo certbot renew --dry-run
```

Backup slot volumes:

```bash
./infra/deploy/scripts/backup-slot-volumes.sh production active /var/backups/veridian
```

## 9) CI/CD secret contract

Repository-level secrets:
- `GHCR_USERNAME`
- `GHCR_TOKEN`

Staging secrets:
- `STAGING_VM_HOST`
- `STAGING_VM_USER`
- `STAGING_VM_SSH_KEY`
- `STAGING_PUBLIC_DOMAIN`
- `STAGING_KERIA_PASSCODE`
- `STAGING_DATABASE_URL`
- `STAGING_JWT_ACCESS_SECRET`
- `STAGING_JWT_REFRESH_SECRET`
- `STAGING_GATEWAY_JWT_SECRET`
- `STAGING_BRAN_ENCRYPTION_KEY`

Production secrets:
- `PROD_VM_HOST`
- `PROD_VM_USER`
- `PROD_VM_SSH_KEY`
- `PROD_PUBLIC_DOMAIN`
- `PROD_KERIA_PASSCODE`
- `PROD_DATABASE_URL`
- `PROD_JWT_ACCESS_SECRET`
- `PROD_JWT_REFRESH_SECRET`
- `PROD_GATEWAY_JWT_SECRET`
- `PROD_BRAN_ENCRYPTION_KEY`

## Notes

- Canonical production compose file: `docker-compose.production.yaml`
- Legacy Traefik-based compose files are preserved for reference only and are not part of this deployment path.
- Cardano-backed witness mode is intentionally out of scope for this v1 deployment stack.
