#!/usr/bin/env python3
"""Read production Caddy JSON access logs without exporting request data.

Run on the origin (include rotations; date is Asia/Bangkok):
  python3 scripts/audit-openai-access.py --day 2026-11-13 /var/log/caddy/iunlockmobile-access*.log*
No WAF changes. Only the two official public range documents are fetched.
Status 2 means input/ranges unavailable; empty coverage never means zero visits.
"""
import argparse
import datetime as dt
import gzip
import ipaddress
import json
import math
from pathlib import Path
import re
import sys
import urllib.request
from collections import Counter
from zoneinfo import ZoneInfo

BOTS = {"OAI-SearchBot": "https://openai.com/searchbot.json",
        "ChatGPT-User": "https://openai.com/chatgpt-user.json"}
TZ = ZoneInfo("Asia/Bangkok")
PUBLIC = re.compile(r"/(?:(?:es|fr-ca|pt|de|ar)/)?(?:articles|services)(?:/[a-z0-9-]+)*/?$")
PRIVATE = re.compile(r"/services/unlock/(?:more|catalog)(?:/|$)")


def ranges(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        if response.geturl() != url:
            raise ValueError("unexpected range manifest redirect")
        manifest = json.load(response)
    nets = [ipaddress.ip_network(v) for row in manifest["prefixes"]
            for k, v in row.items() if k in ("ipv4Prefix", "ipv6Prefix")]
    if not nets or any(not n.prefixlen or not n.is_global for n in nets):
        raise ValueError("invalid range manifest")
    return nets, manifest.get("creationTime")


def classify(req, networks):
    path = req.get("uri", "").partition("?")[0]
    if req.get("method") not in ("GET", "HEAD") or not PUBLIC.fullmatch(path) or PRIVATE.search(path):
        return None
    headers = req.get("headers", {})
    ua = next((v for k, v in headers.items() if k.lower() == "user-agent"), [])
    ua = " ".join(ua) if isinstance(ua, list) else str(ua)
    bots = [b for b in BOTS if re.search(r"(?<![\w-])" + re.escape(b) + r"/[0-9]", ua, re.I)]
    if len(bots) != 1:
        return None
    bot = bots[0]
    # Direct peer only. Never use arbitrary X-Forwarded-For or client_ip.
    try:
        ip = ipaddress.ip_address(req.get("remote_ip"))
    except ValueError:
        return bot, "unverified_peer"
    ip = getattr(ip, "ipv4_mapped", None) or ip
    return bot, ("official_range_peer" if any(ip in n for n in networks[bot]) else "unverified_peer")


def scan(files, day, networks):
    counts = Counter()
    records = rejected = relevant = 0
    for file in dict.fromkeys(Path(f).resolve(strict=True) for f in files):
        opener = gzip.open if file.suffix == ".gz" else open
        with opener(file, "rt", encoding="utf-8") as lines:
            for line in lines:
                try:
                    row = json.loads(line)
                    req = row["request"]
                    stamp = float(row["ts"])
                    if not math.isfinite(stamp):
                        raise ValueError()
                    if dt.datetime.fromtimestamp(stamp, TZ).date() != day or req["host"].lower() not in ("iunlockmobile.com", "iunlockmobile.com:443"):
                        continue
                    status = int(row["status"])
                    if not 100 <= status <= 599:
                        raise ValueError()
                    result = classify(req, networks)
                    records += 1
                    if result:
                        bot, evidence = result
                        counts[(bot, evidence, status)] += 1
                        relevant += 1
                except (TypeError, ValueError, KeyError, AttributeError, OverflowError):
                    rejected += 1
    return {"day_bangkok": day.isoformat(), "production_records_in_supplied_logs": records,
            "malformed_records": rejected, "matching_requests": relevant if records else None,
            "counts": [dict(bot=b, peer=e, http=s, requests=n) for (b,e,s),n in sorted(counts.items())],
            "scope": "Only supplied log coverage, using current official ranges; not citations, sessions or proof of a whole day."}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--day", type=dt.date.fromisoformat, required=True)
    p.add_argument("logs", nargs="+")
    a = p.parse_args()
    try:
        sources = {b: ranges(u) for b,u in BOTS.items()}
        result = scan(a.logs, a.day, {b:v[0] for b,v in sources.items()})
    except (OSError, ValueError, KeyError, TypeError, EOFError) as err:
        print("Unavailable: " + type(err).__name__, file=sys.stderr)
        return 2
    result["range_manifests"] = {b: {"url": BOTS[b], "creationTime": v[1]} for b,v in sources.items()}
    print(json.dumps(result, indent=2))
    return 0 if result["production_records_in_supplied_logs"] else 2


if __name__ == "__main__":
    sys.exit(main())
