$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $repoRoot "build"
$targetDir = Join-Path $repoRoot "android\app\src\main\assets\public"

if (-not (Test-Path $sourceDir)) {
  throw "Build directory not found: $sourceDir"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$robocopyArgs = @(
  $sourceDir,
  $targetDir,
  "/E",
  "/NFL",
  "/NDL",
  "/NJH",
  "/NJS",
  "/NC",
  "/NS",
  "/NP"
)

& robocopy @robocopyArgs | Out-Null

if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}
