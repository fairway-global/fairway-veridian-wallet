#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
CONFIG_SRC="${REPO_ROOT}/infra/observability/gcp/ops-agent-config.yaml"
CONFIG_DST="/etc/google-cloud-ops-agent/config.yaml"

if [[ ! -f "$CONFIG_SRC" ]]; then
  echo "Missing Ops Agent config template: $CONFIG_SRC" >&2
  exit 1
fi

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

if ! command -v google_cloud_ops_agent_engine >/dev/null 2>&1 && ! systemctl list-unit-files | grep -q google-cloud-ops-agent; then
  curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
  as_root bash add-google-cloud-ops-agent-repo.sh --also-install
  rm -f add-google-cloud-ops-agent-repo.sh
fi

as_root install -m 644 "$CONFIG_SRC" "$CONFIG_DST"
as_root systemctl daemon-reload
as_root systemctl enable google-cloud-ops-agent
as_root systemctl restart google-cloud-ops-agent
as_root systemctl --no-pager --full status google-cloud-ops-agent | sed -n '1,40p'

echo "GCP Ops Agent installed/configured."
