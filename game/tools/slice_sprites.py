#!/usr/bin/env python3
"""Key out magenta, split each raw sheet into pieces, trim, save to assets/img/<sheet>_<n>.png.
Usage: python3 tools/slice_sprites.py [sheet ...]   (default: every PNG/JPG/WEBP in assets/raw)
Pieces are ordered row by row, left to right. Writes assets/img/sheets.json with piece sizes."""
import sys, json, pathlib
from PIL import Image
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / 'assets/raw', ROOT / 'assets/img'
OUT.mkdir(parents=True, exist_ok=True)
MAXH = 256  # max piece height in px (game scales further)

def key(img):
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r - g) + (b - g)                      # high for magenta
    alpha = np.clip(255 - (mag - 180) * 255 // 140, 0, 255)  # 180..320 fade
    alpha[(r > 200) & (b > 200) & (g < 90)] = 0
    # despill: pull magenta tint out of edge pixels
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    edge = alpha < 255
    r = np.where(edge, r - spill // 2, r); b = np.where(edge, b - spill // 2, b)
    rgba = np.dstack([np.clip(r, 0, 255), g, np.clip(b, 0, 255), alpha]).astype(np.uint8)
    return rgba

def runs(mask1d, mingap):
    idx = np.where(mask1d)[0]
    if len(idx) == 0: return []
    out, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p > mingap: out.append((s, p + 1)); s = i
        p = i
    out.append((s, p + 1)); return out

def slice_sheet(path):
    rgba = key(Image.open(path))
    if not path.stem.startswith(('crow', 'great_shiny', 'title', 'overgrowth')):
        # bronze -> steel: desaturate 65% and cool slightly
        c = rgba[..., :3].astype(np.float32); l = c.mean(2, keepdims=True)
        c = l + (c - l) * 0.35; c[..., 2] *= 1.06; c[..., 0] *= 0.96
        rgba[..., :3] = np.clip(c, 0, 255).astype(np.uint8)
    solid = rgba[..., 3] > 40
    pieces = []
    for y0, y1 in runs(solid.any(1), 12):
        band = solid[y0:y1]
        for x0, x1 in runs(band.any(0), 10):
            sub = solid[y0:y1, x0:x1]
            ys = np.where(sub.any(1))[0]
            if sub.sum() < 400: continue  # specks
            pieces.append((x0, y0 + ys[0], x1, y0 + ys[-1] + 1))
    res = []
    for n, (x0, y0, x1, y1) in enumerate(pieces):
        im = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
        if im.height > MAXH:
            im = im.resize((max(1, round(im.width * MAXH / im.height)), MAXH), Image.LANCZOS)
        name = f'{path.stem}_{n}.png'
        im.save(OUT / name, optimize=True)
        res.append({'file': name, 'w': im.width, 'h': im.height})
    return res

if __name__ == '__main__':
    files = [RAW / a if '/' not in a else pathlib.Path(a) for a in sys.argv[1:]] or \
        sorted(p for p in RAW.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'))
    idx_path = OUT / 'sheets.json'
    idx = json.loads(idx_path.read_text()) if idx_path.exists() else {}
    for f in files:
        if f.stem == 'cutscene_rooftop':   # full background: just resize to jpg
            Image.open(f).convert('RGB').resize((720, 1280)).save(OUT / 'cutscene_rooftop.jpg', quality=82)
            idx[f.stem] = [{'file': 'cutscene_rooftop.jpg', 'w': 720, 'h': 1280}]
        else:
            idx[f.stem] = slice_sheet(f)
        print(f'{f.name}: {len(idx[f.stem])} pieces')
    idx_path.write_text(json.dumps(idx, indent=1))
