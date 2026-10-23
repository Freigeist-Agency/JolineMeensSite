#!/usr/bin/env python3
import urllib.request
import urllib.parse
import re
import os

PAGES = [
    ("https://www.jolinemeens.de/en", "en/index.html", "/", "/en"),
    ("https://www.jolinemeens.de/en/privatkunden", "en/privatkunden.html", "/privatkunden", "/en/privatkunden"),
    ("https://www.jolinemeens.de/en/gewerbekunden", "en/gewerbekunden.html", "/gewerbekunden", "/en/gewerbekunden"),
    ("https://www.jolinemeens.de/en/expats", "en/expats.html", "/expats", "/en/expats"),
    ("https://www.jolinemeens.de/en/team", "en/team.html", "/team", "/en/team"),
    ("https://www.jolinemeens.de/en/faq", "en/faq.html", "/faq", "/en/faq"),
    ("https://www.jolinemeens.de/en/kontakt", "en/kontakt.html", "/kontakt", "/en/kontakt"),
    ("https://www.jolinemeens.de/en/datenschutz", "en/datenschutz.html", "/datenschutz", "/en/datenschutz"),
    ("https://www.jolinemeens.de/en/impressum", "en/impressum.html", "/impressum", "/en/impressum"),
    ("https://www.jolinemeens.de/en/downloads", "en/downloads.html", "/downloads", "/en/downloads"),
    ("https://www.jolinemeens.de/en/kristina-mitro", "en/kristina-mitro.html", "/kristina-mitro", "/en/kristina-mitro"),
]

HEAD_SCRIPT_REGULAR = """  <script>
    if (location.pathname.endsWith('.html')) {
      var clean = location.pathname.replace(/\\/index\\.html$/, '/').replace(/\\.html$/, '');
      location.replace(clean + location.search + location.hash);
    }
  </script>"""

FAVICONS = """  <link href="/images/favicon.png" rel="shortcut icon" type="image/x-icon">
  <link href="/images/webclip.png" rel="apple-touch-icon">"""

def sync_en():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    en_dir = os.path.join(root, "en")
    os.makedirs(en_dir, exist_ok=True)
    images_dir = os.path.join(root, "images")
    local_files = set(os.listdir(images_dir)) if os.path.isdir(images_dir) else set()

    print("Syncing English pages from www.jolinemeens.de/en...")
    for remote_url, local_rel_path, de_path, en_path in PAGES:
        local_path = os.path.join(root, local_rel_path)
        req = urllib.request.Request(remote_url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            content = urllib.request.urlopen(req).read().decode("utf-8")
        except Exception as e:
            print(f"Failed to fetch {remote_url}: {e}")
            continue

        # 0. Strip data-wf-domain
        content = re.sub(r'\s*data-wf-domain="[^"]*"', '', content)

        # 1. Use local stylesheets
        content = re.sub(
            r'<link href="https://cdn\.prod\.website-files\.com/[^"]+/css/joline-meens\.webflow\.shared\.[^"]+\.css"[^>]*>',
            '<link href="/css/normalize.css" rel="stylesheet" type="text/css">\n  <link href="/css/webflow.css" rel="stylesheet" type="text/css">\n  <link href="/css/joline-meens.webflow.css" rel="stylesheet" type="text/css">',
            content
        )

        # 2. Use local webflow.js
        content = re.sub(
            r'<script src="https://cdn\.prod\.website-files\.com/[^"]+/js/webflow\.schunk\.[^"]+\.js"[^>]*></script>.*?'
            r'<script src="https://cdn\.prod\.website-files\.com/[^"]+/js/webflow\.[^"]+\.js"[^>]*></script>',
            '<script src="/js/webflow.js" type="text/javascript"></script>',
            content,
            flags=re.DOTALL
        )

        # 3. Clean and normalize favicons & suppress badge
        content = re.sub(
            r'<link href="https://cdn\.prod\.website-files\.com/[^"]+favicon\.png"[^>]*>',
            '',
            content
        )
        content = re.sub(
            r'<link href="https://cdn\.prod\.website-files\.com/[^"]+Webclip\.png"[^>]*>',
            '',
            content
        )
        content = content.replace("</head>", f"{FAVICONS}\n  <style>.w-webflow-badge {{ display: none !important; }}</style>\n</head>", 1)

        # 4. Inject head clean URL redirect
        if "location.pathname.endsWith" not in content:
            if '<meta charset="utf-8"/>' in content:
                content = content.replace('<meta charset="utf-8"/>', f'<meta charset="utf-8"/>\n{HEAD_SCRIPT_REGULAR}', 1)
            elif '<meta charset="utf-8">' in content:
                content = content.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n{HEAD_SCRIPT_REGULAR}', 1)

        # 5. Normalize CDN images to local /images/ if file exists locally
        def replacer(m):
            filename = urllib.parse.unquote(m.group(1))
            if filename in local_files:
                return f'/images/{filename}'
            return m.group(0)

        content = re.sub(
            r'https://cdn\.prod\.website-files\.com/6800fc643315cfd12d2f6fa5/(?:[0-9a-f]{24}_)?([a-zA-Z0-9_\-\.%]+)',
            replacer,
            content
        )

        # 6. Normalize internal navigation links
        content = re.sub(r'href="https://jolinemeens\.de/en([^"]*)"', r'href="/en\1"', content)
        content = re.sub(r'href="https://www\.jolinemeens\.de/en([^"]*)"', r'href="/en\1"', content)

        # 7. Language Switcher in navbar on EN page -> points to matching German page {de_path}
        # In navbar: <a href="https://jolinemeens.de" class="nav-link w-inline-block"><div class="text-block-7">DE</div>...
        content = re.sub(
            r'(<li class="nav-menu-list-item">\s*<a href=")[^"]*(" class="nav-link w-inline-block">\s*<div class="text-block-7">DE</div>)',
            rf'\g<1>{de_path}\2',
            content
        )

        # 8. Language Switcher in footer on EN page -> points to matching German page {de_path}
        content = re.sub(
            r'(<a href=")[^"]*(" class="footer-link w-inline-block">\s*<div>Language: DE / EN</div>\s*</a>)',
            rf'\g<1>{de_path}\2',
            content
        )

        with open(local_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Synced {local_rel_path} -> DE: {de_path}, EN: {en_path}")

if __name__ == "__main__":
    sync_en()
