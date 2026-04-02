#!/usr/bin/env python3
"""
bump_version.py — Incrémente automatiquement la version dans index.html ET sw.js

Usage :
    python bump_version.py            → incrémente le BUILD (1.0.1 → 1.0.2)
    python bump_version.py minor      → incrémente le MINEUR (1.0.x → 1.1.0)
    python bump_version.py major      → incrémente le MAJEUR (1.x.x → 2.0.0)

Placer ce script dans le même dossier que index.html et sw.js.
"""

import re, sys, os
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
HTML_FILE = os.path.join(BASE, 'index.html')
SW_FILE   = os.path.join(BASE, 'sw.js')

with open(HTML_FILE, 'r', encoding='utf-8') as f:
    html = f.read()

match = re.search(r"const APP_VERSION = '(\d+)\.(\d+)\.(\d+)';", html)
if not match:
    print("Constante APP_VERSION introuvable dans index.html")
    sys.exit(1)

major, minor, build = int(match.group(1)), int(match.group(2)), int(match.group(3))
old_version = f"{major}.{minor}.{build}"

bump = sys.argv[1].lower() if len(sys.argv) > 1 else 'build'
if bump == 'major':
    major += 1; minor = 0; build = 0
elif bump == 'minor':
    minor += 1; build = 0
else:
    build += 1

new_version = f"{major}.{minor}.{build}"
build_date  = datetime.now().strftime("%d/%m/%Y")

html = html.replace(f"const APP_VERSION = '{old_version}';", f"const APP_VERSION = '{new_version}';")
html = re.sub(r"const APP_BUILD_DATE = '[^']+';", f"const APP_BUILD_DATE = '{build_date}';", html)
html = re.sub(r"v\d+\.\d+\.\d+ — \d{{2}}/\d{{2}}/\d{{4}}", f"v{new_version} — {build_date}", html)

with open(HTML_FILE, 'w', encoding='utf-8') as f:
    f.write(html)
print(f"index.html : v{old_version} -> v{new_version} ({build_date})")

if os.path.exists(SW_FILE):
    with open(SW_FILE, 'r', encoding='utf-8') as f:
        sw = f.read()
    sw = re.sub(r"const VERSION\s*=\s*'[\d.]+'", f"const VERSION  = '{new_version}'", sw)
    with open(SW_FILE, 'w', encoding='utf-8') as f:
        f.write(sw)
    print(f"sw.js      : VERSION -> '{new_version}'")
else:
    print("sw.js introuvable")

print(f"\nPret a deployer : git add . && git commit -m 'v{new_version}' && git push")
