#!/usr/bin/env python3
"""Read GA4 purchase rows from CSV on stdin; match confirmed website orders once.
Columns: transactionid (or transaction_id), hostname, session_source_medium.
Export purchase only from property 378212303 without a hostname filter.
Run: python3 scripts/reconcile-ga4-purchases.py data/iunlockmobile.db < purchases.csv
Output is aggregated; no customer or order identifiers. No network or writes.
"""
import csv, json, sqlite3, sys
from collections import Counter, defaultdict
from pathlib import Path

def reconcile(db, rows):
    groups = defaultdict(set)
    rejected = Counter()
    for row in rows:
        if row.get('event_name','purchase') != 'purchase': continue
        host = (row['hostname'] or '').strip().lower()
        if host not in ('', '(not set)', 'iunlockmobile.com'): continue
        key = (row.get('transactionid') or row.get('transaction_id') or '').strip()
        if not key or key == '(not set)': rejected['missing_id_rows'] += 1; continue
        groups[key].add((row['session_source_medium'] or '').strip() or '(not set)')
    verified = Counter()
    for key,sources in groups.items():
        kind,_,identifier = key.partition('-')
        # Match the site's own purchase dispatch record AND the actual payment.
        event = db.execute("SELECT state FROM ga4_events_sent WHERE transaction_id=? AND event_name='purchase'", (key,)).fetchone()
        if not event or event[0] not in ('submitted','uncertain'): rejected['unverified_ids']+=1; continue
        if kind=='guest':
            paid=db.execute("""SELECT 1 FROM guest_checkouts g WHERE reference=? AND paid_at IS NOT NULL
                AND price_cents>0 AND environment='live' AND state='completed' AND review_reason IS NULL
                AND refund_requested_at IS NULL""",(identifier,)).fetchone()
        elif kind in ('report','unlock') and identifier.isascii() and identifier.isdigit():
            table,ref,done=('orders','order','delivered') if kind=='unlock' else ('paid_report_orders','paid_imei_report','completed')
            paid=db.execute(f"""SELECT 1 FROM {table} o JOIN users u ON u.id=o.user_id
                JOIN credit_ledger l ON l.user_id=o.user_id AND l.ref_id=CAST(o.id AS TEXT) AND l.ref_type=? AND l.type='charge'
                WHERE CAST(o.id AS TEXT)=? AND o.status=? AND o.source='website' AND u.account_type!='admin'
                AND o.price_cents>0 AND l.amount_cents=-o.price_cents AND NOT EXISTS
                (SELECT 1 FROM credit_ledger f WHERE f.user_id=l.user_id AND f.ref_type=l.ref_type AND f.ref_id=l.ref_id AND f.type='refund')""",(ref,identifier,done)).fetchone()
        else: paid=None
        if not paid: rejected['not_eligible_or_refunded_ids']+=1; continue
        verified[next(iter(sources)) if len(sources)==1 else '(conflicting sources)']+=1
    return {'matched_purchases':sum(verified.values()),'by_session_source_medium':dict(verified),'excluded':dict(rejected)}

if __name__=='__main__':
    rows=csv.DictReader(sys.stdin)
    cols=set(rows.fieldnames or [])
    if not {'hostname','session_source_medium'} <= cols or not {'transactionid','transaction_id'} & cols:
        sys.exit('Expected transactionid, hostname and session_source_medium in a purchase-only CSV')
    with sqlite3.connect(Path(sys.argv[1]).resolve().as_uri()+'?mode=ro',uri=True) as db:
        print(json.dumps(reconcile(db,rows),ensure_ascii=False))
