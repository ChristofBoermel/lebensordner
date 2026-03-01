#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-/opt/lebensordner/app/deploy/.env}"
OUTPUT_FILE="${2:-/opt/lebensordner/app/deploy/supabase/kong.yml}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE_REF="HEAD:deploy/supabase/kong.yml"

if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: repo not found at $REPO_ROOT" >&2
  exit 1
fi

ANON_KEY="$(grep -E '^ANON_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r')"
SERVICE_ROLE_KEY="$(grep -E '^SERVICE_ROLE_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '\r')"

if [[ -z "$ANON_KEY" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "ERROR: missing ANON_KEY or SERVICE_ROLE_KEY in $ENV_FILE" >&2
  exit 1
fi

TMP_TEMPLATE="$(mktemp)"
TMP_RENDERED="$(mktemp)"
cleanup() {
  rm -f "$TMP_TEMPLATE" "$TMP_RENDERED"
}
trap cleanup EXIT

git -C "$REPO_ROOT" show "$TEMPLATE_REF" > "$TMP_TEMPLATE"

ANON_KEY="$ANON_KEY" SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
python3 - "$TMP_TEMPLATE" "$TMP_RENDERED" <<'PY'
import os
import sys
from pathlib import Path

template_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
content = template_path.read_text(encoding="utf-8")
content = content.replace("${SUPABASE_ANON_KEY}", os.environ["ANON_KEY"])
content = content.replace("${SUPABASE_SERVICE_KEY}", os.environ["SERVICE_ROLE_KEY"])
output_path.write_text(content, encoding="utf-8")
PY

if grep -q '\${SUPABASE_ANON_KEY}\|\${SUPABASE_SERVICE_KEY}' "$TMP_RENDERED"; then
  echo "ERROR: unresolved placeholders remain in rendered kong config" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"
cp "$TMP_RENDERED" "$OUTPUT_FILE"
echo "Rendered Kong config to $OUTPUT_FILE"
