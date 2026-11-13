#!/usr/bin/env python3
"""AI visibility tracker for iunlockmobile.com.

Asks real commercial questions to AI answer engines that have an API key in the
environment and records whether iUnlockMobile is mentioned / cited, at which
position, and which competitor domains are cited instead.

  python3 ai_visibility_tracker.py                    # all 100 prompts
  python3 ai_visibility_tracker.py --top 20           # 20 highest opportunity_score (daily, low quota)
  python3 ai_visibility_tracker.py --cluster B_ATT_Cricket
  python3 ai_visibility_tracker.py --dry-run          # load + validate prompts, call nothing

Platforms (each skipped safely when its key is missing):
  OpenAI     OPENAI_API_KEY      /v1/responses + web_search      (OPENAI_MODEL, default gpt-4.1-mini)
  Perplexity PERPLEXITY_API_KEY  chat/completions, model sonar   (PERPLEXITY_MODEL)
  Gemini     GEMINI_API_KEY      generateContent + google_search (GEMINI_MODEL, default gemini-2.5-flash)
  Claude     ANTHROPIC_API_KEY   /v1/messages + web_search tool  (ANTHROPIC_MODEL, default claude-opus-5-5)

Outputs (in --out, default reports/ai-visibility/):
  ai_visibility_<stamp>.csv   one row per prompt x platform
  ai_visibility_<stamp>.md    citation share overall, per cluster A-F and per competitor

Standard library only, so CI needs no pip install.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROMPTS_FILE = ROOT / "scripts" / "ai_visibility_prompts_100.json"
OWN_DOMAIN = "iunlockmobile.com"
BRAND = re.compile(r"i\s?unlock\s?mobile|iunlockmobile", re.I)
COMPETITORS = [
    "unlockbase.com", "unlockunit.com", "officialiphoneunlock.co.uk", "directunlocks.com",
    "doctorunlock.com", "doctorunlock.net", "imei-unlock-gsm.com", "sickw.com", "swappa.com",
    "imei.date", "phonescore.app", "imeix.app", "support.apple.com", "att.com", "crtc.gc.ca", "devicecheck.ca",
]
CSV_FIELDS = [
    "prompt_id", "cluster", "platform", "lang", "prompt", "iunlock_mentioned", "iunlock_cited",
    "citation_position", "cited_urls", "competitors_cited", "opportunity_score", "recommended_landing_page", "error",
]
TIMEOUT = 90


# ---------------------------------------------------------------- prompts

def load_prompts(path: Path = PROMPTS_FILE) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("prompt file must be a JSON array")
    ids = [p["id"] for p in data]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate prompt ids")
    required = {"id", "cluster", "prompt", "lang", "intent", "opportunity_score", "target_path"}
    for p in data:
        missing = required - p.keys()
        if missing:
            raise ValueError(f"prompt {p.get('id')} missing {sorted(missing)}")
    return data


def select_prompts(prompts: list[dict], top: int | None = None, cluster: str | None = None) -> list[dict]:
    chosen = prompts
    if cluster:
        chosen = [p for p in chosen if p["cluster"] == cluster or p["cluster"].startswith(cluster + "_") or p["cluster"][0] == cluster]
    if top:
        chosen = sorted(chosen, key=lambda p: (-float(p["opportunity_score"]), p["id"]))[:top]
    return sorted(chosen, key=lambda p: p["id"])


# ---------------------------------------------------------------- HTTP

class RateLimited(Exception):
    def __init__(self, retry_after: float | None):
        super().__init__("HTTP 429")
        self.retry_after = retry_after


def post_json(url: str, body: dict, headers: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code in (429, 529) or e.code >= 500:
            ra = e.headers.get("retry-after")
            raise RateLimited(float(ra) if ra and ra.replace(".", "", 1).isdigit() else None) from e
        detail = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e


def with_backoff(fn, attempts: int = 5, base: float = 2.0):
    """Exponential backoff with jitter on HTTP 429 / 5xx."""
    for i in range(attempts):
        try:
            return fn()
        except RateLimited as e:
            if i == attempts - 1:
                raise RuntimeError("rate limited after retries") from e
            wait = e.retry_after if e.retry_after else base * (2 ** i) + random.uniform(0, 1)
            time.sleep(min(wait, 120))


# ---------------------------------------------------------------- platforms
# Each returns (answer_text, [cited_url, ...]) in citation order.

def ask_openai(prompt: str) -> tuple[str, list[str]]:
    data = post_json("https://api.openai.com/v1/responses",
                     {"model": os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"), "tools": [{"type": "web_search"}], "input": prompt},
                     {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"})
    text, urls = [], []
    for item in data.get("output", []):
        if item.get("type") != "message":
            continue
        for c in item.get("content", []):
            if c.get("type") == "output_text":
                text.append(c.get("text", ""))
                urls += [a["url"] for a in c.get("annotations", []) if a.get("type") == "url_citation" and a.get("url")]
    return "\n".join(text), urls


def ask_perplexity(prompt: str) -> tuple[str, list[str]]:
    data = post_json("https://api.perplexity.ai/chat/completions",
                     {"model": os.environ.get("PERPLEXITY_MODEL", "sonar"), "messages": [{"role": "user", "content": prompt}]},
                     {"Authorization": f"Bearer {os.environ['PERPLEXITY_API_KEY']}"})
    text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    urls = list(data.get("citations") or []) or [r.get("url") for r in data.get("search_results") or [] if r.get("url")]
    return text, urls


def ask_gemini(prompt: str) -> tuple[str, list[str]]:
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(model)}:generateContent"
    data = post_json(url, {"contents": [{"parts": [{"text": prompt}]}], "tools": [{"google_search": {}}]},
                     {"x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    cand = (data.get("candidates") or [{}])[0]
    text = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []))
    urls = []
    for chunk in cand.get("groundingMetadata", {}).get("groundingChunks", []):
        web = chunk.get("web", {})
        # Grounding URIs are redirect links; the title carries the source domain.
        title = web.get("title") or ""
        urls.append(f"https://{title}/" if re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", title) else web.get("uri", ""))
    return text, [u for u in urls if u]


def ask_claude(prompt: str) -> tuple[str, list[str]]:
    data = post_json("https://api.anthropic.com/v1/messages", {
        "model": os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5"),
        "max_tokens": 16000,
        "messages": [{"role": "user", "content": prompt}],
        "tools": [{"type": "web_search_20260209", "name": "web_search", "max_uses": 5}],
        "fallbacks": "default",
    }, {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01"})
    if data.get("stop_reason") == "refusal":
        return "", []
    text, cited, searched = [], [], []
    for block in data.get("content", []):
        if block.get("type") == "text":
            text.append(block.get("text", ""))
            cited += [c["url"] for c in block.get("citations") or [] if c.get("url")]
        elif block.get("type") == "web_search_tool_result" and isinstance(block.get("content"), list):
            searched += [r["url"] for r in block["content"] if r.get("url")]
    # Cited URLs first (what the answer relied on), then other results it read.
    return "\n".join(text), cited or searched


PLATFORMS = {
    "openai": ("OPENAI_API_KEY", ask_openai),
    "perplexity": ("PERPLEXITY_API_KEY", ask_perplexity),
    "gemini": ("GEMINI_API_KEY", ask_gemini),
    "claude": ("ANTHROPIC_API_KEY", ask_claude),
}


# ---------------------------------------------------------------- analysis

def domain(url: str) -> str:
    try:
        host = urllib.parse.urlparse(url).hostname or ""
    except ValueError:
        return ""
    return host.lower().removeprefix("www.")


def matches(host: str, target: str) -> bool:
    return host == target or host.endswith("." + target)


def analyse(answer: str, urls: list[str], prompt: dict, platform: str) -> dict:
    ordered = list(dict.fromkeys(u for u in urls if u))
    hosts = [domain(u) for u in ordered]
    position = next((i + 1 for i, h in enumerate(hosts) if matches(h, OWN_DOMAIN)), "")
    competitors = sorted({c for h in hosts for c in COMPETITORS if matches(h, c)})
    return {
        "prompt_id": prompt["id"], "cluster": prompt["cluster"], "platform": platform, "lang": prompt["lang"], "prompt": prompt["prompt"],
        "iunlock_mentioned": bool(BRAND.search(answer)) or position != "",
        "iunlock_cited": position != "",
        "citation_position": position,
        "cited_urls": " ".join(ordered[:15]),
        "competitors_cited": " ".join(competitors),
        "opportunity_score": prompt["opportunity_score"],
        "recommended_landing_page": f"https://{OWN_DOMAIN}{prompt['target_path']}",
        "error": "",
    }


def citation_share(rows: list[dict]) -> dict:
    """Share of answered prompts citing each domain, overall and per cluster letter."""
    ok = [r for r in rows if not r["error"]]

    def share(subset: list[dict]) -> dict:
        n = len(subset)
        counts = Counter()
        for r in subset:
            if r["iunlock_cited"]:
                counts[OWN_DOMAIN] += 1
            for c in filter(None, r["competitors_cited"].split(" ")):
                counts[c] += 1
        return {"answers": n, "mentioned": sum(1 for r in subset if r["iunlock_mentioned"]),
                "share": {d: round(100 * counts[d] / n, 1) if n else 0.0 for d in [OWN_DOMAIN, *COMPETITORS]}}

    by_cluster = defaultdict(list)
    by_platform = defaultdict(list)
    for r in ok:
        by_cluster[r["cluster"][0]].append(r)
        by_platform[r["platform"]].append(r)
    return {"overall": share(ok), "clusters": {k: share(v) for k, v in sorted(by_cluster.items())},
            "platforms": {k: share(v) for k, v in sorted(by_platform.items())}}


def markdown_report(rows: list[dict], stats: dict, mode: str, platforms: list[str], skipped: list[str]) -> str:
    o = stats["overall"]
    lines = [
        f"# AI visibility baseline — {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M UTC}",
        "",
        f"Mode: `{mode}` · Platforms run: {', '.join(platforms) or 'none'}" + (f" · Skipped (no API key): {', '.join(skipped)}" if skipped else ""),
        f"Answers: {o['answers']} · Errors: {sum(1 for r in rows if r['error'])} · iUnlockMobile mentioned in {o['mentioned']} answers · "
        f"cited in {o['share'][OWN_DOMAIN]}% of answers",
        "",
        "## Citation share by domain (% of answers citing the domain)",
        "",
        "| Domain | Overall | " + " | ".join(f"Cluster {c}" for c in stats["clusters"]) + " |",
        "|---|---:|" + "---:|" * len(stats["clusters"]),
    ]
    for d in [OWN_DOMAIN, *COMPETITORS]:
        lines.append(f"| {'**' + d + '**' if d == OWN_DOMAIN else d} | {o['share'][d]} | " +
                     " | ".join(str(s["share"][d]) for s in stats["clusters"].values()) + " |")
    lines += ["", "## By platform", "", "| Platform | Answers | Mentioned | iUnlockMobile cited % |", "|---|---:|---:|---:|"]
    for p, s in stats["platforms"].items():
        lines.append(f"| {p} | {s['answers']} | {s['mentioned']} | {s['share'][OWN_DOMAIN]} |")
    gaps = sorted((r for r in rows if not r["error"] and not r["iunlock_cited"]), key=lambda r: -float(r["opportunity_score"]))[:15]
    lines += ["", "## Biggest gaps (high opportunity, not cited)", "", "| # | Platform | Score | Prompt | Competitors cited | Landing page |", "|---:|---|---:|---|---|---|"]
    for r in gaps:
        lines.append(f"| {r['prompt_id']} | {r['platform']} | {r['opportunity_score']} | {r['prompt'].replace('|', '/')} | {r['competitors_cited'] or '—'} | {r['recommended_landing_page']} |")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- main

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--top", type=int, help="only the N highest opportunity_score prompts (e.g. 20)")
    ap.add_argument("--cluster", help="cluster name or letter, e.g. B_ATT_Cricket or B")
    ap.add_argument("--platforms", default=",".join(PLATFORMS), help="comma list: openai,perplexity,gemini,claude")
    ap.add_argument("--out", default=str(ROOT / "reports" / "ai-visibility"))
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between calls per platform")
    ap.add_argument("--dry-run", action="store_true", help="validate prompts and configuration only")
    args = ap.parse_args(argv)

    prompts = select_prompts(load_prompts(), args.top, args.cluster)
    mode = f"top_{args.top}" if args.top else (f"cluster_{args.cluster}" if args.cluster else f"full_{len(prompts)}")
    wanted = [p.strip() for p in args.platforms.split(",") if p.strip() in PLATFORMS]
    active = [p for p in wanted if os.environ.get(PLATFORMS[p][0])]
    skipped = [p for p in wanted if p not in active]
    print(f"{len(prompts)} prompts · active: {active or 'none'} · skipped (no key): {skipped or 'none'}")
    if args.dry_run:
        return 0
    if not active:
        print("No platform API keys set; nothing to measure.", file=sys.stderr)

    rows: list[dict] = []
    for prompt in prompts:
        for name in active:
            fn = PLATFORMS[name][1]
            try:
                answer, urls = with_backoff(lambda: fn(prompt["prompt"]))
                row = analyse(answer, urls, prompt, name)
            except Exception as e:  # one failed call must not stop the baseline
                row = analyse("", [], prompt, name) | {"error": str(e)[:200]}
            rows.append(row)
            print(f"#{prompt['id']:>3} {name:<10} cited={row['iunlock_cited']!s:<5} pos={row['citation_position'] or '-':<3} {row['error'][:60]}")
            time.sleep(args.delay)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%MZ")
    csv_path, md_path = out / f"ai_visibility_{stamp}.csv", out / f"ai_visibility_{stamp}.md"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(rows)
    stats = citation_share(rows)
    md_path.write_text(markdown_report(rows, stats, mode, active, skipped), encoding="utf-8")
    (out / f"ai_visibility_{stamp}.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(f"\nWrote {csv_path}\nWrote {md_path}\niUnlockMobile citation share: {stats['overall']['share'][OWN_DOMAIN]}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
