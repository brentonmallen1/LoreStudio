"""Smoke-check a running desktop backend: sign in, export the demo story in each format
WeasyPrint and pandoc serve, and run the local prose checks (spaCy).

    python desktop/backend/check_exports.py <port> <data-dir> [out-dir]
"""

import json
import sys
import urllib.request
from pathlib import Path

port, data = int(sys.argv[1]), Path(sys.argv[2])
out = Path(sys.argv[3]) if len(sys.argv) > 3 else None
api = f"http://127.0.0.1:{port}/api"


def call(path, body=None, token=None, raw=False):
    req = urllib.request.Request(api + path, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=300) as res:
        return res.read() if raw else json.load(res)


password = (data / ".admin_password").read_text().strip()
token = call("/auth/login", {"username": "admin", "password": password})["access_token"]
story = next(s for s in call("/stories", token=token) if s["title"] == "The Last Lighthouse")
print("signed in; story:", story["title"])

for fmt, magic in (("pdf", b"%PDF"), ("docx", b"PK"), ("epub", b"PK"), ("odt", b"PK"), ("markdown", b"")):
    try:
        body = call(f"/stories/{story['id']}/export", {"format": fmt}, token, raw=True)
        ok = body.startswith(magic) and len(body) > 1000
        print(f"export {fmt:9} {'ok' if ok else 'BAD'} {len(body):>9,} bytes")
        if out:
            out.mkdir(parents=True, exist_ok=True)
            (out / f"lighthouse.{fmt}").write_bytes(body)
    except Exception as e:  # noqa: BLE001 — a smoke check reports every failure
        print(f"export {fmt:9} FAILED {e}")

# spaCy: the dialogue analysis parses a character's lines with the bundled English model.
characters = call(f"/stories/{story['id']}/characters", token=token)
eleanor = next(c for c in characters if c["name"].startswith("Eleanor"))
try:
    result = call(f"/characters/{eleanor['id']}/analyze-dialogue", {}, token)
    print("spaCy dialogue analysis ok:", ", ".join(sorted(result)[:4]))
except Exception as e:  # noqa: BLE001
    print("spaCy dialogue analysis FAILED", e)
