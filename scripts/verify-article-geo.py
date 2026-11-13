#!/usr/bin/env python3
"""Read-only release gate: python3 scripts/verify-article-geo.py http://127.0.0.1:3000

Fetch public HTML without running JS, following neither checkout nor tracking links.
Discover editions from both the committed catalog and the served sitemap. No third-party requests.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

CONTROL = '/articles/how-to-find-carrier-on-iphone-before-unlock'
SERVICE = '/services/imei-check/apple-carrier-lock-status'
OLD = '/articles/imei-unlock-iphone-service-checklist'
SPECIAL = {'/articles/used-iphone-imei-unlock-legitimacy-checklist',
           '/articles/rogers-telus-sim-locked-us-iphone-in-canada'}
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class Document(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.root = ET.Element('root')
        self.stack = [self.root]
        self.feed(body)
        self.close()

    def handle_starttag(self, tag, attrs):
        element = ET.SubElement(self.stack[-1], tag, dict(attrs))
        if tag not in VOID:
            self.stack.append(element)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        here = self.stack[-1]
        if len(here):
            here[-1].tail = (here[-1].tail or '') + data
        else:
            here.text = (here.text or '') + data


def text(e):
    return ' '.join(''.join(e.itertext()).split()) if e is not None else ''


def cls(root, name):
    return [e for e in root.iter() if name in (e.get('class') or '').split()]


def fetch(base, path):
    req = Request(base + path, headers={'User-Agent': 'iUnlockMobile-article-release-check/1.0'})
    with urlopen(req, timeout=30) as response:
        actual = urlsplit(response.url).path
        expected = '/articles/used-iphone-imei-unlock-legitimacy-checklist' if path == OLD else path
        if actual != expected or response.status != 200:
            raise ValueError(f'{path}: unexpected response {response.status} at {actual}')
        return response.read().decode('utf-8')


def catalog():
    js = """
    const m = require('./lib/articles.ts');
    console.log(JSON.stringify(m.articleLocales.flatMap(l => m.listArticles(l).map(a =>
      [m.articlePath(a), a.heading, Object.fromEntries(Object.entries(m.articleLanguages('https://iunlockmobile.com',a)).map(([k,v])=>[k,new URL(v).pathname]))]))));
    """
    data = json.loads(subprocess.check_output(['node', '--import', 'tsx', '-e', js],
                                             cwd=Path(__file__).resolve().parents[1]))
    return {path: (heading, alts) for path, heading, alts in data if path != OLD}


def audit(base, path, meta):
    doc = Document(fetch(base, path)).root
    errors = []
    def need(ok, label):
        if not ok:
            errors.append(label)
    headings = list(doc.iter('h1'))
    need(len(headings) == 1 and text(headings[0]), 'one visible H1')
    need(any(urlsplit(e.get('href') or '').path == path for e in doc.findall(".//link[@rel='canonical']")), 'self canonical')
    lead = cls(doc, 't-lead')
    need(bool(lead and text(lead[0])), 'answer below heading')
    faq = []
    for details in cls(doc, 'faq-item'):
        answers = cls(details, 'answer')
        if answers:
            faq.append((text(details.find('summary')), text(answers[0])))
    graph = []
    for el in doc.findall(".//script[@type='application/ld+json']"):
        body = json.loads(el.text or '{}')
        graph.extend(body.get('@graph', [body]) if isinstance(body, dict) else body)
    marked = [(q['name'], q['acceptedAnswer']['text']) for g in graph if g.get('@type') == 'FAQPage'
              for q in g['mainEntity']]
    need(bool(marked) and [(' '.join(q.split()), ' '.join(a.split())) for q,a in marked] == faq,
         'FAQ schema matches visible question and answer text')
    if meta:
        heading, alts = meta
        need(any(text(h) == heading for h in headings), 'catalog H1 preserved')
        lang = path.split('/')[1] if not path.startswith('/articles/') else 'en'
        need(any(g.get('@type') == 'Article' and g.get('inLanguage','').lower() == lang for g in graph), 'Article locale')
        html = doc.find('.//html')
        expected_lang = {'en':'en-us','es':'es-mx','fr-ca':'fr-ca','pt':'pt-br','de':'de-at','ar':'ar'}[lang]
        need(html is not None and html.get('lang','').lower() == expected_lang, 'document locale')
        if lang == 'ar':
            need(html is not None and html.get('dir') == 'rtl', 'Arabic reading direction')
        body = cls(doc, 'article-body')
        need(any(a.get('href','').startswith('/') and not a.get('href','').startswith('//') and text(a)
                 for b in body for a in b.iter('a')), 'contextual internal next step in article body')
        if alts:
            actual = {l.get('hreflang'):urlsplit(l.get('href','')).path for l in doc.findall('.//link[@hreflang]')}
            need(all(actual.get(tag) == target for tag, target in alts.items()), 'catalog translation links')
    tables = [e for e in doc.iter('table') if e.find('.//th') is not None and e.find('.//td') is not None]
    need(bool(tables), 'semantic comparison table')
    ids = {e.get('id') for e in doc.iter() if e.get('id')}
    if path == CONTROL:
        need(doc.find(f".//a[@href='{SERVICE}#interpret-carrier-policy']") is not None, 'benchmark crosslink')
    if path == SERVICE:
        need({'interpret-carrier-policy','APPLE_CARRIER_LITE'} <= ids, 'benchmark report and checkout anchors')
    signature = None
    if path not in {CONTROL, SERVICE}:
        panels = cls(doc,'article-decision')
        need(len(panels) == 1, 'exactly one editorial decision guide')
        if panels:
            p = panels[0]
            steps = [text(i) for i in p.iter() if i.tag in ('li','dd')]
            need(len(steps) >= 3 and len(set(steps)) == len(steps) and all(steps), 'distinct practical steps')
            need(any(e.get('href','').startswith('https://') and text(e) for e in p.iter('a')), 'linked evidence in decision guide')
            if lead:
                elements = list(doc.iter())
                need(elements.index(p) > elements.index(lead[0]), 'answer precedes decision guide')
            need(all(e.tag != 'form' for e in p.iter()), 'editorial panel separate from checkout')
            signature = tuple(steps)
    return errors, signature


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base')
    parser.add_argument('--jobs', type=int, choices=range(1,9), default=3)
    args = parser.parse_args()
    base = args.base.rstrip('/')
    records = catalog()
    sitemap = ET.fromstring(fetch(base, '/sitemap.xml'))
    paths = {urlsplit(x.text or '').path for x in sitemap.findall('.//{*}loc')}
    paths = {p for p in paths if re.fullmatch(r'/(?:[a-z-]+/)?articles/[^/]+',p)}
    errors = []
    for p in sorted((set(records) | SPECIAL) - paths):
        errors.append(f'{p}: missing in sitemap')
    paths |= set(records) | SPECIAL | {SERVICE}
    fetch(base, OLD)
    def visit(p):
        try:
            return p, *audit(base,p,records.get(p))
        except Exception as e:
            return p,[str(e)],None
    signatures = {}
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for path, issues, sig in pool.map(visit, sorted(paths)):
            errors.extend(f'{path}: {e}' for e in issues)
            if sig is not None:
                if sig in signatures:
                    errors.append(f'{path}: repeated full decision guide from {signatures[sig]}')
                signatures[sig] = path
    print(f'{len(paths)-1} canonical articles; {len(signatures)} distinct decision guides; service control + legacy redirect; {len(errors)} issues')
    for error in errors:
        print(error)
    return int(bool(errors))


if __name__ == '__main__':
    raise SystemExit(main())
