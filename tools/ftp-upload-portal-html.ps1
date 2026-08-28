param(
  [string]$LocalDir = (Join-Path $PSScriptRoot "..\frontend\out"),
  [string]$FtpHost = "win8083.site4now.net",
  [string]$FtpUser = "mutaalhrm",
  [string]$FtpPass = "HrmDev!9Qx#4Lp7@Nz2",
  [string]$RemoteRoot = "/"
)

$ErrorActionPreference = "Stop"
$LocalDir = (Resolve-Path $LocalDir).Path

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

function Remove-FtpFile([string]$RemotePath) {
  $uri = "ftp://$FtpHost$RemotePath"
  $req = [System.Net.FtpWebRequest]::Create($uri)
  $req.Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile
  $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
  $req.UsePassive = $true
  try {
    $res = $req.GetResponse()
    $res.Close()
    Write-Host "DEL $RemotePath"
  } catch {
    Write-Host "SKIP delete $RemotePath"
  }
}

Remove-FtpFile "/favicon.ico"

$htmlFiles = Get-ChildItem $LocalDir -Recurse -Filter "*.html"
foreach ($f in $htmlFiles) {
  $rel = $f.FullName.Substring($LocalDir.Length).TrimStart("\","/")
  $remote = "/$($rel -replace '\\','/')"
  Write-Host "UP $rel"
  Send-FtpFile $f.FullName $remote
}

Write-Host "Done. Updated $($htmlFiles.Count) HTML files and removed old favicon.ico."
