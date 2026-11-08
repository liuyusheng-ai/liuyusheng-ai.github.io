#!/usr/bin/env python3
"""Pre-publish checks for the static site. Run from anywhere: python3 scripts/check.py

Checks: duplicate ids, in-page anchors, local asset references (HTML and CSS),
ids the script looks up, JS syntax (if node is installed), cache-busting versions,
and text contrast of the theme tokens against WCAG AA (4.5:1).
Exits non-zero when anything fails.
"""
import re
import shutil
import subprocess
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['index.html', '404.html']
TEXT_TOKENS = ('ink', 'ink-soft', 'muted', 'faint', 'accent', 'sage')
failures = []


def fail(message):
    failures.append(message)
    print(f'  ✗ {message}')


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
    """Map a local href/src to a file under ROOT, or None for external/in-page refs."""
    if re.match(r'^(https?:|mailto:|tel:|data:|#)', ref):
        return None
    ref = ref.split('#')[0].split('?')[0]
    if not ref:
        return None
    return ROOT / ref.lstrip('/') if ref.startswith('/') else (ROOT / page).parent / ref


def check_pages():
    index_ids = set()
    for page in PAGES:
        print(f'{page}')
        html = (ROOT / page).read_text(encoding='utf-8')
        parser = Collector()
        parser.feed(html)
        ids = set(parser.ids)
        if page == 'index.html':
            index_ids = ids
        for dup, n in Counter(parser.ids).items():
            if n > 1:
                fail(f'duplicate id "{dup}" ({n}×)')
        for ref in parser.refs:
            if ref.startswith('#') and len(ref) > 1 and ref[1:] not in ids:
                fail(f'anchor {ref} has no matching id')
            path = local_path(ref, page)
            if path and not path.exists():
                fail(f'missing file for {ref}')
        for use in re.findall(r'<use href="#([^"]+)"', html):
            if use not in ids:
                fail(f'<use> points to missing symbol #{use}')
    return index_ids


def check_css():
    print('styles.css')
    css = (ROOT / 'styles.css').read_text(encoding='utf-8')
    for ref in re.findall(r'url\("?([^")]+)"?\)', css):
        if not ref.startswith('data:') and not (ROOT / ref).exists():
            fail(f'CSS url() missing file: {ref}')
    return css


def check_js(index_ids):
    print('main.js')
    js = (ROOT / 'main.js').read_text(encoding='utf-8')
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
        versions |= set(re.findall(r'(?:styles\.css|main\.js)\?v=(\d+)', (ROOT / page).read_text(encoding='utf-8')))
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
        block = re.search(re.escape(selector) + r'\s*\{(.*?)\n\}', css, re.S).group(1)
        return dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})', block))

    dark = tokens(':root')
    themes = {'dark': dark, 'light': {**dark, **tokens(':root[data-theme="light"]')}}
    for name, theme in themes.items():
        for token in TEXT_TOKENS:
            ratio = contrast(theme[token], theme['bg'])
            if ratio < 4.5:
                fail(f'{name} --{token} {theme[token]} on {theme["bg"]} is {ratio:.2f}:1 (< 4.5)')


def main():
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
