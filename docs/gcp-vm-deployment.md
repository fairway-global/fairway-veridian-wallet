# GCP VM Deployment (Nginx + Blue/Green + Observability)

This deployment path uses:
- `main` -> auto deploy to **production**
- `staging` -> auto deploy to **staging**
- Separate VM/domain/secrets/DB per environment

## Stage 0: Prerequisites

- Static IP attached to each VM.
- DNS A records for each environment domain:
  - `keria`, `keria-ext`, `keria-boot`, `cred-issuance`, `cred-issuance-ui`, `witness-0..5`
- Firewall open for VM: TCP `22`, `80`, `443`.

## Stage 1: Optional hard reset (clean slate)

Destructive VM reset (keeps VM + static IP only):

```bash
cd /opt/veridian/repo
./infra/deploy/scripts/reset-vm.sh WIPE_EVERYTHING <base-domain>
```

Cloud DNS cleanup helper (only if your DNS is hosted in GCP Cloud DNS):

```bash
./infra/deploy/scripts/reset-dns-clouddns.sh <gcp-project-id> <dns-zone> <base-domain>
```

If your DNS is outside GCP (like cPanel/registrar UI), delete those records manually there.

## Stage 2: VM bootstrap

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git
sudo usermod -aG docker "$USER"
newgrp docker

sudo mkdir -p /opt/veridian
sudo chown -R "$USER":"$USER" /opt/veridian
cd /opt/veridian
git clone https://github.com/<org>/<repo>.git repo
cd repo
chmod +x infra/deploy/scripts/*.sh
```

## Stage 3: TLS + Nginx

Issue certs first:

```bash
./infra/deploy/scripts/bootstrap-certbot.sh admin@your-domain.com <base-domain>
```

Install Nginx routing for environment:

```bash
./infra/deploy/scripts/install-nginx-config.sh production <base-domain>
# or
./infra/deploy/scripts/install-nginx-config.sh staging <staging-base-domain>
```

## Stage 4: Observability (local + GCP centralized)

Start local observability stack:

```bash
export GRAFANA_ADMIN_USER=admin
export GRAFANA_ADMIN_PASSWORD='<strong-password>'
docker compose -f infra/observability/docker-compose.observability.yaml up -d
```

Install Google Cloud Ops Agent to stream Docker + Nginx logs to Cloud Logging in near realtime:

```bash
./infra/deploy/scripts/install-gcp-ops-agent.sh
```

Print debug links + real-time log commands:

```bash
./infra/deploy/scripts/print-gcp-debug-links.sh <gcp-project-id> <base-domain>
```

Optional third-party integration (forward logs to Pub/Sub/BigQuery/GCS):

```bash
./infra/deploy/scripts/create-gcp-log-sink.sh <gcp-project-id> veridian-docker-logs <destination>
```

## Stage 5: GitHub secrets and environment separation

Repository-level secrets:
- `GHCR_USERNAME`
- `GHCR_TOKEN`

Staging-only secrets:
- `STAGING_VM_HOST`, `STAGING_VM_USER`, `STAGING_VM_SSH_KEY`
- `STAGING_PUBLIC_DOMAIN`
- `STAGING_DATABASE_URL`
- `STAGING_KERIA_PASSCODE`
- `STAGING_JWT_ACCESS_SECRET`, `STAGING_JWT_REFRESH_SECRET`
- `STAGING_GATEWAY_JWT_SECRET`, `STAGING_BRAN_ENCRYPTION_KEY`
- `STAGING_GCP_PROJECT_ID` (optional, for debug links in CI logs)

Production-only secrets:
- `PROD_VM_HOST`, `PROD_VM_USER`, `PROD_VM_SSH_KEY`
- `PROD_PUBLIC_DOMAIN`
- `PROD_DATABASE_URL`
- `PROD_KERIA_PASSCODE`
- `PROD_JWT_ACCESS_SECRET`, `PROD_JWT_REFRESH_SECRET`
- `PROD_GATEWAY_JWT_SECRET`, `PROD_BRAN_ENCRYPTION_KEY`
- `PROD_GCP_PROJECT_ID` (optional, for debug links in CI logs)

Do **not** reuse DB URLs or domains between staging and production.

## Stage 6: CI/CD behavior

- Push to `staging` branch: triggers `.github/workflows/deploy-staging.yaml`
- Push to `main` branch: triggers `.github/workflows/deploy-prod.yaml`

Manual deploy is also available via workflow_dispatch.

## Stage 7: Deploy and verify

First deploy:

```bash
# From GitHub Actions: deploy-staging or deploy-prod
# release_sha should match existing image tags in GHCR
```

On VM, verify logs:

```bash
cd /opt/veridian/repo
./infra/deploy/scripts/logs.sh production active
```

Health checks:

```bash
curl -I https://cred-issuance.<base-domain>/ping
curl -I https://cred-issuance-ui.<base-domain>
curl -I https://keria.<base-domain>
```

## Stage 8: Rollback

```bash
cd /opt/veridian/repo
./infra/deploy/scripts/rollback.sh production auto
# or staging
./infra/deploy/scripts/rollback.sh staging auto
```

## Notes

- Canonical app compose: `docker-compose.production.yaml`
- Legacy Traefik files are deprecated and not used in this path.
