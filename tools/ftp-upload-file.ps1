param(
  [string]$LocalFile,
  [string]$RemotePath,
  [string]$FtpHost = "win8083.site4now.net",
  [string]$FtpUser = "mutaalhrm",
  [string]$FtpPass = "HrmDev!9Qx#4Lp7@Nz2"
)

$ErrorActionPreference = "Stop"
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
Write-Host "Uploaded $RemotePath"
