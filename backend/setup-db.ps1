# Saves Neon connection into .NET user-secrets (JSON) without CLI '=' truncation.
param(
  [string]$DatabaseUrl = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $DatabaseUrl) {
  $demoEnv = Join-Path $env:USERPROFILE "Desktop\DigitalDive-HR-Demo\.env"
  if (Test-Path $demoEnv) {
    $line = Get-Content $demoEnv | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($line) {
      $DatabaseUrl = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"')
      Write-Host "Found DATABASE_URL from DigitalDive-HR-Demo\.env"
    }
  }
}

if (-not $DatabaseUrl) {
  Write-Host "Paste your Neon DATABASE_URL, then press Enter:"
  $DatabaseUrl = Read-Host
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "No DATABASE_URL provided."
}

function Normalize-Conn([string]$raw) {
  $value = $raw.Trim().Trim('"')
  if ($value -notmatch '^(postgres|postgresql)://') { return $value }

  if ($value -match '^(postgres(?:ql)?)://([^:]+):([^@]+)@([^/:]+)(?::(\d+))?/([^?]+)(?:\?(.*))?$') {
    $user = [uri]::UnescapeDataString($Matches[2])
    $pass = [uri]::UnescapeDataString($Matches[3])
    $hostName = $Matches[4]
    $port = if ($Matches[5]) { $Matches[5] } else { "5432" }
    $db = [uri]::UnescapeDataString($Matches[6].TrimEnd('/'))
    $query = $Matches[7]
    $ssl = "Require"
    if ($query -and $query -match 'sslmode=([^&]+)') {
      switch ($Matches[1]) {
        "disable" { $ssl = "Disable" }
        "prefer" { $ssl = "Prefer" }
        "require" { $ssl = "Require" }
        "verify-ca" { $ssl = "VerifyCA" }
        "verify-full" { $ssl = "VerifyFull" }
        default { $ssl = "Require" }
      }
    }
    return "Host=$hostName;Port=$port;Username=$user;Password=$pass;Database=$db;SSL Mode=$ssl;Trust Server Certificate=true"
  }
  return $value
}

$normalized = Normalize-Conn $DatabaseUrl
$csproj = Get-ChildItem *.csproj | Select-Object -First 1
$xml = [xml](Get-Content $csproj.FullName -Raw)
$id = @($xml.Project.PropertyGroup | ForEach-Object { $_.UserSecretsId } | Where-Object { $_ }) | Select-Object -First 1
if (-not $id) { throw "UserSecretsId not found in csproj" }

$dir = Join-Path $env:APPDATA "Microsoft\UserSecrets\$id"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$path = Join-Path $dir "secrets.json"

# Build JSON manually so password special chars stay intact
$escaped = $normalized.Replace('\', '\\').Replace('"', '\"')
@"
{
  "ConnectionStrings:Neon": "$escaped"
}
"@ | Set-Content -Path $path -Encoding UTF8

if ($normalized -notmatch '^Host=') {
  throw "Normalization failed — connection string is still a URI."
}

Write-Host "Saved ConnectionStrings:Neon to user-secrets (keyword format)."
Write-Host "Next: run.cmd"
Write-Host "Swagger: http://localhost:5088/swagger"
