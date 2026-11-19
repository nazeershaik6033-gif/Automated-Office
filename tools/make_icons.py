"""Builds the EPFO Desk icons from src/brand/logo_source.png:
black background removed, logo centred on a light-blue rounded tile."""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFilter
R = pathlib.Path(__file__).resolve().parent.parent
src = Image.open(R / 'src/brand/logo_source.png').convert('RGBA')
px = src.load()
w, h = src.size
for y in range(h):                      # near-black -> transparent (soft edge)
    for x in range(w):
        r, g, b, a = px[x, y]
        m = max(r, g, b)
        if m < 18: px[x, y] = (r, g, b, 0)
        elif m < 45: px[x, y] = (r, g, b, int(255 * (m - 18) / 27))
logo = src.crop(src.getbbox())
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
TOP, BOT = (234, 245, 255), (196, 226, 250)
def tile(size, scale=0.84, rounded=True, shadow=True):
    S = size * 4
    bg = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(bg)
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=tuple(int(TOP[i] + (BOT[i] - TOP[i]) * t) for i in range(3)) + (255,))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * .22) if rounded else 0, fill=255)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); im.paste(bg, (0, 0), mask)
    lw = int(S * scale); lh = int(logo.height * lw / logo.width)
    lg = logo.resize((lw, lh), Image.LANCZOS)
    x, y = (S - lw) // 2, (S - lh) // 2
    if shadow:
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        sh.paste((20, 40, 90, 70), (x, y + S // 60), lg.split()[3])
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(S // 70)))
    im.alpha_composite(lg, (x, y))
    return im.resize((size, size), Image.LANCZOS)
tile(180, rounded=False).convert('RGB').save(out / 'apple-touch-icon.png')
tile(192).save(out / 'icon-192.png')
tile(512).save(out / 'icon-512.png')
tile(512, scale=.66, rounded=False).save(out / 'icon-maskable-512.png')
tile(64).save(out / 'logo-64.png')
lw = 256; logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS).save(out / 'logo-plain.png')
print('icons written to', out)
