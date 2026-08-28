param(
  [string]$LocalDir = (Join-Path $PSScriptRoot "..\backend\publish"),
  [string]$FtpHost = "win8083.site4now.net",
  [string]$FtpUser = "mutaalhrm",
  [string]$FtpPass = "HrmDev!9Qx#4Lp7@Nz2",
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

function Send-FtpFile([string]$LocalFile, [string]$RemotePath) {
  $uri = "ftp://$FtpHost$RemotePath"
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
  $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
  $req.UseBinary = $true
  $req.UsePassive = $true
  $bytes = [System.IO.File]::ReadAllBytes($LocalFile)
  $req.ContentLength = $bytes.Length
  $stream = $req.GetRequestStream()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()
  $res = $req.GetResponse()
  $res.Close()
}

# Ensure remote root exists
New-FtpDirectory $RemoteRoot | Out-Null

$files = Get-ChildItem $LocalDir -Recurse -File
$createdDirs = @{}
foreach ($f in $files) {
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

Write-Host "Done. Uploaded $($files.Count) files to ftp://$FtpHost$RemoteRoot"
