#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" ]]; then
  echo "Usage: $0 <env-file>" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

required_vars=(
  DEPLOY_ENV
  PUBLIC_DOMAIN
  KERIA_IMAGE_REPO
  WITNESS_IMAGE_REPO
  CRED_IMAGE_REPO
  CRED_UI_IMAGE_REPO
  KERIA_PASSCODE
  DATABASE_URL
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  GATEWAY_JWT_SECRET
  BRAN_ENCRYPTION_KEY
)

# shellcheck source=/dev/null
set -a
source "$ENV_FILE"
set +a

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required env var: $var" >&2
    exit 1
  fi

done

for secret_var in KERIA_PASSCODE JWT_ACCESS_SECRET JWT_REFRESH_SECRET GATEWAY_JWT_SECRET BRAN_ENCRYPTION_KEY; do
  value="${!secret_var}"
  if [[ "$value" == "REPLACE_ME" || "$value" == "CHANGEME" || "$value" == "dev-change-me"* ]]; then
    echo "Invalid placeholder value for $secret_var" >&2
    exit 1
  fi
done

if [[ "$PUBLIC_DOMAIN" == http* ]]; then
  echo "PUBLIC_DOMAIN must be a bare domain (no scheme): $PUBLIC_DOMAIN" >&2
  exit 1
fi

if [[ "${WITNESS_COUNT:-6}" != "6" ]]; then
  echo "WITNESS_COUNT must be 6 for this deployment contract" >&2
  exit 1
fi

echo "Env contract validation passed for: $ENV_FILE"
