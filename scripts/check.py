#!/usr/bin/env python3
"""Pre-publish checks for the static site. Run from anywhere:

    python3 scripts/check.py            # check only
    python3 scripts/check.py --fix-csp  # also rewrite the CSP hash after editing the inline script

Checks: duplicate ids, in-page anchors, local asset references (HTML and CSS), site-absolute
URLs (e.g. the share image), ids the script looks up, JS syntax (if node is installed),
cache-busting versions, the inline theme script against each page's Content-Security-Policy,
no inline styles or handlers (the CSP would block them), and text contrast of both themes
against WCAG AA (4.5:1). Exits non-zero when anything fails.
"""
import base64
import hashlib
import re
import shutil
import subprocess
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://liuyusheng-ai.github.io/'
PAGES = ['index.html', '404.html']
TEXT_TOKENS = ('ink', 'ink-soft', 'muted', 'faint', 'accent', 'sage')
INLINE_SCRIPT = re.compile(r'<script>(.*?)</script>', re.S)  # plain inline JS; not src=, not JSON-LD
CSP_META = re.compile(r'(<meta http-equiv="Content-Security-Policy" content=")([^"]+)(">)')
failures = []


def fail(message):
    failures.append(message)
    print(f'  ✗ {message}')


def read(name):
    return (ROOT / name).read_text(encoding='utf-8')


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.refs = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'use':  # icon references are checked separately against <symbol> ids
            return
        for key in ('href', 'src'):
            if attrs.get(key):
                self.refs.append(attrs[key])


def local_path(ref, page):
    """Map a local or site-absolute href/src to a file under ROOT; None for external/in-page refs."""
    if ref.startswith(SITE):
        ref = '/' + ref[len(SITE):]
    elif re.match(r'^(https?:|mailto:|tel:|data:|#)', ref):
        return None
    ref = ref.split('#')[0].split('?')[0]
    if not ref:
        return None
    if ref == '/':
        return ROOT / 'index.html'
    return ROOT / ref.lstrip('/') if ref.startswith('/') else (ROOT / page).parent / ref


def check_pages():
    index_ids = set()
    for page in PAGES:
        print(page)
        html = read(page)
        parser = Collector()
        parser.feed(html)
        ids = set(parser.ids)
        if page == 'index.html':
            index_ids = ids
        for dup, n in Counter(parser.ids).items():
            if n > 1:
                fail(f'duplicate id "{dup}" ({n}×)')
        meta_urls = re.findall(r'<meta [^>]*content="(' + re.escape(SITE) + r'[^"]*)"', html)
        for ref in parser.refs + meta_urls:
            if ref.startswith('#') and len(ref) > 1 and ref[1:] not in ids:
                fail(f'anchor {ref} has no matching id')
            path = local_path(ref, page)
            if path and not path.exists():
                fail(f'missing file for {ref}')
        for use in re.findall(r'<use href="#([^"]+)"', html):
            if use not in ids:
                fail(f'<use> points to missing symbol #{use}')
        if re.search(r'<[^>]+\sstyle="', html):
            fail('inline style attribute (the CSP style-src blocks it; use a class)')
        if re.search(r'<[^>]+\son[a-z]+="', html):
            fail('inline event handler attribute (the CSP blocks it; bind it in main.js)')
    return index_ids


def script_hash(body):
    return base64.b64encode(hashlib.sha256(body.encode('utf-8')).digest()).decode()


def check_csp(fix):
    print('inline script & CSP' + (' (fixing)' if fix else ''))
    bodies = {}
    for page in PAGES:
        html = read(page)
        scripts = INLINE_SCRIPT.findall(html)
        bodies[page] = scripts
        meta = CSP_META.search(html)
        if not meta:
            fail(f'{page}: no Content-Security-Policy meta')
            continue
        needed = [script_hash(body) for body in scripts]
        allowed = re.findall(r"'sha256-([A-Za-z0-9+/=]+)'", meta.group(2))
        if fix and sorted(needed) != sorted(allowed):
            policy = re.sub(r"\s*'sha256-[A-Za-z0-9+/=]+'", '', meta.group(2))
            policy = policy.replace("script-src 'self'", "script-src 'self'" + ''.join(f" 'sha256-{h}'" for h in needed))
            (ROOT / page).write_text(html[:meta.start(2)] + policy + html[meta.end(2):], encoding='utf-8')
            print(f'  ↻ {page}: CSP now allows ' + ', '.join(f'sha256-{h}' for h in needed))
            continue
        for digest in needed:
            if digest not in allowed:
                fail(f'{page}: inline script hash sha256-{digest} is not in the CSP — run with --fix-csp')
        for digest in allowed:
            if digest not in needed:
                fail(f'{page}: CSP allows sha256-{digest}, which matches no inline script — run with --fix-csp')
    if len({tuple(v) for v in bodies.values()}) > 1:
        fail('index.html and 404.html inline scripts differ (keep them identical)')


def check_css():
    print('styles.css')
    css = read('styles.css')
    for ref in re.findall(r'url\("?([^")]+)"?\)', css):
        if not ref.startswith('data:') and not (ROOT / ref).exists():
            fail(f'CSS url() missing file: {ref}')
    return css


def check_js(index_ids):
    print('main.js')
    js = read('main.js')
    for ref in sorted(set(re.findall(r"\$\('#([\w-]+)'\)", js))):
        if ref not in index_ids:
            fail(f'script looks up #{ref}, which index.html does not have')
    if shutil.which('node'):
        result = subprocess.run(['node', '--check', str(ROOT / 'main.js')], capture_output=True, text=True)
        if result.returncode:
            fail(f'JS syntax error:\n{result.stderr.strip()}')
    else:
        print('  (node not installed; skipped JS syntax check)')


def check_versions():
    print('cache versions')
    versions = set()
    for page in PAGES:
        versions |= set(re.findall(r'(?:styles\.css|main\.js)\?v=([\w.-]+)', read(page)))
    if len(versions) != 1:
        fail(f'pages reference different asset versions: {sorted(versions)}')


def luminance(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def check_contrast(css):
    print('contrast (WCAG AA)')

    def tokens(selector):
        # Token blocks may list several selectors (e.g. `:root, :root[data-theme="light"] .invert`):
        # use the first block whose selector list names `selector` and that defines --bg.
        for selectors, body in re.findall(r'([^{}]+)\{([^{}]*)\}', re.sub(r'/\*.*?\*/', '', css, flags=re.S)):
            names = [name.strip() for name in selectors.split(',')]
            if selector in names and '--bg:' in body:
                return dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})', body))
        raise SystemExit(f'check.py: no token block for {selector} in styles.css')

    dark = tokens(':root')
    themes = {'dark': dark, 'light': {**dark, **tokens(':root[data-theme="light"]')}}
    for name, theme in themes.items():
        for token in TEXT_TOKENS:
            ratio = contrast(theme[token], theme['bg'])
            if ratio < 4.5:
                fail(f'{name} --{token} {theme[token]} on {theme["bg"]} is {ratio:.2f}:1 (< 4.5)')


def main():
    fix = '--fix-csp' in sys.argv[1:]
    check_csp(fix)
    index_ids = check_pages()
    css = check_css()
    check_js(index_ids)
    check_versions()
    check_contrast(css)
    if failures:
        print(f'\n{len(failures)} problem(s) found.')
        sys.exit(1)
    print('\nAll checks passed.')


if __name__ == '__main__':
    main()
