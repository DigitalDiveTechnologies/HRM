param(
  [string]$LocalDir = (Join-Path $PSScriptRoot "..\backend\publish"),
  [string]$FtpHost = "win8083.site4now.net",
  [string]$FtpUser = "HRMDevelopmentAPIs",
  [string]$FtpPass = "8TXyVSi9auVSkCd@",
  [string]$RemoteRoot = "/HRMDevelopment"
)

$ErrorActionPreference = "Stop"
$LocalDir = (Resolve-Path $LocalDir).Path
$RemoteRoot = $RemoteRoot.TrimEnd("/")

function New-FtpDirectory([string]$Path) {
  $uri = "ftp://$FtpHost$Path"
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
  $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
  $req.UsePassive = $true
  try {
    $res = $req.GetResponse()
    $res.Close()
  } catch {
    # already exists
  }
}

function Delete-FtpFile([string]$RemotePath) {
  $uri = "ftp://$FtpHost$RemotePath"
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile
  $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
  $req.UsePassive = $true
  try {
    $res = $req.GetResponse()
    $res.Close()
  } catch {
    # ignore if missing
  }
}

function Send-FtpText([string]$RemotePath, [string]$Text) {
  $tmp = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($tmp, $Text)
  try {
    Send-FtpFile $tmp $RemotePath
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

function Send-FtpFile([string]$LocalFile, [string]$RemotePath) {
  $uri = "ftp://$FtpHost$RemotePath"
  $bytes = [System.IO.File]::ReadAllBytes($LocalFile)
  $maxAttempts = 5
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
      $req = [System.Net.FtpWebRequest]::Create($uri)
      $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
      $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
      $req.UseBinary = $true
      $req.UsePassive = $true
      $req.KeepAlive = $false
      $req.ContentLength = $bytes.Length
      $stream = $req.GetRequestStream()
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Close()
      $res = $req.GetResponse()
      $res.Close()
      return
    } catch {
      if ($attempt -eq $maxAttempts) { throw }
      Write-Host "Retry $attempt for $RemotePath (file may be locked)..."
      Start-Sleep -Seconds 3
    }
  }
}

# Ensure remote root exists
New-FtpDirectory $RemoteRoot | Out-Null

$files = Get-ChildItem $LocalDir -Recurse -File
$lockedExt = @('.dll', '.exe', '.pdb')
$staticFiles = $files | Where-Object {
  # Site4Now keeps web.config locked while the application is running. It is
  # already provisioned on the server, so leave it in place during deployments.
  $_.Name -ne 'web.config' -and $lockedExt -notcontains $_.Extension.ToLowerInvariant()
} | Sort-Object {
  if ($_.Name -eq 'web.config') { 0 } else { 1 }
}
$binFiles = $files | Where-Object { $lockedExt -contains $_.Extension.ToLowerInvariant() } | Sort-Object Name

function Upload-Batch($batch) {
  $createdDirs = @{}
  foreach ($f in $batch) {
    $rel = $f.FullName.Substring($LocalDir.Length).TrimStart("\","/")
    $remote = "$RemoteRoot/$($rel -replace '\\','/')"
    $remoteDir = ($remote -replace '/[^/]+$','')
    if ($remoteDir -and -not $createdDirs.ContainsKey($remoteDir)) {
      $parts = $remoteDir.Trim("/").Split("/")
      $acc = ""
      foreach ($p in $parts) {
        $acc += "/$p"
        New-FtpDirectory $acc | Out-Null
      }
      $createdDirs[$remoteDir] = $true
    }
    Write-Host "UP $rel"
    Send-FtpFile $f.FullName $remote
  }
}

# Site4Now can lock generated/static files while the API is running, so use
# one short maintenance window for the complete publish output.
Write-Host "Taking app offline for deployment..."
Delete-FtpFile "$RemoteRoot/app_offline.htm"
Send-FtpText "$RemoteRoot/app_offline.htm" "<!DOCTYPE html><html><body><p>Updating…</p></body></html>"
Start-Sleep -Seconds 3
try {
  Write-Host "Uploading non-binary files..."
  Upload-Batch $staticFiles
  Write-Host "Uploading binaries..."
  Upload-Batch $binFiles
} finally {
  Write-Host "Bringing app back online..."
  Delete-FtpFile "$RemoteRoot/app_offline.htm"
}

Write-Host "Done. Uploaded $($files.Count) files to ftp://$FtpHost$RemoteRoot"
