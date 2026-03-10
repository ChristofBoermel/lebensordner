param(
  [string]$OutputPath = "supabase/legacy-bootstrap.sql"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

$legacyFiles = @(
  "supabase/migration_019_download_tokens.sql",
  "supabase/migration_030_download_link_types.sql",
  "supabase/migration_033_email_tracking.sql",
  "supabase/migration_035_security_foundation.sql",
  "supabase/migration_037_performance_and_transactions.sql",
  "supabase/migration_038_rpc_security.sql",
  "supabase/migration_039_doc_count_rpc.sql"
)

$missingFiles = $legacyFiles | Where-Object { -not (Test-Path $_) }
if ($missingFiles.Count -gt 0) {
  throw "Missing legacy migration files:`n$($missingFiles -join "`n")"
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$header = @(
  "-- Generated file. Do not edit by hand."
  "-- Purpose: bootstrap legacy Supabase migrations on a fresh hosted project"
  "-- Generated at: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss K")"
  ""
)

$segments = New-Object System.Collections.Generic.List[string]
$segments.Add(($header -join [Environment]::NewLine))

foreach ($file in $legacyFiles) {
  $segments.Add("-- ============================================================================")
  $segments.Add("-- BEGIN $file")
  $segments.Add("-- ============================================================================")
  $segments.Add((Get-Content -Raw $file).TrimEnd())
  $segments.Add("")
  $segments.Add("-- ============================================================================")
  $segments.Add("-- END $file")
  $segments.Add("-- ============================================================================")
  $segments.Add("")
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $repoRoot $OutputPath), ($segments -join [Environment]::NewLine), $utf8NoBom)

Write-Host "Created $OutputPath"
Write-Host "Next step:"
Write-Host "1. Open the file and paste it into Supabase SQL Editor for the linked E2E project."
Write-Host "2. Run the script in SQL Editor."
Write-Host "3. Then run: supabase db push"
