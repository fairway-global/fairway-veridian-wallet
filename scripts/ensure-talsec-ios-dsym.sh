#!/usr/bin/env bash

set -euo pipefail

DSYM_NAME="TalsecRuntime.framework.dSYM"
DWARF_NAME="TalsecRuntime"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRAMEWORK_BINARY="${REPO_ROOT}/node_modules/capacitor-freerasp/ios/Plugin/TalsecRuntime.xcframework/ios-arm64/TalsecRuntime.framework/TalsecRuntime"
ARCHIVES_ROOT="${HOME}/Library/Developer/Xcode/Archives"
TMP_DSYM_DIR=""

cleanup() {
  if [ -n "${TMP_DSYM_DIR:-}" ]; then
    rm -rf "${TMP_DSYM_DIR}"
  fi
}

trap cleanup EXIT

find_latest_archive() {
  if [ ! -d "${ARCHIVES_ROOT}" ]; then
    return 1
  fi

  find "${ARCHIVES_ROOT}" -type d -name "*.xcarchive" -print0 \
    | xargs -0 stat -f "%m %N" 2>/dev/null \
    | sort -rn \
    | head -n 1 \
    | cut -d " " -f 2-
}

uuid_for() {
  local binary_path="$1"
  xcrun dwarfdump --uuid "${binary_path}" \
    | awk '/UUID:/ { print toupper($2); exit }'
}

resolve_destination_parent() {
  local archive_path=""

  case "${1:-}" in
    --archive)
      archive_path="${2:-}"
      ;;
    --latest-archive)
      archive_path="$(find_latest_archive || true)"
      ;;
    "")
      if [ -n "${DWARF_DSYM_FOLDER_PATH:-}" ]; then
        printf "%s\n" "${DWARF_DSYM_FOLDER_PATH}"
        return 0
      fi
      archive_path="$(find_latest_archive || true)"
      ;;
    *)
      archive_path="$1"
      ;;
  esac

  if [ -z "${archive_path}" ]; then
    echo "error: No archive path provided and no .xcarchive found under ${ARCHIVES_ROOT}." >&2
    return 1
  fi

  if [ ! -d "${archive_path}" ] || [[ "${archive_path}" != *.xcarchive ]]; then
    echo "error: Archive path is not a .xcarchive directory: ${archive_path}" >&2
    return 1
  fi

  printf "%s\n" "${archive_path}/dSYMs"
}

main() {
  if [ ! -f "${FRAMEWORK_BINARY}" ]; then
    echo "error: Missing TalsecRuntime binary at ${FRAMEWORK_BINARY}." >&2
    echo "Run npm install and npx cap sync ios before archiving." >&2
    exit 1
  fi

  local destination_parent
  destination_parent="$(resolve_destination_parent "$@")"

  local destination="${destination_parent}/${DSYM_NAME}"
  local expected_uuid
  expected_uuid="$(uuid_for "${FRAMEWORK_BINARY}")"

  if [ -z "${expected_uuid}" ]; then
    echo "error: Could not read UUID from ${FRAMEWORK_BINARY}." >&2
    exit 1
  fi

  if [ -f "${destination}/Contents/Resources/DWARF/${DWARF_NAME}" ]; then
    local existing_uuid
    existing_uuid="$(uuid_for "${destination}/Contents/Resources/DWARF/${DWARF_NAME}")"
    if [ "${existing_uuid}" = "${expected_uuid}" ]; then
      echo "TalsecRuntime dSYM already exists with UUID ${expected_uuid}."
      return 0
    fi
  fi

  mkdir -p "${destination_parent}"

  TMP_DSYM_DIR="$(mktemp -d "${TMPDIR:-/tmp}/talsec-dsym.XXXXXX")"

  if ! xcrun dsymutil "${FRAMEWORK_BINARY}" -o "${TMP_DSYM_DIR}/${DSYM_NAME}" 2>"${TMP_DSYM_DIR}/dsymutil.log"; then
    cat "${TMP_DSYM_DIR}/dsymutil.log" >&2
    exit 1
  fi

  rm -rf "${destination}"
  cp -R "${TMP_DSYM_DIR}/${DSYM_NAME}" "${destination_parent}/"

  local actual_uuid
  actual_uuid="$(uuid_for "${destination}/Contents/Resources/DWARF/${DWARF_NAME}")"
  if [ "${actual_uuid}" != "${expected_uuid}" ]; then
    echo "error: Generated TalsecRuntime dSYM UUID ${actual_uuid} does not match framework UUID ${expected_uuid}." >&2
    exit 1
  fi

  echo "Generated ${destination} with UUID ${actual_uuid}."
}

main "$@"
