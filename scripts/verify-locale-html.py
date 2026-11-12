"""Audit indexable UI without counting English React source, identifiers or language names."""
import ast,json,re,sys
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlsplit
from lxml import html
base=sys.argv[1].rstrip('/')
rows=ast.literal_eval('['+Path('lib/geo-locales.ts').read_text().split('export const paths=[')[1].split('\n]')[0]+']')
rows.append(['/','/es','/fr-ca','/pt','/de','/ar'])
tags=['en-US','es-MX','fr-CA','pt-BR','de-AT','ar']
for row in rows:
 for i,path in enumerate(row):
  with urlopen(base+path) as r: doc=html.fromstring(r.read().decode())
  alt={e.get('hreflang'):urlsplit(e.get('href')).path or '/' for e in doc.xpath('//link[@hreflang]')}
  assert alt==dict(zip(tags,row),**{'en-CA':row[0],'x-default':row[0]}),(path,alt)
  assert doc.get('lang')==tags[i] and (i!=5 or doc.get('dir')=='rtl'),(path,doc.get('lang'))
  if not i:continue
  for s in doc.xpath('//script[@type="application/ld+json"]'):
   for graph in [json.loads(s.text or '{}')]:
    if graph.get('@type')=='FAQPage':
     for q in graph['mainEntity']:
      assert q['name'] in doc.xpath('//details/summary//text()') and q['acceptedAnswer']['text'] in doc.xpath('//details//*[@class="answer"]//text()')
  for e in doc.xpath('//script|//style'):e.drop_tree()
  text=' '.join(doc.xpath('//body//text()|//body//@aria-label|//body//@placeholder'))
  for phrase in ['What would you like to do','Choose your unlock service','Choose your phone report','Sign in','Create an account','All rights reserved','Working Days','Search by device','Your details','View example output','Open navigation','No service fee']:
   assert phrase.casefold() not in text.casefold(),(path,phrase)
print('PASS: 36 URLs; reciprocal alternates, html language, Arabic RTL, FAQ parity, localized UI')
