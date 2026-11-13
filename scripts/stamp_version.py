#!/usr/bin/env python3
"""
Stamp the Odyssey version (V15.2) at the bottom of both logo sheets.

- public/logo-light.jpg  (navy linework on ivory)
- public/logo-dark.jpg   (cyan sail + silver arc on midnight)

The text is drawn in the brand display font (Outfit Bold, converted from the
self-hosted woff2) with wide tracking, color-matched to each sheet, centered
in the empty band below the tagline. Untouched originals are backed up to
brand/originals/ and a user-facing copy set goes to download/.
"""
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path('/home/z/my-project')
VERSION = 'V15.2'
TRACK_EM = 0.22  # letter tracking, in em

SHEETS = [
    {
        'src': ROOT / 'public/logo-light.jpg',
        # fallback navy; real color is sampled from the wordmark row
        'fallback': (30, 42, 72),
        'sample': 'dark',   # pick the darkest ink pixel on the scan row
    },
    {
        'src': ROOT / 'public/logo-dark.jpg',
        'fallback': (103, 219, 240),
        'sample': 'bright',  # pick the brightest cyan pixel on the scan row
    },
]

BACKUP_DIR = ROOT / 'brand/originals'
DL_DIR = Path('/home/z/my-project/download/odyssey-logo-V15.2')


def woff2_to_ttf(src: Path, dst: Path) -> Path:
    f = TTFont(str(src))
    f.flavor = None  # decompress woff2 -> plain ttf
    f.save(str(dst))
    return dst


def sample_color(img: Image.Image, mode: str) -> tuple:
    """Sample the sheet's ink color.
    light: darkest ink in the ODYSSEY wordmark band (~62% height) -> navy.
    dark: brightest saturated pixel anywhere -> the cyan of the sail."""
    w, h = img.size
    px = img.convert('RGB')
    best, best_score = None, None
    if mode == 'dark':
        y0, y1, step = 0, h, 4
    else:
        y0, y1, step = int(h * 0.58), int(h * 0.70), 2
    for y in range(y0, y1, step):
        for x in range(0, w, 3):
            r, g, b = px.getpixel((x, y))
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            sat = max(r, g, b) - min(r, g, b)
            # on dark sheets prefer the saturated brand color (cyan) over silver
            score = (255 - lum if mode == 'dark' else lum) + 0.9 * sat * (mode == 'bright')
            if best_score is None or score > best_score:
                best, best_score = (r, g, b), score
    return best or (0, 0, 0)


def draw_tracked(draw: ImageDraw.ImageDraw, xy_center_bottom: tuple, text: str,
                 font: ImageFont.FreeTypeFont, fill: tuple, canvas_w: int):
    """Draw `text` centered on canvas_w with the baseline at xy_center_bottom[1]."""
    baseline = xy_center_bottom[1]
    widths = []
    for ch in text:
        bbox = font.getbbox(ch)
        widths.append(bbox[2] - bbox[0])
    size = font.size
    track = size * TRACK_EM
    total = sum(widths) + track * (len(text) - 1)
    x = (canvas_w - total) / 2
    for ch, w in zip(text, widths):
        draw.text((x, baseline), ch, font=font, fill=fill, anchor='ls')
        x += w + track


def stamp(sheet: dict, font: ImageFont.FreeTypeFont, out_path: Path):
    img = Image.open(sheet['src']).convert('RGB')
    w, h = img.size
    color = sample_color(img, sheet['sample'])
    # keep the sampled ink from being too faint against the sheet
    lum = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]
    if lum < 90:    # ink darker than readable on a dark sheet -> soften not needed
        pass
    size = int(h * 0.030)
    font_v = ImageFont.truetype(str(font), size)
    baseline = int(h * 0.925)
    draw = ImageDraw.Draw(img)
    draw_tracked(draw, (w / 2, baseline), VERSION, font_v, color, w)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, 'JPEG', quality=93, optimize=True)
    print(f'stamped {out_path.name}: {w}x{h}, ink={color}, font_size={size}, baseline={baseline}')


def main():
    # 1. backups first — the untouched originals must survive
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for s in SHEETS:
        dst = BACKUP_DIR / s['src'].name
        if not dst.exists():
            shutil.copy2(s['src'], dst)
            print(f'backup original -> {dst.relative_to(ROOT)}')
        else:
            print(f'backup already present -> {dst.relative_to(ROOT)}')

    # 2. brand font
    ttf = woff2_to_ttf(ROOT / 'public/fonts/outfit-700.woff2', Path('/tmp/outfit-700.ttf'))
    print('font ready:', ttf)

    # 3. stamp in place (public/) and also write user-facing copies to download/
    DL_DIR.mkdir(parents=True, exist_ok=True)
    for s in SHEETS:
        stamped = Path('/tmp') / s['src'].name
        stamp(s, ttf, stamped)
        shutil.copy2(stamped, s['src'])            # into the app
        shutil.copy2(stamped, DL_DIR / s['src'].name)  # for the user
    shutil.copy2(BACKUP_DIR / 'logo-light.jpg', DL_DIR / 'original-logo-light.jpg')
    shutil.copy2(BACKUP_DIR / 'logo-dark.jpg', DL_DIR / 'original-logo-dark.jpg')
    print('done — stamped + backups in place')


if __name__ == '__main__':
    main()
