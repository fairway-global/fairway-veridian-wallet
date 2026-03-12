#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-}"
PUBLIC_DOMAIN="${2:-}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 <gcp-project-id> [public-domain]" >&2
  exit 1
fi

INSTANCE_ID="$(curl -sS -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/id || true)"
INSTANCE_NAME="$(curl -sS -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/name || true)"
ZONE_FULL="$(curl -sS -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/zone || true)"
ZONE="${ZONE_FULL##*/}"

cat <<EOT
Instance: ${INSTANCE_NAME:-unknown} (${INSTANCE_ID:-unknown})
Zone: ${ZONE:-unknown}

Cloud Logs Explorer (instance scoped):
https://console.cloud.google.com/logs/query?project=${PROJECT_ID}

GCE VM Console:
https://console.cloud.google.com/compute/instancesDetail/zones/${ZONE}/instances/${INSTANCE_NAME}?project=${PROJECT_ID}

Cloud Monitoring Metrics Explorer:
https://console.cloud.google.com/monitoring/metrics-explorer?project=${PROJECT_ID}

Live logs from CLI:
gcloud logging tail 'resource.type="gce_instance" AND resource.labels.instance_id="${INSTANCE_ID}"' --project ${PROJECT_ID}

Docker+Nginx logs only (CLI):
gcloud logging tail 'resource.type="gce_instance" AND resource.labels.instance_id="${INSTANCE_ID}" AND (logName:"docker_json" OR logName:"nginx_access" OR logName:"nginx_error")' --project ${PROJECT_ID}
EOT

if [[ -n "$PUBLIC_DOMAIN" ]]; then
  cat <<EOT

Public endpoint checks:
for h in keria keria-ext keria-boot cred-issuance cred-issuance-ui witness-0 witness-1 witness-2 witness-3 witness-4 witness-5; do
  echo "== $h.${PUBLIC_DOMAIN} =="
  curl -k -I "https://$h.${PUBLIC_DOMAIN}" || true
  echo

done
EOT
fi
