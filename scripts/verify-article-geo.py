#!/usr/bin/env python3
"""Read-only release gate: python3 scripts/verify-article-geo.py http://127.0.0.1:3000

Fetch public HTML without running JS, following neither checkout nor tracking links.
Discover editions from both the committed catalog and the served sitemap. No third-party requests.
"""
import argparse
import hashlib
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



# Fingerprint editorial text, source/anchor links, and topic headings on the two
# controls. Exclude prices, availability, order UI, experiment assignments and
# samples whose content can vary with the live product catalogue.
def control_signature(path, doc):
    output = [text(doc.find('.//h1')), text(cls(doc, 't-lead')[0])]
    def include(el):
        if el is None:
            return
        output.append(text(el))
        output.extend([(text(a), a.get('href')) for a in el.iter('a')])
    if path == CONTROL:
        for name in ('article-body', 'article-faq'):
            for el in cls(doc, name):
                include(el)
        card = next((el for el in cls(doc, 'requirements-card')
                     if el.find(f".//a[@href='{SERVICE}#interpret-carrier-policy']") is not None), None)
        if card is not None:
            include(card)
    else:
        for s in doc.iter('section'):
            h = s.find('h2')
            if h is None:
                continue
            if s.get('id') in ('interpret-carrier-policy','faq') or text(h) in (
                    'Start with the carrier’s free route', 'Four checks before paying a seller'):
                include(s)
            elif text(h) == 'Which check answers your question?':
                # Only the editorial methods comparison; the second table contains changing prices.
                include(h)
                include(s.find('.//table'))
            elif text(h) == 'How to read a carrier report':
                include(h)
                include(s.find('p'))
    return hashlib.sha256(json.dumps(output, ensure_ascii=False).encode()).hexdigest()


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
    previews = cls(doc, 'article-evidence-preview')
    preview_tables = {table for p in previews for table in p.iter('table')}
    # The introductory card must supplement, not replace, the substantive body table.
    bodies = cls(doc, 'article-body') if meta else [doc]
    need(any(t not in preview_tables and t.find('.//th') is not None and t.find('.//td') is not None
             for b in bodies for t in b.iter('table')), 'separate semantic evidence table in article body')
    if path in {CONTROL, SERVICE}:
        # Snapshot of the two reference pages from release 259ae5f.
        expected = {CONTROL: '965ac5ccddd12e6048120d6ab2782b413f90bb6e23a2ed4f2ab8a7d1a50c9621',
                    SERVICE: 'f4ba6b864cb1412e027362bbf2ff21d3c117fce5fbc8c522ab7ddc7aed266382'}
        need(control_signature(path, doc) == expected[path], 'reference editorial text, FAQ and links unchanged')
        need(not previews and not cls(doc, 'article-decision'), 'reference retained without an editorial preview')
    ids = {e.get('id') for e in doc.iter() if e.get('id')}
    if path == CONTROL:
        need(doc.find(f".//a[@href='{SERVICE}#interpret-carrier-policy']") is not None, 'benchmark crosslink')
    if path == SERVICE:
        need({'interpret-carrier-policy','APPLE_CARRIER_LITE'} <= ids, 'benchmark report and checkout anchors')
    signature = question = None
    if path not in {CONTROL, SERVICE}:
        need(len(previews) == 1 and len(cls(doc, 'article-decision')) == 1, 'one above-form evidence preview')
        if previews:
            panel = previews[0]
            panel_headings = list(panel.iter('h2'))
            need(len(panel_headings) == 1, 'one specific reader question')
            if panel_headings:
                question = text(panel_headings[0])
                need(bool(re.search(r'[?؟]$', question)), 'reader-facing question in the current language')
                need(panel.get('aria-labelledby') == panel_headings[0].get('id') and bool(panel.get('aria-labelledby')),
                     'preview labelled by its question')
            tables = list(panel.iter('table'))
            need(len(tables) == 1, 'one compact comparison table in preview')
            if tables:
                t = tables[0]
                rows = t.findall('./tbody/tr')
                need(2 <= len(rows) <= 5, 'two to five evidence rows in preview')
                cells = [[el for el in r if el.tag in ('th','td')] for r in rows]
                heads = t.findall('./thead/tr/th')
                need(bool(heads) or all(row and row[0].tag == 'th' for row in cells), 'labelled evidence rows or columns')
                need(all(len(row) >= 2 and all(text(e) for e in row) for row in cells), 'evidence cells with meaning')
                signature = tuple(' '.join(text(el) for el in row) for row in cells)
                need(len(set(signature)) == len(signature), 'distinct checks or evidence in preview')
            need(any(external_source(a) for a in panel.iter('a')), 'linked external evidence in preview')
            if lead:
                elements = list(doc.iter())
                element_idx = {el:i for i,el in enumerate(elements)}
                need(element_idx[lead[0]] < element_idx[panel], 'answer comes before preview')
                # Some checkout variants use a link and others a form; the widget can also be offline.
                if meta:
                    containers = cls(doc, 'article-head')
                    need(any(panel in c.iter() for c in containers), 'preview inside article header')
                else:
                    containers = list(doc.iter('article'))
                panel_nodes = set(panel.iter())
                widgets = [n for c in containers if panel in c.iter() for n in c.iter()
                           if n not in panel_nodes and
                           (n.tag == 'form' or 'hero-panel' in (n.get('class') or '').split()
                            or n.get('data-cro')=='CRO-01' or n.get('id')=='quick-carrier-title')]
                need(all(element_idx[panel] < element_idx[w] for w in widgets), 'preview before order widget')
            need(not list(panel.iter('form')), 'editorial preview is separate from checkout')
    return errors, signature, question


def external_source(a):
    target = urlsplit(a.get('href', ''))
    host = target.hostname or ''
    return target.scheme == 'https' and bool(host) and not (host == 'iunlockmobile.com' or
           host.endswith('.iunlockmobile.com')) and bool(text(a))


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
            return p,[str(e)],None,None
    signatures, questions = {}, {}
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for path, issues, sig, question in pool.map(visit, sorted(paths)):
            errors.extend(f'{path}: {e}' for e in issues)
            if question:
                key = ' '.join(question.casefold().split())
                if key in questions:
                    errors.append(f'{path}: repeats the focused question at {questions[key]}')
                questions[key] = path
            if sig is not None:
                if sig in signatures:
                    errors.append(f'{path}: repeated full decision guide from {signatures[sig]}')
                signatures[sig] = path
    print(f'{len(paths)-1} canonical articles; {len(questions)} unique reader questions; {len(signatures)} distinct evidence previews; protected article/service + legacy redirect; {len(errors)} issues')
    for error in errors:
        print(error)
    return int(bool(errors))


if __name__ == '__main__':
    raise SystemExit(main())
