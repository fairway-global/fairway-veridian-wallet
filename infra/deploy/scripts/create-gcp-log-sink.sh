#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-}"
SINK_NAME="${2:-}"
DESTINATION="${3:-}"

if [[ -z "$PROJECT_ID" || -z "$SINK_NAME" || -z "$DESTINATION" ]]; then
  cat >&2 <<USAGE
Usage: $0 <gcp-project-id> <sink-name> <destination>

Destination examples:
- pubsub.googleapis.com/projects/<project>/topics/<topic>
- bigquery.googleapis.com/projects/<project>/datasets/<dataset>
- storage.googleapis.com/<bucket-name>
USAGE
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required" >&2
  exit 1
fi

FILTER='resource.type="gce_instance" AND (logName:"docker_json" OR logName:"nginx_access" OR logName:"nginx_error")'

gcloud config set project "$PROJECT_ID" >/dev/null

# Idempotent: update if exists, create if missing.
if gcloud logging sinks describe "$SINK_NAME" >/dev/null 2>&1; then
  gcloud logging sinks update "$SINK_NAME" "$DESTINATION" --log-filter "$FILTER"
else
  gcloud logging sinks create "$SINK_NAME" "$DESTINATION" --log-filter "$FILTER"
fi

echo "Log sink configured: ${SINK_NAME} -> ${DESTINATION}"
gcloud logging sinks describe "$SINK_NAME"
