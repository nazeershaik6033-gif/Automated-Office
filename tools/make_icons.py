"""Draws the Noting Desk app icons (navy tile, 'ND' monogram, gold underline)."""
import sys
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]
FONT = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
def icon(size, pad_ratio=0.0, rounded=True):
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    g = Image.new('RGBA', (S, S))
    gd = ImageDraw.Draw(g)
    top, bot = (44, 106, 192), (16, 44, 92)
    for y in range(S):
        t = y / S
        gd.line([(0, y), (S, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * .22) if rounded else 0, fill=255)
    im.paste(g, (0, 0), mask)
    d = ImageDraw.Draw(im)
    inner = S * (1 - 2 * pad_ratio)
    f = ImageFont.truetype(FONT, int(inner * .42))
    tw = d.textlength('ND', font=f)
    bb = d.textbbox((0, 0), 'ND', font=f)
    th = bb[3] - bb[1]
    x, y = (S - tw) / 2, (S - th) / 2 - bb[1] - inner * .04
    d.text((x, y), 'ND', font=f, fill=(255, 255, 255, 255))
    uw, uy = inner * .34, y + bb[3] + inner * .07
    d.rounded_rectangle([(S - uw) / 2, uy, (S + uw) / 2, uy + inner * .045], radius=int(inner * .02), fill=(240, 190, 70, 255))
    return im.resize((size, size), Image.LANCZOS)
icon(180, rounded=False).convert('RGB').save(f'{out}/apple-touch-icon.png')
icon(192).save(f'{out}/icon-192.png')
icon(512).save(f'{out}/icon-512.png')
icon(512, pad_ratio=.1, rounded=False).save(f'{out}/icon-maskable-512.png')
