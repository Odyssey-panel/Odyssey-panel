#!/usr/bin/env python3
"""Assemble the Bashar Panel single-file offline interactive preview."""
import base64
from pathlib import Path

SRC = Path("/home/z/my-project/scripts/panel_src")
ASSETS = Path("/home/z/my-project/scripts/assets")
OUT = Path("/home/z/my-project/download/Bashar-Panel-Offline.html")

parts = [
    (SRC / "part1_head.html").read_text(encoding="utf-8"),
    (SRC / "part2_body.html").read_text(encoding="utf-8"),
    (SRC / "part3a_core.js").read_text(encoding="utf-8"),
    (SRC / "part3b_views.js").read_text(encoding="utf-8"),
]
html = "\n".join(parts)

# embed fonts
for weight in ("400", "500", "700"):
    b64 = base64.b64encode((ASSETS / f"Vazirmatn-{dict( zip(['400','500','700'],['Regular','Medium','Bold']))[weight]}.woff2").read_bytes()).decode("ascii")
    placeholder = "{{VAZIR_" + weight + "}}"
    assert placeholder in html, f"missing {placeholder}"
    html = html.replace(placeholder, b64)

# embed QR svg (single-quoted JS string; svg contains only double quotes)
qr = (ASSETS / "qr.svg").read_text(encoding="utf-8").strip().replace("\n", "")
assert "'" not in qr
assert "{{QR_SVG}}" in html
html = html.replace("{{QR_SVG}}", "'" + qr + "'")

leftover = html.count("{{")
assert leftover == 0, f"{leftover} unresolved placeholders"

OUT.write_text(html, encoding="utf-8")
print(f"OK -> {OUT} ({OUT.stat().st_size/1024:.0f} KB)")
