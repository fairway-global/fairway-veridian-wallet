#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=""
CHECK_PUBLIC="false"
PUBLIC_DOMAIN_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --check-public)
      CHECK_PUBLIC="$2"
      shift 2
      ;;
    --public-domain)
      PUBLIC_DOMAIN_OVERRIDE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_FILE" ]]; then
  echo "Usage: $0 --env-file <file> [--check-public true|false] [--public-domain domain]" >&2
  exit 1
fi

# shellcheck source=/dev/null
set -a
source "$ENV_FILE"
set +a

PUBLIC_DOMAIN="${PUBLIC_DOMAIN_OVERRIDE:-${PUBLIC_DOMAIN:-}}"

check_tcp() {
  local host="$1"
  local port="$2"
  local attempts=30

  for ((i=1; i<=attempts; i++)); do
    if timeout 2 bash -c "</dev/tcp/${host}/${port}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "TCP check failed for ${host}:${port}" >&2
  return 1
}

check_http_200() {
  local url="$1"
  local attempts=30

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "HTTP 200 check failed for ${url}" >&2
  return 1
}

check_public_http() {
  local host="$1"
  local path="${2:-/}"
  local code

  code=$(curl -k -s -o /dev/null -w "%{http_code}" "https://${host}${path}")
  if [[ "$code" == "000" || "$code" =~ ^5 ]]; then
    echo "Public route check failed for https://${host}${path} (status=${code})" >&2
    return 1
  fi

  return 0
}

# Internal checks (loopback-only ports)
check_tcp 127.0.0.1 "${KERIA_API_HOST_PORT}"
check_tcp 127.0.0.1 "${KERIA_EXT_HOST_PORT}"
check_tcp 127.0.0.1 "${KERIA_BOOT_HOST_PORT}"
check_tcp 127.0.0.1 "${WITNESS_0_HOST_PORT}"
check_tcp 127.0.0.1 "${WITNESS_1_HOST_PORT}"
check_tcp 127.0.0.1 "${WITNESS_2_HOST_PORT}"
check_tcp 127.0.0.1 "${WITNESS_3_HOST_PORT}"
check_tcp 127.0.0.1 "${WITNESS_4_HOST_PORT}"
check_tcp 127.0.0.1 "${WITNESS_5_HOST_PORT}"
check_http_200 "http://127.0.0.1:${CRED_HOST_PORT}/ping"
check_http_200 "http://127.0.0.1:${CRED_UI_HOST_PORT}/"

# Public checks go through Nginx + TLS.
if [[ "$CHECK_PUBLIC" == "true" ]]; then
  if [[ -z "$PUBLIC_DOMAIN" ]]; then
    echo "PUBLIC_DOMAIN is required for public checks" >&2
    exit 1
  fi

  check_public_http "keria.${PUBLIC_DOMAIN}" "/"
  check_public_http "keria-ext.${PUBLIC_DOMAIN}" "/"
  check_public_http "keria-boot.${PUBLIC_DOMAIN}" "/"
  check_public_http "cred-issuance.${PUBLIC_DOMAIN}" "/ping"
  check_public_http "cred-issuance-ui.${PUBLIC_DOMAIN}" "/"
  check_public_http "witness-0.${PUBLIC_DOMAIN}" "/"
  check_public_http "witness-1.${PUBLIC_DOMAIN}" "/"
  check_public_http "witness-2.${PUBLIC_DOMAIN}" "/"
  check_public_http "witness-3.${PUBLIC_DOMAIN}" "/"
  check_public_http "witness-4.${PUBLIC_DOMAIN}" "/"
  check_public_http "witness-5.${PUBLIC_DOMAIN}" "/"
fi

echo "Smoke checks passed"
