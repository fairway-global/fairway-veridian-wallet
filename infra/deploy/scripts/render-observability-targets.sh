#!/usr/bin/env bash
set -euo pipefail

PUBLIC_DOMAIN="${1:-}"
OUTPUT_FILE="${2:-}"

if [[ -z "$PUBLIC_DOMAIN" || -z "$OUTPUT_FILE" ]]; then
  echo "Usage: $0 <public-domain> <output-file>" >&2
  exit 1
fi

cat > "$OUTPUT_FILE" <<EOT
- labels:
    job: veridian-public-endpoints
  targets:
    - https://keria.${PUBLIC_DOMAIN}/
    - https://keria-ext.${PUBLIC_DOMAIN}/
    - https://keria-boot.${PUBLIC_DOMAIN}/
    - https://cred-issuance.${PUBLIC_DOMAIN}/ping
    - https://cred-issuance-ui.${PUBLIC_DOMAIN}/
    - https://witness-0.${PUBLIC_DOMAIN}/
    - https://witness-1.${PUBLIC_DOMAIN}/
    - https://witness-2.${PUBLIC_DOMAIN}/
    - https://witness-3.${PUBLIC_DOMAIN}/
    - https://witness-4.${PUBLIC_DOMAIN}/
    - https://witness-5.${PUBLIC_DOMAIN}/
EOT

echo "Wrote observability targets to ${OUTPUT_FILE}"
