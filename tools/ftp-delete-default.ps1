param(
  [string]$FtpHost = "win8083.site4now.net",
  [string]$FtpUser = "mutaalhrm",
  [string]$FtpPass = "HrmDev!9Qx#4Lp7@Nz2"
)

$ErrorActionPreference = "Stop"

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
    Write-Host "SKIP $RemotePath ($($_.Exception.Message))"
  }
}

foreach ($name in @("/Default.asp", "/default.asp", "/index.asp")) {
  Remove-FtpFile $name
}

Write-Host "Done removing default placeholder pages."
