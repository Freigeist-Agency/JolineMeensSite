#!/usr/bin/env python3
import glob
import os
import re

HEAD_SCRIPT_REGULAR = """  <script>
    if (location.pathname.endsWith('.html')) {
      var clean = location.pathname.replace(/\\/index\\.html$/, '/').replace(/\\.html$/, '');
      location.replace(clean + location.search + location.hash);
    }
  </script>"""

HEAD_SCRIPT_404 = """  <script>
    if (location.pathname.endsWith('.html')) {
      var clean = location.pathname.replace(/\\/index\\.html$/, '/').replace(/\\.html$/, '');
      location.replace(clean + location.search + location.hash);
    } else if (location.pathname.length > 1 && location.pathname.endsWith('/')) {
      location.replace(location.pathname.replace(/\\/+$/, '') + location.search + location.hash);
    }
  </script>"""

BADGE_STYLE = "  <style>.w-webflow-badge { display: none !important; }</style>"

PAGE_MAPPING = {
    "index": ("/", "/en"),
    "privatkunden": ("/privatkunden", "/en/privatkunden"),
    "gewerbekunden": ("/gewerbekunden", "/en/gewerbekunden"),
    "expats": ("/expats", "/en/expats"),
    "team": ("/team", "/en/team"),
    "faq": ("/faq", "/en/faq"),
    "kontakt": ("/kontakt", "/en/kontakt"),
    "datenschutz": ("/datenschutz", "/en/datenschutz"),
    "impressum": ("/impressum", "/en/impressum"),
    "downloads": ("/downloads", "/en/downloads"),
    "kristina-mitro": ("/kristina-mitro", "/en/kristina-mitro"),
}

def clean_html_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    filename = os.path.basename(file_path)
    stem = os.path.splitext(filename)[0]
    is_en = os.path.basename(os.path.dirname(file_path)) == "en"
    prefix = "/en" if is_en else ""

    de_target, en_target = PAGE_MAPPING.get(stem, ("/", "/en"))

    # 1. Ensure head script is present
    target_script = HEAD_SCRIPT_404 if filename == "404.html" else HEAD_SCRIPT_REGULAR
    if "location.pathname.endsWith" not in content:
        if '<meta charset="utf-8">' in content:
            content = content.replace(
                '<meta charset="utf-8">',
                '<meta charset="utf-8">\n' + target_script,
                1
            )
        elif '<meta charset="utf-8"/>' in content:
            content = content.replace(
                '<meta charset="utf-8"/>',
                '<meta charset="utf-8"/>\n' + target_script,
                1
            )
        elif '<head>' in content:
            content = content.replace(
                '<head>',
                '<head>\n' + target_script,
                1
            )

    # 2. Suppress Webflow badge
    if ".w-webflow-badge" not in content:
        content = content.replace("</head>", f"{BADGE_STYLE}\n</head>", 1)

    # 3. Strip data-wf-domain if present
    content = re.sub(r'\s*data-wf-domain="[^"]*"', '', content)

    # 4. Clean internal href links
    def replace_href(m):
        quote = m.group(1)
        target = m.group(2)
        tail = m.group(3) or ""  # query params or hash

        clean_target = target.lstrip("./")

        if clean_target == "index.html":
            target_path = f"{prefix}/" if prefix else "/"
            return f'href={quote}{target_path}{tail}{quote}'
        elif clean_target.endswith(".html"):
            slug = clean_target[:-5]
            target_path = f"{prefix}/{slug}"
            return f'href={quote}{target_path}{tail}{quote}'
        return m.group(0)

    pattern = re.compile(r'href=(["\'])(?:\./)?([a-zA-Z0-9_\-]+\.html)([#?][^"\']*)?\1')
    content = pattern.sub(replace_href, content)

    # 5. Clean /en/*.html links inside en pages
    content = re.sub(r'href="/en/([a-zA-Z0-9_\-]+)\.html"', r'href="/en/\1"', content)

    # 6. Normalize hardcoded domain anchor links
    content = content.replace('href="https://jolinemeens.de/privatkunden#BF-Info"', 'href="/privatkunden#BF-Info"')
    content = content.replace('href="https://jolinemeens.de/gewerbekunden#BFInfo"', 'href="/gewerbekunden#BFInfo"')
    content = content.replace('href="https://jolinemeens.de/en/privatkunden#BF-Info"', 'href="/en/privatkunden#BF-Info"')
    content = content.replace('href="https://jolinemeens.de/en/gewerbekunden#BFInfo"', 'href="/en/gewerbekunden#BFInfo"')

    # 7. Wire language switchers
    if is_en:
        # On English page: navbar link is DE -> points to de_target
        content = re.sub(
            r'(<a href=")[^"]*(" class="nav-link w-inline-block">\s*<div class="text-block-7">DE</div>)',
            rf'\g<1>{de_target}\2',
            content
        )
        # Footer link -> points to de_target
        content = re.sub(
            r'(<a href=")[^"]*(" class="footer-link w-inline-block">\s*<div>Language: DE / EN</div>\s*</a>)',
            rf'\g<1>{de_target}\2',
            content
        )
    else:
        # On German page: navbar link is EN -> points to en_target
        content = re.sub(
            r'(<a href=")[^"]*(" class="nav-link w-inline-block">\s*<div class="text-block-7">EN</div>)',
            rf'\g<1>{en_target}\2',
            content
        )
        # Footer link -> points to en_target
        content = re.sub(
            r'(<a href=")[^"]*(" class="footer-link w-inline-block">\s*<div>Language: DE / EN</div>\s*</a>)',
            rf'\g<1>{en_target}\2',
            content
        )

    # 8. Clean canonical URLs if they contain .html
    def replace_canonical(m):
        url = m.group(1)
        cleaned_url = re.sub(r'/index\.html$', '/', url)
        cleaned_url = re.sub(r'\.html$', '', cleaned_url)
        return f'<link href="{cleaned_url}" rel="canonical">'

    content = re.sub(r'<link href="([^"]+)" rel="canonical">', replace_canonical, content)

    if content != original:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Cleaned {file_path}")
        return True
    return False

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    html_files = glob.glob(os.path.join(root, "*.html")) + glob.glob(os.path.join(root, "en", "*.html"))
    changed = 0
    for file_path in sorted(html_files):
        if clean_html_file(file_path):
            changed += 1
    print(f"Finished. {changed} files updated.")

if __name__ == "__main__":
    main()
