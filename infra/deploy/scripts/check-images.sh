#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=""
RELEASE_SHA=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --release-sha)
      RELEASE_SHA="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_FILE" || -z "$RELEASE_SHA" ]]; then
  echo "Usage: $0 --env-file <file> --release-sha <sha>" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

# shellcheck source=/dev/null
set -a
source "$ENV_FILE"
set +a

images=(
  "${KERIA_IMAGE_REPO}:${RELEASE_SHA}"
  "${WITNESS_IMAGE_REPO}:${RELEASE_SHA}"
  "${CRED_IMAGE_REPO}:${RELEASE_SHA}"
  "${CRED_UI_IMAGE_REPO}:${RELEASE_SHA}"
)

for image in "${images[@]}"; do
  echo "Checking image manifest: $image"
  docker manifest inspect "$image" >/dev/null
done

echo "All required image manifests are available for release: $RELEASE_SHA"
