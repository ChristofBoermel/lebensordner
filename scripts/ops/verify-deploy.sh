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

check_runtime_public_config_from_nextjs() {
  local nextjs_container_id="$1"

  docker exec -i "$nextjs_container_id" node - <<'NODE'
const expectedUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
if (!expectedUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in nextjs container')
  process.exit(1)
}

check_auth_public_urls() {
  local auth_container_id="$1"
  local api_external_url
  local gotrue_site_url

  api_external_url="$(docker inspect "$auth_container_id" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^API_EXTERNAL_URL=' | head -n1 | cut -d= -f2-)"
  gotrue_site_url="$(docker inspect "$auth_container_id" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^GOTRUE_SITE_URL=' | head -n1 | cut -d= -f2-)"

  [[ -n "$api_external_url" ]] || fail "supabase-auth API_EXTERNAL_URL is empty"
  [[ -n "$gotrue_site_url" ]] || fail "supabase-auth GOTRUE_SITE_URL is empty"

  [[ "$api_external_url" =~ ^https:// ]] || fail "supabase-auth API_EXTERNAL_URL must start with https:// (got: $api_external_url)"
  [[ "$gotrue_site_url" =~ ^https:// ]] || fail "supabase-auth GOTRUE_SITE_URL must start with https:// (got: $gotrue_site_url)"

  pass "supabase-auth public URLs are configured (${api_external_url}, ${gotrue_site_url})"
}

async function main() {
  const response = await fetch('http://127.0.0.1:3000')
  if (!response.ok) {
    console.error(`Failed to fetch app root HTML: status=${response.status}`)
    process.exit(1)
  }

  const html = await response.text()
  const match = html.match(/__LEBENSORDNER_PUBLIC_CONFIG__=({.*?});/)
  if (!match) {
    console.error('Missing __LEBENSORDNER_PUBLIC_CONFIG__ script in rendered HTML')
    process.exit(1)
  }

  let parsed
  try {
    parsed = JSON.parse(match[1])
  } catch (error) {
    console.error(`Invalid runtime public config JSON: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  const renderedUrl = String(parsed?.supabaseUrl || '').trim()
  if (!renderedUrl) {
    console.error('Rendered runtime config is missing supabaseUrl')
    process.exit(1)
  }

  if (renderedUrl !== expectedUrl) {
    console.error(`Rendered supabaseUrl mismatch. expected=${expectedUrl} rendered=${renderedUrl}`)
    process.exit(1)
  }

  if (/\.supabase\.co\b/i.test(renderedUrl)) {
    console.error(`Rendered supabaseUrl unexpectedly points to hosted Supabase: ${renderedUrl}`)
    process.exit(1)
  }

  console.log('PASS: runtime public config supabaseUrl matches container env')
}

main().catch((error) => {
  console.error(`Runtime public config probe crashed: ${error instanceof Error ? error.message : String(error)}`)
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
AUTH_CONTAINER_ID="$(docker compose ps -q auth)"

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
ENV_NEXT_PUBLIC_SUPABASE_URL="$(require_env_key NEXT_PUBLIC_SUPABASE_URL)"
ENV_SERVICE_ROLE_HASH="$(printf '%s' "$SERVICE_ROLE_KEY" | sha256sum | awk '{print $1}')"
NEXTJS_SUPABASE_URL="$(docker exec "$NEXTJS_CONTAINER_ID" node -e "process.stdout.write(process.env.SUPABASE_URL || '')")"
NEXTJS_PUBLIC_SUPABASE_URL="$(docker exec "$NEXTJS_CONTAINER_ID" node -e "process.stdout.write(process.env.NEXT_PUBLIC_SUPABASE_URL || '')")"
NEXTJS_SERVICE_ROLE_HASH="$(docker exec "$NEXTJS_CONTAINER_ID" node -e "const crypto = require('crypto'); const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; process.stdout.write(crypto.createHash('sha256').update(key).digest('hex'))")"
[[ "$NEXTJS_SUPABASE_URL" == "$ENV_SUPABASE_URL" ]] || fail "nextjs SUPABASE_URL does not match deploy .env SUPABASE_URL"
[[ "$NEXTJS_PUBLIC_SUPABASE_URL" == "$ENV_NEXT_PUBLIC_SUPABASE_URL" ]] || fail "nextjs NEXT_PUBLIC_SUPABASE_URL does not match deploy .env NEXT_PUBLIC_SUPABASE_URL"
[[ "$NEXTJS_SERVICE_ROLE_HASH" == "$ENV_SERVICE_ROLE_HASH" ]] || fail "nextjs SUPABASE_SERVICE_ROLE_KEY does not match deploy .env SERVICE_ROLE_KEY"
pass "nextjs container env matches deploy .env"

echo "Checking rendered runtime public config from nextjs..."
check_runtime_public_config_from_nextjs "$NEXTJS_CONTAINER_ID"

echo "Checking internal Supabase probes from nextjs..."
check_internal_supabase_from_nextjs "$NEXTJS_CONTAINER_ID"

echo "Checking Supabase Auth public URL configuration..."
check_auth_public_urls "$AUTH_CONTAINER_ID"

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
