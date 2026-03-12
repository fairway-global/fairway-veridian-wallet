#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-}"
DNS_ZONE="${2:-}"
BASE_DOMAIN="${3:-}"

if [[ -z "$PROJECT_ID" || -z "$DNS_ZONE" || -z "$BASE_DOMAIN" ]]; then
  echo "Usage: $0 <gcp-project-id> <cloud-dns-zone> <base-domain>" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required" >&2
  exit 1
fi

hosts=(
  keria
  keria-ext
  keria-boot
  cred-issuance
  cred-issuance-ui
  witness-0
  witness-1
  witness-2
  witness-3
  witness-4
  witness-5
)

gcloud config set project "$PROJECT_ID" >/dev/null

gcloud dns record-sets transaction start --zone "$DNS_ZONE"

for host in "${hosts[@]}"; do
  fqdn="${host}.${BASE_DOMAIN}."
  while IFS=$'\t' read -r ttl rrdata; do
    [[ -z "$ttl" || -z "$rrdata" ]] && continue
    gcloud dns record-sets transaction remove \
      --zone "$DNS_ZONE" \
      --name "$fqdn" \
      --type A \
      --ttl "$ttl" \
      "$rrdata" || true
  done < <(gcloud dns record-sets list \
            --zone "$DNS_ZONE" \
            --name "$fqdn" \
            --type A \
            --format='value(ttl,rrdatas[0])')
done

gcloud dns record-sets transaction execute --zone "$DNS_ZONE"

echo "Cloud DNS cleanup complete for ${BASE_DOMAIN} in zone ${DNS_ZONE}."
