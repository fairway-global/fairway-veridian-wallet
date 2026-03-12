#!/usr/bin/env bash
set -euo pipefail

CONFIRM="${1:-}"
DOMAIN="${2:-}"

if [[ "$CONFIRM" != "WIPE_EVERYTHING" ]]; then
  cat >&2 <<USAGE
Usage: $0 WIPE_EVERYTHING [public-domain]

WARNING: This is destructive.
It removes Veridian app/observability containers, volumes, images, state, Nginx Veridian configs,
and optionally TLS certs for the provided domain.
USAGE
  exit 1
fi

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

REPO_DIR="/opt/veridian/repo"
STATE_DIR="/opt/veridian/state"
APP_COMPOSE="${REPO_DIR}/docker-compose.production.yaml"
OBS_COMPOSE="${REPO_DIR}/infra/observability/docker-compose.observability.yaml"

# Bring down known compose projects if they exist.
for env in production staging; do
  for slot in blue green; do
    env_file="${STATE_DIR}/${env}/generated-env/${slot}.env"
    if [[ -f "$APP_COMPOSE" && -f "$env_file" ]]; then
      docker compose -f "$APP_COMPOSE" --env-file "$env_file" -p "veridian-${env}-${slot}" down -v --remove-orphans || true
    fi
  done
done

if [[ -f "$OBS_COMPOSE" ]]; then
  docker compose -f "$OBS_COMPOSE" down -v --remove-orphans || true
fi

# Remove all containers/volumes/images/build cache from the VM.
docker ps -aq | xargs -r docker rm -f || true
docker volume ls -q | xargs -r docker volume rm -f || true
docker image prune -af || true
docker builder prune -af || true
docker network prune -f || true

# Remove Veridian-specific files and runtime state.
as_root rm -rf /opt/veridian
as_root rm -f /etc/nginx/sites-enabled/veridian-*.conf
as_root rm -f /etc/nginx/sites-available/veridian-*.conf
as_root rm -f /etc/nginx/snippets/veridian_*_active_upstreams.conf

if [[ -n "$DOMAIN" ]]; then
  as_root certbot delete --cert-name "keria.${DOMAIN}" --non-interactive || true
fi

as_root nginx -t >/dev/null 2>&1 && as_root systemctl reload nginx || true

cat <<DONE
VM reset complete.
Remaining resources kept intentionally: VM, static IP, OS packages, system users.
DONE
