#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
TARGET_SLOT="${2:-auto}"
CHECK_PUBLIC="${3:-true}"

if [[ -z "$ENVIRONMENT" ]]; then
  echo "Usage: $0 <environment> [target-slot|auto] [check-public=true|false]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/deploy.sh" \
  --environment "$ENVIRONMENT" \
  --action rollback \
  --target-slot "$TARGET_SLOT" \
  --check-public "$CHECK_PUBLIC"
