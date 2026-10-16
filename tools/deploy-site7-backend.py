"""Publish the HRM API to the site7 FTP root from GitHub Actions."""

import io
import json
import os
from pathlib import Path
import ssl
import sys
import time
from ftplib import FTP_TLS, error_perm
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
import xml.etree.ElementTree as ET


FTP_HOST = "win8083.site4now.net"
FTP_USER = "hrmproduction"
SITE_URL = "https://digitaldivetech-001-site7.gtempurl.com"
REQUIRED_RBAC_PATHS = {
    "/api/rbac/roles",
    "/api/rbac/users",
    "/api/rbac/permission-matrix",
}


class Site7FTP_TLS(FTP_TLS):
    def storbinary(self, cmd, fp, blocksize=8192, callback=None, rest=None):
        """Close the protected data socket without waiting for TLS close_notify.

        The site7 FTP server accepts the upload but does not answer Python's
        SSLSocket.unwrap() shutdown handshake on STOR connections.
        """
        self.voidcmd("TYPE I")
        with self.transfercmd(cmd, rest) as conn:
            while block := fp.read(blocksize):
                conn.sendall(block)
                if callback:
                    callback(block)
        return self.voidresp()


def connect(password: str) -> FTP_TLS:
    ftp = Site7FTP_TLS(context=ssl.create_default_context(), timeout=30)
    ftp.connect(FTP_HOST, 21)
    ftp.login(FTP_USER, password)
    ftp.prot_p()
    ftp.set_pasv(True)
    ftp.cwd("/")
    return ftp


def close(ftp: FTP_TLS | None) -> None:
    if ftp is not None:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


def check_server_config(ftp: FTP_TLS) -> None:
    names = {name.rstrip("/").replace("\\", "/").rsplit("/", 1)[-1].lower() for name in ftp.nlst()}
    if "appsettings.production.json" not in names:
        raise RuntimeError("Server appsettings.Production.json is missing; deployment stopped.")
    if "web.config" not in names:
        raise RuntimeError("Server web.config is missing; deployment stopped.")

    data = io.BytesIO()
    ftp.retrbinary("RETR /web.config", data.write)
    root = ET.fromstring(data.getvalue())
    production = any(
        node.attrib.get("name", "").upper() == "ASPNETCORE_ENVIRONMENT"
        and node.attrib.get("value") == "Production"
        for node in root.iter("environmentVariable")
    )
    if not production:
        raise RuntimeError("Server web.config does not set ASPNETCORE_ENVIRONMENT=Production.")


def publish_files(publish_dir: Path) -> list[Path]:
    files = []
    for path in publish_dir.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(publish_dir)
        parts = [part.lower() for part in relative.parts]
        name = path.name.lower()
        if name.startswith("appsettings") and name.endswith(".json"):
            continue
        if name in {"web.config", "app_offline.htm"}:
            continue
        if parts[:2] == ["wwwroot", "uploads"] or "logs" in parts:
            continue
        files.append(path)
    if not any(path.name == "DigitalDive.Hr.Api.dll" for path in files):
        raise RuntimeError("Publish output is missing DigitalDive.Hr.Api.dll.")
    return sorted(files, key=lambda path: (path.suffix.lower() in {".dll", ".exe", ".pdb"}, str(path)))


def ensure_directory(ftp: FTP_TLS, directory: str) -> None:
    current = ""
    for part in directory.strip("/").split("/"):
        if not part:
            continue
        current += "/" + part
        try:
            ftp.mkd(current)
        except error_perm as exc:
            if not str(exc).startswith("550"):
                raise
            ftp.cwd(current)
            ftp.cwd("/")


def upload(ftp: FTP_TLS, local: Path, root: Path) -> None:
    relative = local.relative_to(root).as_posix()
    directory = relative.rpartition("/")[0]
    if directory:
        ensure_directory(ftp, directory)
    for attempt in range(1, 6):
        try:
            with local.open("rb") as stream:
                ftp.storbinary(f"STOR /{relative}", stream, blocksize=256 * 1024)
            print(f"Uploaded {relative}", flush=True)
            return
        except Exception:
            if attempt == 5:
                raise
            time.sleep(3)


def verify_api() -> None:
    for attempt in range(1, 13):
        try:
            with urlopen(f"{SITE_URL}/swagger/v1/swagger.json", timeout=20) as response:
                paths = json.load(response)["paths"]
            missing = REQUIRED_RBAC_PATHS - paths.keys()
            if missing:
                raise RuntimeError(f"Missing RBAC routes: {', '.join(sorted(missing))}")
            try:
                urlopen(f"{SITE_URL}/api/rbac/permission-matrix", timeout=20)
            except HTTPError as exc:
                if exc.code == 401:
                    print("Verified site7 RBAC routes and unauthenticated 401.", flush=True)
                    return
                raise RuntimeError(f"Permission matrix returned HTTP {exc.code}, expected 401") from exc
            raise RuntimeError("Permission matrix allowed an unauthenticated request.")
        except (RuntimeError, URLError, TimeoutError, KeyError, ValueError) as exc:
            if attempt == 12:
                raise RuntimeError("Site7 did not pass post-deploy checks.") from exc
            time.sleep(5)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: deploy-site7-backend.py PUBLISH_DIRECTORY")
    password = os.environ.get("SITE7_FTP_PASSWORD")
    if not password:
        raise RuntimeError("GitHub secret SITE7_FTP_PASSWORD is missing.")
    root = Path(sys.argv[1]).resolve(strict=True)
    files = publish_files(root)
    ftp = connect(password)
    offline = False
    try:
        check_server_config(ftp)
        offline = True
        ftp.storbinary("STOR /app_offline.htm", io.BytesIO(b"<html><body>Updating...</body></html>"))
        time.sleep(3)
        for path in files:
            upload(ftp, path, root)
    finally:
        if offline:
            try:
                ftp.delete("/app_offline.htm")
            except Exception:
                close(ftp)
                ftp = connect(password)
                ftp.delete("/app_offline.htm")
        close(ftp)
    verify_api()


if __name__ == "__main__":
    main()
