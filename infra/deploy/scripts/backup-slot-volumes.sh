#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
SLOT="${2:-}"
OUTPUT_DIR="${3:-}"

if [[ -z "$ENVIRONMENT" || -z "$SLOT" || -z "$OUTPUT_DIR" ]]; then
  echo "Usage: $0 <environment> <slot> <output-dir>" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
if [[ "$SLOT" == "active" ]]; then
  state_dir_root="${STATE_DIR_ROOT:-/opt/veridian/state}"
  active_slot_file="${state_dir_root}/${ENVIRONMENT}/active_slot"
  if [[ ! -f "$active_slot_file" ]]; then
    echo "Active slot file not found: $active_slot_file" >&2
    exit 1
  fi
  SLOT="$(cat "$active_slot_file")"
fi

project="veridian-${ENVIRONMENT}-${SLOT}"
volumes=(keria-data keria-config issuer-server-data witnesses-config)

for v in "${volumes[@]}"; do
  full_volume="${project}_${v}"
  archive="${OUTPUT_DIR}/${full_volume}.tgz"
  echo "Backing up ${full_volume} -> ${archive}"
  docker run --rm \
    -v "${full_volume}:/volume:ro" \
    -v "${OUTPUT_DIR}:/backup" \
    alpine:3.21 \
    sh -c "tar -czf /backup/${full_volume}.tgz -C /volume ."
done

echo "Backup completed: ${OUTPUT_DIR}"
