#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
SLOT="${2:-active}"
SERVICE="${3:-}"

if [[ -z "$ENVIRONMENT" ]]; then
  echo "Usage: $0 <environment> [slot|active] [service]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.production.yaml"
STATE_DIR_ROOT="${STATE_DIR_ROOT:-/opt/veridian/state}"
ENV_STATE_DIR="${STATE_DIR_ROOT}/${ENVIRONMENT}"
ACTIVE_SLOT_FILE="${ENV_STATE_DIR}/active_slot"

if [[ "$SLOT" == "active" ]]; then
  if [[ ! -f "$ACTIVE_SLOT_FILE" ]]; then
    echo "No active slot file found at ${ACTIVE_SLOT_FILE}" >&2
    exit 1
  fi
  SLOT="$(cat "$ACTIVE_SLOT_FILE")"
fi

SLOT_ENV_FILE="${ENV_STATE_DIR}/generated-env/${SLOT}.env"
if [[ ! -f "$SLOT_ENV_FILE" ]]; then
  echo "Slot env file not found: ${SLOT_ENV_FILE}" >&2
  exit 1
fi

cmd=(docker compose -f "$COMPOSE_FILE" --env-file "$SLOT_ENV_FILE" -p "veridian-${ENVIRONMENT}-${SLOT}" logs -f)
if [[ -n "$SERVICE" ]]; then
  cmd+=("$SERVICE")
fi

"${cmd[@]}"
