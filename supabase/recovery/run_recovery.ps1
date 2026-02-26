param(
  [string]$Container = "supabase-db",
  [string]$DbUser = "postgres",
  [string]$DbName = "postgres"
)

$ErrorActionPreference = "Stop"

function Invoke-SqlFile {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$OutputDir,
    [switch]$StopOnError
  )

  if (!(Test-Path $FilePath)) {
    throw "SQL file not found: $FilePath"
  }

  $outFile = Join-Path $OutputDir "$Label.out.txt"
  $errFile = Join-Path $OutputDir "$Label.err.txt"

  Write-Host "==> Running: $Label ($FilePath)"
  $sql = Get-Content -Raw $FilePath

  if ($StopOnError) {
    $sql | docker exec -i $Container psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -f - 1> $outFile 2> $errFile
  } else {
    $sql | docker exec -i $Container psql -U $DbUser -d $DbName -f - 1> $outFile 2> $errFile
  }

  Write-Host "    stdout: $outFile"
  Write-Host "    stderr: $errFile"
}

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "docker command not found."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $PSScriptRoot ("output-" + $timestamp)
New-Item -ItemType Directory -Path $outputDir | Out-Null

$schemaAudit = Join-Path $PSScriptRoot "schema_audit.sql"
$baseline = Join-Path (Split-Path $PSScriptRoot -Parent) "migrations/20260226000003_restore_core_schema_baseline.sql"
$postVerifier = Join-Path $PSScriptRoot "post_restore_verifier.sql"

Write-Host "Container: $Container | DB: $DbName | User: $DbUser"
Write-Host "Output dir: $outputDir"

Write-Host ""
Write-Host "Step 1/5: Table snapshot before"
docker exec -i $Container psql -U $DbUser -d $DbName -c "\dt public.*" 1> (Join-Path $outputDir "01_tables_before.out.txt") 2> (Join-Path $outputDir "01_tables_before.err.txt")

Write-Host "Step 2/5: Baseline audit before restore"
Invoke-SqlFile -FilePath $schemaAudit -Label "02_schema_audit_before" -OutputDir $outputDir

Write-Host "Step 3/5: Restore baseline migration"
Invoke-SqlFile -FilePath $baseline -Label "03_restore_baseline" -OutputDir $outputDir -StopOnError

Write-Host "Step 4/5: Baseline audit after restore"
Invoke-SqlFile -FilePath $schemaAudit -Label "04_schema_audit_after" -OutputDir $outputDir

Write-Host "Step 5/5: Deep verifier after restore"
Invoke-SqlFile -FilePath $postVerifier -Label "05_post_restore_verifier" -OutputDir $outputDir

Write-Host ""
Write-Host "Done. Share these files:"
Write-Host " - 02_schema_audit_before.out.txt"
Write-Host " - 03_restore_baseline.err.txt (if non-empty)"
Write-Host " - 04_schema_audit_after.out.txt"
Write-Host " - 05_post_restore_verifier.out.txt"
