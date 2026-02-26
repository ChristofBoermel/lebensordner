#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-lebensordner.org}"
COMPOSE_DIR="${2:-/opt/lebensordner/app/deploy}"
WWW_DOMAIN="www.${DOMAIN}"

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

echo "Checking services..."
docker compose ps >/tmp/lebensordner-compose-ps.txt
for svc in nextjs worker caddy redis db kong; do
  if ! grep -q "$svc" /tmp/lebensordner-compose-ps.txt; then
    fail "service missing from docker compose ps: $svc"
  fi
done
pass "expected services are present"

echo "Checking running images..."
NEXTJS_IMAGE="$(docker inspect "$(docker compose ps -q nextjs)" --format '{{.Config.Image}}')"
WORKER_IMAGE="$(docker inspect "$(docker compose ps -q worker)" --format '{{.Config.Image}}')"

[[ "$NEXTJS_IMAGE" == ghcr.io/christofboermel/lebensordner/nextjs:* ]] || fail "unexpected nextjs image: $NEXTJS_IMAGE"
[[ "$WORKER_IMAGE" == ghcr.io/christofboermel/lebensordner/worker:* ]] || fail "unexpected worker image: $WORKER_IMAGE"
pass "nextjs/worker use GHCR images"

echo "Checking HTTP responses..."
APEX_STATUS="$(curl -sSL -o /dev/null -w '%{http_code}' "https://${DOMAIN}")"
WWW_STATUS="$(curl -sSIL -o /dev/null -w '%{http_code}' "https://${WWW_DOMAIN}")"

[[ "$APEX_STATUS" == "200" ]] || fail "unexpected apex status for ${DOMAIN}: ${APEX_STATUS}"
[[ "$WWW_STATUS" == "308" || "$WWW_STATUS" == "301" || "$WWW_STATUS" == "200" ]] || fail "unexpected www status for ${WWW_DOMAIN}: ${WWW_STATUS}"
pass "domain checks passed (${DOMAIN}=${APEX_STATUS}, ${WWW_DOMAIN}=${WWW_STATUS})"

echo
echo "Deployment verification passed."
echo "nextjs image: ${NEXTJS_IMAGE}"
echo "worker image: ${WORKER_IMAGE}"
