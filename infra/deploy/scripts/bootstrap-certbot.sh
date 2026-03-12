#!/usr/bin/env bash
set -euo pipefail

EMAIL="${1:-}"
PUBLIC_DOMAIN="${2:-}"

if [[ -z "$EMAIL" || -z "$PUBLIC_DOMAIN" ]]; then
  echo "Usage: $0 <acme-email> <public-domain>" >&2
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "certbot is not installed" >&2
  exit 1
fi

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

domains=(
  "keria.${PUBLIC_DOMAIN}"
  "keria-ext.${PUBLIC_DOMAIN}"
  "keria-boot.${PUBLIC_DOMAIN}"
  "cred-issuance.${PUBLIC_DOMAIN}"
  "cred-issuance-ui.${PUBLIC_DOMAIN}"
  "witness-0.${PUBLIC_DOMAIN}"
  "witness-1.${PUBLIC_DOMAIN}"
  "witness-2.${PUBLIC_DOMAIN}"
  "witness-3.${PUBLIC_DOMAIN}"
  "witness-4.${PUBLIC_DOMAIN}"
  "witness-5.${PUBLIC_DOMAIN}"
)

domain_args=()
for domain in "${domains[@]}"; do
  domain_args+=("-d" "$domain")
done

as_root certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --preferred-challenges http \
  --pre-hook "systemctl stop nginx" \
  --post-hook "systemctl start nginx" \
  --keep-until-expiring \
  "${domain_args[@]}"

as_root certbot renew --dry-run

echo "TLS certificates issued and renewal dry-run completed for ${PUBLIC_DOMAIN}"
