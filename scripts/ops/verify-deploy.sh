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

extract_kong_key() {
  local consumer="$1"
  local line
  line="$(
    awk -v target="$consumer" '
      $0 ~ "username:[[:space:]]*" target "$" { in_consumer=1; next }
      in_consumer && $0 ~ "username:" { in_consumer=0 }
      in_consumer && $0 ~ "key:[[:space:]]*" { sub(/.*key:[[:space:]]*/, "", $0); print $0; exit }
    ' supabase/kong.yml
  )"
  printf '%s' "$line" | tr -d '\r'
}

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

check_internal_supabase_from_nextjs() {
  local nextjs_container_id="$1"

  docker exec -i "$nextjs_container_id" node - <<'NODE'
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = required.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error(`Missing env in nextjs container: ${missing.join(', ')}`)
  process.exit(1)
}

const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function probe(url, label) {
  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })
  const body = await response.text()
  if (response.status !== 200) {
    console.error(`${label} failed: status=${response.status} body=${body.slice(0, 300)}`)
    process.exit(1)
  }
  if (/JWSInvalidSignature/i.test(body)) {
    console.error(`${label} failed: body contains JWSInvalidSignature`)
    process.exit(1)
  }
}

async function main() {
  await probe(`${baseUrl}/rest/v1/profiles?select=id&limit=1`, 'internal rest probe')
  await probe(`${baseUrl}/auth/v1/health`, 'internal auth health probe')
  console.log('PASS: internal nextjs->supabase probes succeeded')
}

main().catch((error) => {
  console.error(`Internal supabase probe crashed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
NODE
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
  printf '%s' "$value" | tr -d '\r'
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
NEXTJS_CONTAINER_ID="$(docker compose ps -q nextjs)"

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
SERVICE_ROLE_KEY="$(require_env_key SERVICE_ROLE_KEY)"
KONG_ANON_KEY="$(extract_kong_key anon)"
KONG_SERVICE_ROLE_KEY="$(extract_kong_key service_role)"
[[ -n "$KONG_ANON_KEY" && -n "$KONG_SERVICE_ROLE_KEY" ]] || fail "could not extract anon/service_role keys from supabase/kong.yml"
[[ "$KONG_ANON_KEY" == "$ANON_KEY" ]] || fail "kong.yml anon key does not match .env ANON_KEY"
[[ "$KONG_SERVICE_ROLE_KEY" == "$SERVICE_ROLE_KEY" ]] || fail "kong.yml service_role key does not match .env SERVICE_ROLE_KEY"
pass "kong.yml keys match deploy .env keys"

echo "Checking app container env parity..."
ENV_SUPABASE_URL="$(require_env_key SUPABASE_URL)"
ENV_SERVICE_ROLE_HASH="$(printf '%s' "$SERVICE_ROLE_KEY" | sha256sum | awk '{print $1}')"
NEXTJS_SUPABASE_URL="$(docker exec "$NEXTJS_CONTAINER_ID" node -e "process.stdout.write(process.env.SUPABASE_URL || '')")"
NEXTJS_SERVICE_ROLE_HASH="$(docker exec "$NEXTJS_CONTAINER_ID" node -e "const crypto = require('crypto'); const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; process.stdout.write(crypto.createHash('sha256').update(key).digest('hex'))")"
[[ "$NEXTJS_SUPABASE_URL" == "$ENV_SUPABASE_URL" ]] || fail "nextjs SUPABASE_URL does not match deploy .env SUPABASE_URL"
[[ "$NEXTJS_SERVICE_ROLE_HASH" == "$ENV_SERVICE_ROLE_HASH" ]] || fail "nextjs SUPABASE_SERVICE_ROLE_KEY does not match deploy .env SERVICE_ROLE_KEY"
pass "nextjs container env matches deploy .env"

echo "Checking internal Supabase probes from nextjs..."
check_internal_supabase_from_nextjs "$NEXTJS_CONTAINER_ID"

REST_WITH_KEY_STATUS="$(curl -sS -o /tmp/rest_openapi_with_key.json -w '%{http_code}' \
  -H "apikey: ${ANON_KEY}" \
  -H "Accept: application/openapi+json" \
  "https://${DOMAIN}/supabase/rest/v1/")"
[[ "$REST_WITH_KEY_STATUS" == "200" ]] || fail "unexpected status for Supabase REST probe with apikey: ${REST_WITH_KEY_STATUS}"
if grep -qi "No API key found in request" /tmp/rest_openapi_with_key.json; then
  fail "Supabase REST probe with apikey returned key-auth rejection body"
fi
REST_NO_KEY_STATUS="$(curl -sS -o /tmp/rest_openapi_no_key.json -w '%{http_code}' \
  -H "Accept: application/openapi+json" \
  "https://${DOMAIN}/supabase/rest/v1/")"
[[ "$REST_NO_KEY_STATUS" == "401" ]] || fail "expected 401 for Supabase REST probe without apikey, got ${REST_NO_KEY_STATUS}"
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
