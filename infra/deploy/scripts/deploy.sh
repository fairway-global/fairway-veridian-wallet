#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

ENVIRONMENT=""
RELEASE_SHA=""
TARGET_SLOT="auto"
ACTION="promote"
CHECK_PUBLIC="true"

COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/docker-compose.production.yaml}"
STATE_DIR_ROOT="${STATE_DIR_ROOT:-/opt/veridian/state}"

usage() {
  cat <<USAGE
Usage:
  $0 --environment <staging|production> --release-sha <sha> [--target-slot <blue|green|auto>] [--action <promote|rollback>] [--check-public <true|false>]
USAGE
}

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

set_slot_ports() {
  local slot="$1"

  case "$slot" in
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
      echo "Invalid slot: $slot" >&2
      exit 1
      ;;
  esac
}

opposite_slot() {
  local slot="$1"
  if [[ "$slot" == "blue" ]]; then
    echo "green"
  else
    echo "blue"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --release-sha)
      RELEASE_SHA="$2"
      shift 2
      ;;
    --target-slot)
      TARGET_SLOT="$2"
      shift 2
      ;;
    --action)
      ACTION="$2"
      shift 2
      ;;
    --check-public)
      CHECK_PUBLIC="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ENVIRONMENT" ]]; then
  usage
  exit 1
fi

if [[ "$ACTION" == "promote" && -z "$RELEASE_SHA" ]]; then
  echo "--release-sha is required for promote action" >&2
  exit 1
fi

if [[ "$ACTION" != "promote" && "$ACTION" != "rollback" ]]; then
  echo "Invalid action: $ACTION" >&2
  exit 1
fi

if [[ "$TARGET_SLOT" != "auto" && "$TARGET_SLOT" != "blue" && "$TARGET_SLOT" != "green" ]]; then
  echo "Invalid target slot: $TARGET_SLOT" >&2
  exit 1
fi

BASE_ENV_FILE="${BASE_ENV_FILE:-${REPO_ROOT}/infra/deploy/env/${ENVIRONMENT}.env}"
if [[ ! -f "$BASE_ENV_FILE" ]]; then
  echo "Missing environment file: $BASE_ENV_FILE" >&2
  echo "Create it from infra/deploy/env/${ENVIRONMENT}.env.example" >&2
  exit 1
fi

"${SCRIPT_DIR}/validate-env-contract.sh" "$BASE_ENV_FILE"

# shellcheck source=/dev/null
set -a
source "$BASE_ENV_FILE"
set +a

TARGETS_FILE="${REPO_ROOT}/infra/observability/prometheus/targets/veridian-targets.yml"
"${SCRIPT_DIR}/render-observability-targets.sh" "$PUBLIC_DOMAIN" "$TARGETS_FILE"
curl -fsS -X POST http://127.0.0.1:9090/-/reload >/dev/null 2>&1 || true

ENV_STATE_DIR="${STATE_DIR_ROOT}/${ENVIRONMENT}"
ACTIVE_SLOT_FILE="${ENV_STATE_DIR}/active_slot"
GENERATED_ENV_DIR="${ENV_STATE_DIR}/generated-env"
NGINX_UPSTREAM_FILE="${NGINX_UPSTREAM_FILE:-/etc/nginx/snippets/veridian_${ENVIRONMENT}_active_upstreams.conf}"

as_root mkdir -p "$ENV_STATE_DIR" "$GENERATED_ENV_DIR" "$(dirname "$NGINX_UPSTREAM_FILE")"

active_slot="blue"
if as_root test -f "$ACTIVE_SLOT_FILE"; then
  active_slot="$(as_root cat "$ACTIVE_SLOT_FILE")"
fi

if [[ "$TARGET_SLOT" == "auto" ]]; then
  if [[ "$ACTION" == "promote" ]]; then
    target_slot="$(opposite_slot "$active_slot")"
  else
    target_slot="$(opposite_slot "$active_slot")"
  fi
else
  target_slot="$TARGET_SLOT"
fi

set_slot_ports "$target_slot"

target_env_file="${GENERATED_ENV_DIR}/${target_slot}.env"
tmp_env_file="$(mktemp)"
cp "$BASE_ENV_FILE" "$tmp_env_file"

if [[ "$ACTION" == "promote" ]]; then
  cat >> "$tmp_env_file" <<EOC
SLOT=${target_slot}
RELEASE_SHA=${RELEASE_SHA}
KERIA_IMAGE=${KERIA_IMAGE_REPO}:${RELEASE_SHA}
WITNESS_IMAGE=${WITNESS_IMAGE_REPO}:${RELEASE_SHA}
WITNESS_INIT_IMAGE=${WITNESS_IMAGE_REPO}:${RELEASE_SHA}
CRED_IMAGE=${CRED_IMAGE_REPO}:${RELEASE_SHA}
CRED_UI_IMAGE=${CRED_UI_IMAGE_REPO}:${RELEASE_SHA}
KERIA_API_HOST_PORT=${KERIA_API_HOST_PORT}
KERIA_EXT_HOST_PORT=${KERIA_EXT_HOST_PORT}
KERIA_BOOT_HOST_PORT=${KERIA_BOOT_HOST_PORT}
CRED_HOST_PORT=${CRED_HOST_PORT}
CRED_UI_HOST_PORT=${CRED_UI_HOST_PORT}
WITNESS_0_HOST_PORT=${WITNESS_0_HOST_PORT}
WITNESS_1_HOST_PORT=${WITNESS_1_HOST_PORT}
WITNESS_2_HOST_PORT=${WITNESS_2_HOST_PORT}
WITNESS_3_HOST_PORT=${WITNESS_3_HOST_PORT}
WITNESS_4_HOST_PORT=${WITNESS_4_HOST_PORT}
WITNESS_5_HOST_PORT=${WITNESS_5_HOST_PORT}
EOC
else
  # rollback reuses the generated env for the target slot when available
  if as_root test -f "$target_env_file"; then
    as_root cat "$target_env_file" > "$tmp_env_file"
  else
    echo "No generated env found for slot ${target_slot}, generating one from base env." >&2
    cat >> "$tmp_env_file" <<EOC
SLOT=${target_slot}
KERIA_API_HOST_PORT=${KERIA_API_HOST_PORT}
KERIA_EXT_HOST_PORT=${KERIA_EXT_HOST_PORT}
KERIA_BOOT_HOST_PORT=${KERIA_BOOT_HOST_PORT}
CRED_HOST_PORT=${CRED_HOST_PORT}
CRED_UI_HOST_PORT=${CRED_UI_HOST_PORT}
WITNESS_0_HOST_PORT=${WITNESS_0_HOST_PORT}
WITNESS_1_HOST_PORT=${WITNESS_1_HOST_PORT}
WITNESS_2_HOST_PORT=${WITNESS_2_HOST_PORT}
WITNESS_3_HOST_PORT=${WITNESS_3_HOST_PORT}
WITNESS_4_HOST_PORT=${WITNESS_4_HOST_PORT}
WITNESS_5_HOST_PORT=${WITNESS_5_HOST_PORT}
EOC
  fi
fi

as_root install -m 600 "$tmp_env_file" "$target_env_file"
as_root chown "$(id -u):$(id -g)" "$target_env_file"
rm -f "$tmp_env_file"

compose_cmd=(docker compose -f "$COMPOSE_FILE" --env-file "$target_env_file" -p "veridian-${ENVIRONMENT}-${target_slot}")

if [[ "$ACTION" == "promote" ]]; then
  "${SCRIPT_DIR}/check-images.sh" --env-file "$BASE_ENV_FILE" --release-sha "$RELEASE_SHA"
  "${compose_cmd[@]}" config >/dev/null

  echo "Running witness initialization for slot ${target_slot}"
  "${compose_cmd[@]}" --profile init run --rm witness-init

  echo "Running KERIA initialization for slot ${target_slot}"
  "${compose_cmd[@]}" --profile init run --rm keria-init

  echo "Starting runtime services for slot ${target_slot}"
  "${compose_cmd[@]}" up -d --remove-orphans

  "${SCRIPT_DIR}/smoke-check.sh" --env-file "$target_env_file"
fi

previous_slot="$active_slot"

tmp_upstream="$(mktemp)"
"${SCRIPT_DIR}/render-nginx-upstreams.sh" "$target_slot" > "$tmp_upstream"
as_root install -m 644 "$tmp_upstream" "$NGINX_UPSTREAM_FILE"
rm -f "$tmp_upstream"

as_root nginx -t
as_root nginx -s reload

if [[ "$CHECK_PUBLIC" == "true" ]]; then
  set +e
  "${SCRIPT_DIR}/smoke-check.sh" --env-file "$target_env_file" --check-public true
  smoke_exit=$?
  set -e

  if [[ $smoke_exit -ne 0 ]]; then
    echo "Public smoke checks failed after switching traffic to ${target_slot}." >&2
    if [[ "$previous_slot" != "$target_slot" ]]; then
      echo "Rolling back traffic to ${previous_slot}." >&2
      rollback_tmp="$(mktemp)"
      "${SCRIPT_DIR}/render-nginx-upstreams.sh" "$previous_slot" > "$rollback_tmp"
      as_root install -m 644 "$rollback_tmp" "$NGINX_UPSTREAM_FILE"
      rm -f "$rollback_tmp"
      as_root nginx -t
      as_root nginx -s reload
      echo "$previous_slot" | as_root tee "$ACTIVE_SLOT_FILE" >/dev/null
    fi
    exit 1
  fi
fi

echo "$target_slot" | as_root tee "$ACTIVE_SLOT_FILE" >/dev/null

echo "Deployment action '${ACTION}' completed successfully. Active slot: ${target_slot}"
