#!/usr/bin/env python3
"""Build a single self-contained offline preview HTML with base64-embedded screenshots."""
import base64
import re
from pathlib import Path

SRC = Path("/home/z/my-project/download/preview")
OUT = Path("/home/z/my-project/download/Proxy-Panel-Offline-Preview.html")

html = (SRC / "index.html").read_text(encoding="utf-8")

html = html.replace(
    "Every screen of the redesigned panel, captured live. No internet needed to view this file.",
    "Every screen of the redesigned panel, captured live. This single file is fully "
    "self-contained — all 11 screenshots are embedded inside it, so it works with no "
    "internet and no other files.",
)
html = html.replace(
    "<title>Proxy Panel — Offline Preview Gallery</title>",
    "<title>Proxy Panel — Offline Preview (single file)</title>",
)


def embed(match: re.Match) -> str:
    fname = match.group(1)
    path = SRC / fname
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f'src="data:image/png;base64,{data}"'


html, n = re.subn(r'src="([^"]+\.png)"', embed, html)
OUT.write_text(html, encoding="utf-8")
size_mb = OUT.stat().st_size / 1024 / 1024
print(f"embedded {n} images -> {OUT} ({size_mb:.2f} MB)")
assert n == 11, f"expected 11 images, embedded {n}"
