#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${1:-supabase-db}"
DB_USER="${2:-postgres}"
DB_NAME="${3:-postgres}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASELINE_SQL="${SCRIPT_DIR}/../migrations/20260226000003_restore_core_schema_baseline.sql"
AUDIT_SQL="${SCRIPT_DIR}/schema_audit.sql"
VERIFY_SQL="${SCRIPT_DIR}/post_restore_verifier.sql"

timestamp="$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="${SCRIPT_DIR}/output-${timestamp}"
mkdir -p "${OUTPUT_DIR}"

run_sql_file() {
  local file_path="$1"
  local label="$2"
  local stop_on_error="${3:-false}"
  local out_file="${OUTPUT_DIR}/${label}.out.txt"
  local err_file="${OUTPUT_DIR}/${label}.err.txt"

  echo "==> Running: ${label} (${file_path})"

  if [[ "${stop_on_error}" == "true" ]]; then
    cat "${file_path}" | docker exec -i "${CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" -f - >"${out_file}" 2>"${err_file}"
  else
    cat "${file_path}" | docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -f - >"${out_file}" 2>"${err_file}"
  fi

  echo "    stdout: ${out_file}"
  echo "    stderr: ${err_file}"
}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found in PATH" >&2
  exit 1
fi

echo "Container: ${CONTAINER} | DB: ${DB_NAME} | User: ${DB_USER}"
echo "Output dir: ${OUTPUT_DIR}"
echo

echo "Step 1/5: Table snapshot before"
docker exec -i "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "\\dt public.*" >"${OUTPUT_DIR}/01_tables_before.out.txt" 2>"${OUTPUT_DIR}/01_tables_before.err.txt"

echo "Step 2/5: Baseline audit before restore"
run_sql_file "${AUDIT_SQL}" "02_schema_audit_before" "false"

echo "Step 3/5: Restore baseline migration"
run_sql_file "${BASELINE_SQL}" "03_restore_baseline" "true"

echo "Step 4/5: Baseline audit after restore"
run_sql_file "${AUDIT_SQL}" "04_schema_audit_after" "false"

echo "Step 5/5: Deep verifier after restore"
run_sql_file "${VERIFY_SQL}" "05_post_restore_verifier" "false"

echo
echo "Done. Share these files:"
echo " - ${OUTPUT_DIR}/02_schema_audit_before.out.txt"
echo " - ${OUTPUT_DIR}/03_restore_baseline.err.txt (if non-empty)"
echo " - ${OUTPUT_DIR}/04_schema_audit_after.out.txt"
echo " - ${OUTPUT_DIR}/05_post_restore_verifier.out.txt"
