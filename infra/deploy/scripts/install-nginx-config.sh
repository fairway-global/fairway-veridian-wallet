#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

ENVIRONMENT="${1:-}"
PUBLIC_DOMAIN="${2:-}"
CERT_DOMAIN="${3:-}"
INITIAL_SLOT="${4:-blue}"

if [[ -z "$ENVIRONMENT" || -z "$PUBLIC_DOMAIN" ]]; then
  echo "Usage: $0 <environment> <public-domain> [cert-domain] [initial-slot]" >&2
  exit 1
fi

if [[ -z "$CERT_DOMAIN" ]]; then
  CERT_DOMAIN="keria.${PUBLIC_DOMAIN}"
fi

if [[ "$INITIAL_SLOT" != "blue" && "$INITIAL_SLOT" != "green" ]]; then
  echo "Initial slot must be blue or green" >&2
  exit 1
fi

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

TEMPLATE_FILE="${REPO_ROOT}/infra/nginx/templates/veridian.conf.tpl"
if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "Template file missing: $TEMPLATE_FILE" >&2
  exit 1
fi

SITE_AVAILABLE="/etc/nginx/sites-available/veridian-${ENVIRONMENT}.conf"
SITE_ENABLED="/etc/nginx/sites-enabled/veridian-${ENVIRONMENT}.conf"
UPSTREAM_FILE="/etc/nginx/snippets/veridian_${ENVIRONMENT}_active_upstreams.conf"

as_root mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/snippets

rendered_conf="$(mktemp)"
sed \
  -e "s|__ENVIRONMENT__|${ENVIRONMENT}|g" \
  -e "s|__PUBLIC_DOMAIN__|${PUBLIC_DOMAIN}|g" \
  -e "s|__CERT_DOMAIN__|${CERT_DOMAIN}|g" \
  "$TEMPLATE_FILE" > "$rendered_conf"

as_root install -m 644 "$rendered_conf" "$SITE_AVAILABLE"
rm -f "$rendered_conf"
as_root ln -sfn "$SITE_AVAILABLE" "$SITE_ENABLED"

upstream_tmp="$(mktemp)"
"${SCRIPT_DIR}/render-nginx-upstreams.sh" "$INITIAL_SLOT" "$ENVIRONMENT" > "$upstream_tmp"
as_root install -m 644 "$upstream_tmp" "$UPSTREAM_FILE"
rm -f "$upstream_tmp"

as_root nginx -t
as_root nginx -s reload

echo "Installed Nginx config for ${ENVIRONMENT}."
echo "Site file: ${SITE_AVAILABLE}"
echo "Upstream file: ${UPSTREAM_FILE}"
