#!/usr/bin/env python3
"""Builds the app.

  src/Noting_Desk_base.html  (the PC file, unchanged)
+ src/addon/*  (iPhone layer, premium phone layout, sync)
+ src/vendor/* (QR code maker and reader, embedded so it works offline)
= docs/index.html  – the iPhone app on GitHub Pages AND the new Noting_Desk.html for the office PC
  docs/Noting_Desk.html – same file under the PC name, for direct download
  docs/sw.js, docs/manifest.webmanifest
"""
import base64, datetime, json, pathlib, re, sys
R = pathlib.Path(__file__).resolve().parent
SRC, OUT = R / 'src', R / 'docs'
ver = sys.argv[1] if len(sys.argv) > 1 else datetime.datetime.now().strftime('%Y.%m.%d-%H%M')

def rd(p): return (SRC / p).read_text(encoding='utf-8')
def js(s):
    assert '</script' not in s.lower(), 'script text must not contain </script'
    return s

html = rd('Noting_Desk_base.html')
assert html.count('</body>') == 1 and html.count('</head>') == 1

head = '''<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#eaf5ff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Noting Desk">
<meta name="format-detection" content="telephone=no">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="icons/icon-192.png">'''
logo = 'data:image/png;base64,' + base64.b64encode((OUT / 'icons/logo-64.png').read_bytes()).decode()
head = head.replace('<link rel="icon" type="image/png" href="icons/icon-192.png">', f'<link rel="icon" type="image/png" href="{logo}">')
head = head.replace('content="Noting Desk"', 'content="EPFO Desk"')
html, n = re.subn(r'<meta name="viewport"[^>]*>', head, html, count=1)
assert n == 1, 'viewport tag not found'
html = html.replace('<title>Noting Desk</title>', '<title>EPFO Desk</title>', 1)

tail = (
    f'<!-- ======== EPFO Desk {ver}: iPhone app layer + sync (built by build.py) ======== -->\n'
    f'<style id="nd-mobile-css">\n{rd("addon/nd-mobile.css")}</style>\n'
    f'<script id="nd-vendor-qrcode">/* qrcode-generator 1.4.4 · MIT · Kazuhiko Arase */\n{js(rd("vendor/qrcode.js"))}\n</script>\n'
    f'<script id="nd-vendor-jsqr">/* jsQR 1.4.0 · Apache-2.0 · Cosmo Wolfe */\n{js(rd("vendor/jsQR.js"))}\n</script>\n'
    f'<script id="nd-pwa-js">window.ND_APP_VER={json.dumps(ver)};window.ND_LOGO={json.dumps(logo)};\n{js(rd("addon/nd-pwa.js"))}</script>\n'
    f'<script id="nd-reader-js">\n{js(rd("addon/nd-reader.js"))}</script>\n'
    f'<script id="nd-heic-js">\n{js(rd("addon/nd-heic.js"))}</script>\n'
    f'<script type="text/plain" id="nd-heic-lib">/* libheif-js 1.19.8 · LGPL-3.0 · https://github.com/catdad-experiments/libheif-js – replaceable: put another build of libheif-bundle.js here */\n{js(rd("vendor/libheif-bundle.js"))}</script>\n'
    f'<script id="nd-members-js">\n{js(rd("addon/nd-members.js"))}</script>\n'
    f'<script id="nd-model">window.ND_MODEL={rd("addon/nd-model.json")};</script>\n'
    f'<script id="nd-learn-js">\n{js(rd("addon/nd-learn.js"))}</script>\n'
    f'<script id="nd-sync-js">\n{js(rd("addon/nd-sync.js"))}</script>\n'
)
html = html.replace('</body>', tail + '</body>')

OUT.mkdir(exist_ok=True)
(OUT / 'index.html').write_text(html, encoding='utf-8')
(OUT / 'Noting_Desk.html').write_text(html, encoding='utf-8')
(OUT / 'sw.js').write_text(rd('sw.template.js').replace('__VER__', ver), encoding='utf-8')
(OUT / 'manifest.webmanifest').write_text(json.dumps({
    'name': 'EPFO Desk', 'short_name': 'EPFO Desk', 'id': './', 'start_url': './', 'scope': './',
    'display': 'standalone', 'orientation': 'any', 'background_color': '#eaf5ff', 'theme_color': '#6f86c9',
    'description': 'Member search across your Excel sheets, notings, circulars, office orders, e-mails, work diary and IBB – offline, synced with the office PC.',
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
}, indent=1), encoding='utf-8')
(OUT / '.nojekyll').write_text('')
print(f'built {ver}: docs/index.html {len(html.encode())/1048576:.1f} MB')
