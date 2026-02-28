#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-lebensordner.org}"
COMPOSE_DIR="${2:-/opt/lebensordner/app/deploy}"
WWW_DOMAIN="www.${DOMAIN}"
GRAFANA_DOMAIN="grafana.${DOMAIN}"
STUDIO_DOMAIN="studio.${DOMAIN}"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

pass() {
  echo "PASS: $1"
}

if ! command -v docker >/dev/null 2>&1; then
  fail "docker is not installed"
fi

if [[ ! -d "$COMPOSE_DIR" ]]; then
  fail "compose directory not found: $COMPOSE_DIR"
fi

cd "$COMPOSE_DIR"

if grep -q '\${SUPABASE_ANON_KEY}\|\${SUPABASE_SERVICE_KEY}' supabase/kong.yml; then
  fail "deploy/supabase/kong.yml still contains unresolved SUPABASE placeholders"
fi
pass "kong.yml has resolved Supabase keys"

require_service_running() {
  local service="$1"
  local container_id
  container_id="$(docker compose ps -q "$service" || true)"
  [[ -n "$container_id" ]] || fail "service has no container id: ${service}"

  local running
  running="$(docker inspect "$container_id" --format '{{.State.Running}}')"
  [[ "$running" == "true" ]] || fail "service is not running: ${service}"
}

require_service_healthy_if_defined() {
  local service="$1"
  local container_id
  container_id="$(docker compose ps -q "$service" || true)"
  [[ -n "$container_id" ]] || fail "service has no container id: ${service}"

  local has_health
  has_health="$(docker inspect "$container_id" --format '{{if .State.Health}}yes{{else}}no{{end}}')"
  if [[ "$has_health" == "yes" ]]; then
    local health
    health="$(docker inspect "$container_id" --format '{{.State.Health.Status}}')"
    [[ "$health" == "healthy" ]] || fail "service is not healthy: ${service} (health=${health})"
  fi
}

check_http_status() {
  local url="$1"
  shift
  local allowed=("$@")
  local status
  status="$(curl -sSIL -o /dev/null -w '%{http_code}' "$url")"

  for code in "${allowed[@]}"; do
    if [[ "$status" == "$code" ]]; then
      pass "HTTP ${status} ${url}"
      return
    fi
  done
  fail "unexpected status for ${url}: ${status} (allowed: ${allowed[*]})"
}

require_env_key() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" .env | head -n1 | cut -d= -f2- || true)"
  [[ -n "$value" ]] || fail "missing ${key} in ${COMPOSE_DIR}/.env"
  printf '%s' "$value"
}

echo "Checking required services are running/healthy..."
for svc in nextjs worker caddy redis db kong grafana prometheus loki promtail postgres-exporter redis-exporter node-exporter; do
  require_service_running "$svc"
  require_service_healthy_if_defined "$svc"
done
pass "required services are running"

echo "Checking running images..."
NEXTJS_IMAGE="$(docker inspect "$(docker compose ps -q nextjs)" --format '{{.Config.Image}}')"
WORKER_IMAGE="$(docker inspect "$(docker compose ps -q worker)" --format '{{.Config.Image}}')"

[[ "$NEXTJS_IMAGE" == ghcr.io/christofboermel/lebensordner/nextjs:* ]] || fail "unexpected nextjs image: $NEXTJS_IMAGE"
[[ "$WORKER_IMAGE" == ghcr.io/christofboermel/lebensordner/worker:* ]] || fail "unexpected worker image: $WORKER_IMAGE"
pass "nextjs/worker use GHCR images"

echo "Checking public HTTP responses..."
check_http_status "https://${DOMAIN}" 200
check_http_status "https://${DOMAIN}/api/health" 200
check_http_status "https://${WWW_DOMAIN}" 301 308 200
# Grafana/Studio may be protected by Basic Auth, so 401 is acceptable and expected in that case.
check_http_status "https://${GRAFANA_DOMAIN}" 200 302 401
check_http_status "https://${STUDIO_DOMAIN}" 200 302 401

echo "Checking Supabase key-auth probes..."
ANON_KEY="$(require_env_key ANON_KEY)"
REST_STATUS="$(curl -sS -o /tmp/rest_openapi.json -w '%{http_code}' \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Accept: application/openapi+json" \
  "https://${DOMAIN}/supabase/rest/v1/")"
[[ "$REST_STATUS" == "200" ]] || fail "unexpected status for Supabase REST key-auth probe: ${REST_STATUS}"
if grep -qi "No API key found in request" /tmp/rest_openapi.json; then
  fail "Supabase REST probe returned key-auth rejection body"
fi
pass "Supabase REST key-auth probe passed"

echo "Checking Grafana alert provisioning logs..."
if docker compose logs --no-color --tail=400 grafana | grep -qiE "failure parsing rules|failed to parse|error loading alerting provisioning"; then
  fail "grafana alert provisioning errors detected"
fi
pass "grafana alert provisioning logs are clean"

echo "Checking Prometheus target health..."
PROM_TARGET_JSON="$(curl -fsS http://127.0.0.1:9090/api/v1/targets)"
if ! command -v python3 >/dev/null 2>&1; then
  fail "python3 is required for Prometheus target validation"
fi
python3 - <<'PY' <<<"$PROM_TARGET_JSON"
import json
import sys

payload = json.load(sys.stdin)
targets = payload.get("data", {}).get("activeTargets", [])

required_jobs = {"lebensordner-app", "postgres", "redis", "caddy"}
up_jobs = set()
for target in targets:
    labels = target.get("labels", {})
    job = labels.get("job")
    health = target.get("health")
    if job in required_jobs and health == "up":
        up_jobs.add(job)

missing = sorted(required_jobs - up_jobs)
if missing:
    print(f"Missing UP Prometheus targets: {', '.join(missing)}", file=sys.stderr)
    sys.exit(1)
PY
pass "required Prometheus targets are UP"

echo
echo "Deployment verification passed."
echo "nextjs image: ${NEXTJS_IMAGE}"
echo "worker image: ${WORKER_IMAGE}"
