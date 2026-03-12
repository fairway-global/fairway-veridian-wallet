#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
SLOT="${2:-}"
VOLUME_SUFFIX="${3:-}"
ARCHIVE_FILE="${4:-}"

if [[ -z "$ENVIRONMENT" || -z "$SLOT" || -z "$VOLUME_SUFFIX" || -z "$ARCHIVE_FILE" ]]; then
  echo "Usage: $0 <environment> <slot> <volume-suffix> <archive-file>" >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE_FILE" ]]; then
  echo "Archive not found: $ARCHIVE_FILE" >&2
  exit 1
fi

project="veridian-${ENVIRONMENT}-${SLOT}"
full_volume="${project}_${VOLUME_SUFFIX}"
archive_dir="$(cd "$(dirname "$ARCHIVE_FILE")" && pwd)"
archive_base="$(basename "$ARCHIVE_FILE")"

echo "Restoring ${ARCHIVE_FILE} -> ${full_volume}"
docker run --rm \
  -v "${full_volume}:/volume" \
  -v "${archive_dir}:/backup" \
  alpine:3.21 \
  sh -c "rm -rf /volume/* && tar -xzf /backup/${archive_base} -C /volume"

echo "Restore completed"
