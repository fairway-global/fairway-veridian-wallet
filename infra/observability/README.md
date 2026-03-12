# Observability Stack

Run:

```bash
docker compose -f infra/observability/docker-compose.observability.yaml up -d
```

Components:
- Prometheus: `127.0.0.1:9090`
- Grafana: `127.0.0.1:3300`
- Loki: `127.0.0.1:3100`
- blackbox-exporter: `127.0.0.1:9115`
- cAdvisor: `127.0.0.1:8080`
- node-exporter: `127.0.0.1:9100`

Update target domains through `infra/deploy/scripts/render-observability-targets.sh` or by editing `prometheus/targets/veridian-targets.yml`.
