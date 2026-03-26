#!/usr/bin/env bash
set -euo pipefail

SLOT="${1:-}"
ENVIRONMENT="${2:-}"
if [[ -z "$SLOT" ]]; then
  echo "Usage: $0 <blue|green> [environment]" >&2
  exit 1
fi

UPSTREAM_SUFFIX=""
if [[ -n "$ENVIRONMENT" ]]; then
  if [[ ! "$ENVIRONMENT" =~ ^[a-zA-Z0-9_]+$ ]]; then
    echo "Invalid environment for upstream suffix: $ENVIRONMENT" >&2
    exit 1
  fi
  UPSTREAM_SUFFIX="_${ENVIRONMENT}"
fi

case "$SLOT" in
  blue)
    KERIA_API_HOST_PORT=13901
    KERIA_EXT_HOST_PORT=13902
    KERIA_BOOT_HOST_PORT=13903
    CRED_HOST_PORT=13001
    CRED_UI_HOST_PORT=13002
    WITNESS_0_HOST_PORT=15642
    WITNESS_1_HOST_PORT=15643
    WITNESS_2_HOST_PORT=15644
    WITNESS_3_HOST_PORT=15645
    WITNESS_4_HOST_PORT=15646
    WITNESS_5_HOST_PORT=15647
    ;;
  green)
    KERIA_API_HOST_PORT=14901
    KERIA_EXT_HOST_PORT=14902
    KERIA_BOOT_HOST_PORT=14903
    CRED_HOST_PORT=14001
    CRED_UI_HOST_PORT=14002
    WITNESS_0_HOST_PORT=16642
    WITNESS_1_HOST_PORT=16643
    WITNESS_2_HOST_PORT=16644
    WITNESS_3_HOST_PORT=16645
    WITNESS_4_HOST_PORT=16646
    WITNESS_5_HOST_PORT=16647
    ;;
  *)
    echo "Invalid slot: $SLOT" >&2
    exit 1
    ;;
esac

cat <<EOC
upstream keria_api${UPSTREAM_SUFFIX} { server 127.0.0.1:${KERIA_API_HOST_PORT}; }
upstream keria_ext${UPSTREAM_SUFFIX} { server 127.0.0.1:${KERIA_EXT_HOST_PORT}; }
upstream keria_boot${UPSTREAM_SUFFIX} { server 127.0.0.1:${KERIA_BOOT_HOST_PORT}; }
upstream cred_api${UPSTREAM_SUFFIX} { server 127.0.0.1:${CRED_HOST_PORT}; }
upstream cred_ui${UPSTREAM_SUFFIX} { server 127.0.0.1:${CRED_UI_HOST_PORT}; }
upstream witness_0${UPSTREAM_SUFFIX} { server 127.0.0.1:${WITNESS_0_HOST_PORT}; }
upstream witness_1${UPSTREAM_SUFFIX} { server 127.0.0.1:${WITNESS_1_HOST_PORT}; }
upstream witness_2${UPSTREAM_SUFFIX} { server 127.0.0.1:${WITNESS_2_HOST_PORT}; }
upstream witness_3${UPSTREAM_SUFFIX} { server 127.0.0.1:${WITNESS_3_HOST_PORT}; }
upstream witness_4${UPSTREAM_SUFFIX} { server 127.0.0.1:${WITNESS_4_HOST_PORT}; }
upstream witness_5${UPSTREAM_SUFFIX} { server 127.0.0.1:${WITNESS_5_HOST_PORT}; }
EOC
