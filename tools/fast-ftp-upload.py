import os
from pathlib import Path
import ftplib
import time
import io

FTP_HOST = "win8083.site4now.net"
FTP_USER = "HRMDevelopmentAPIs"
FTP_PASS = "8TXyVSi9auVSkCd@"
LOCAL_DIR = Path("backend/publish").resolve()

print(f"Connecting to {FTP_HOST} as {FTP_USER}...")
ftp = ftplib.FTP(FTP_HOST, timeout=30)
ftp.login(FTP_USER, FTP_PASS)
ftp.set_pasv(True)
ftp.cwd("/HRMDevelopment")
print("Connected and in /HRMDevelopment!")

# 1. Take app offline to release IIS locks on DLLs
print("Placing app_offline.htm...")
try:
    ftp.storbinary("STOR app_offline.htm", io.BytesIO(b"<!DOCTYPE html><html><body>Updating...</body></html>"))
except Exception as e:
    print(f"Error putting offline: {e}")
time.sleep(3)

def ensure_remote_dir(relative_dir):
    parts = relative_dir.replace("\\", "/").strip("/").split("/")
    for p in parts:
        if not p:
            continue
        try:
            ftp.mkd(p)
        except Exception:
            pass
        try:
            ftp.cwd(p)
        except Exception:
            pass
    # return to base
    ftp.cwd("/HRMDevelopment")

# 2. Gather files (skip web.config)
files = [p for p in LOCAL_DIR.rglob("*") if p.is_file() and p.name.lower() != "web.config"]

# Non-dlls first, then dlls
def sort_key(p):
    ext = p.suffix.lower()
    return (1 if ext in [".dll", ".exe", ".pdb"] else 0, str(p))

files.sort(key=sort_key)

print(f"Uploading {len(files)} files...")
for f in files:
    rel = f.relative_to(LOCAL_DIR).as_posix()
    rel_dir = rel.rpartition("/")[0]
    filename = rel.rpartition("/")[2] if "/" in rel else rel

    if rel_dir:
        ensure_remote_dir(rel_dir)
        ftp.cwd("/HRMDevelopment/" + rel_dir)
    else:
        ftp.cwd("/HRMDevelopment")

    for attempt in range(1, 5):
        try:
            with open(f, "rb") as fp:
                ftp.storbinary(f"STOR {filename}", fp, blocksize=128*1024)
            print(f"UP: {rel}")
            break
        except Exception as e:
            if attempt >= 4:
                print(f"Failed to upload {rel}: {e}")
                raise
            print(f"Retry {attempt} for {rel} due to: {e}. Reconnecting...")
            time.sleep(2)
            try:
                ftp.quit()
            except Exception:
                pass
            ftp = ftplib.FTP(FTP_HOST, timeout=30)
            ftp.login(FTP_USER, FTP_PASS)
            ftp.set_pasv(True)
            if rel_dir:
                ftp.cwd("/HRMDevelopment/" + rel_dir)
            else:
                ftp.cwd("/HRMDevelopment")

ftp.cwd("/HRMDevelopment")

# 3. Bring app back online
print("Removing app_offline.htm...")
try:
    ftp.delete("app_offline.htm")
except Exception as e:
    print(f"Could not remove app_offline.htm: {e}")

ftp.quit()
print("All files successfully uploaded and app brought back online!")
