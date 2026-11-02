"""Vérifie que les URL sources répondent et repère les entrées à revérifier.

- 404, 410, nom de domaine introuvable : lien mort.
- 401, 403, 429, 5xx, délai dépassé : à vérifier à la main (beaucoup de sites
  officiels bloquent les robots sans que la page ait disparu).
- Déploiement en cours vérifié il y a plus de 6 mois : à revérifier.

Usage :
    python scripts/check_sources.py [--markdown] [--max-age-days 183]
Code de sortie 1 s'il y a des liens morts ou des entrées à revérifier.
Bibliothèque standard uniquement.
"""

import argparse
import concurrent.futures
import datetime
import json
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "Mozilla/5.0 (compatible; forces-francaises-link-check; +https://github.com/Maximator13/forces-francaises)"
TIMEOUT = 20


def check(url):
    """Renvoie ('ok' | 'mort' | 'manuel', détail)."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return "ok", str(response.status)
    except urllib.error.HTTPError as e:
        return ("mort" if e.code in (404, 410) else "manuel"), f"HTTP {e.code}"
    except urllib.error.URLError as e:
        if isinstance(e.reason, socket.gaierror):
            return "mort", "domaine introuvable"
        return "manuel", str(e.reason)
    except (TimeoutError, socket.timeout):
        return "manuel", "délai dépassé"
    except Exception as e:  # certificat, connexion coupée…
        return "manuel", type(e).__name__


def collect_urls():
    """{url: [identifiants des entrées qui la citent]}"""
    urls = {}
    deployments = json.loads((ROOT / "data/deployments.json").read_text(encoding="utf-8"))
    catalogue = json.loads((ROOT / "data/catalogue.json").read_text(encoding="utf-8"))
    entries = [(d["id"], d) for d in deployments["deploiements"]]
    entries += [(f"catalogue:{e['id']}", e) for e in catalogue["unites"] + catalogue["materiels"]]
    for entry_id, entry in entries:
        for source in entry.get("sources", []):
            urls.setdefault(source["url"], []).append(entry_id)
    return urls, deployments["deploiements"]


def stale(deployments, max_age_days, today):
    limit = (today - datetime.timedelta(days=max_age_days)).isoformat()
    return [d for d in deployments if d["statut"] == "actif" and d["derniere_verification"] < limit]


def report(results, urls, old, markdown):
    dead = sorted((u, r) for u, r in results.items() if r[0] == "mort")
    manual = sorted((u, r) for u, r in results.items() if r[0] == "manuel")
    lines = []
    if markdown:
        lines.append(f"Vérification du {datetime.date.today().isoformat()} : {len(results)} liens testés.\n")
    sections = [
        ("Liens morts", dead),
        ("À vérifier à la main (accès refusé, délai ou erreur serveur)", manual),
    ]
    for title, items in sections:
        if not items:
            continue
        lines.append(f"## {title} ({len(items)})\n" if markdown else f"{title} ({len(items)}) :")
        for url, (_, detail) in items:
            who = ", ".join(urls[url])
            lines.append(f"- [ ] {url} — {detail} — {who}" if markdown else f"  {detail:<20} {url}  ({who})")
        lines.append("")
    if old:
        lines.append(f"## Entrées à revérifier ({len(old)})\n" if markdown else f"Entrées à revérifier ({len(old)}) :")
        for d in old:
            lines.append(f"- [ ] `{d['id']}` — dernière vérification le {d['derniere_verification']}"
                         if markdown else f"  {d['id']} (vérifié le {d['derniere_verification']})")
    if not (dead or manual or old):
        lines.append("Tous les liens répondent et toutes les entrées sont à jour.")
    return "\n".join(lines), bool(dead or old)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--markdown", action="store_true", help="sortie en Markdown (corps d'issue GitHub)")
    parser.add_argument("--max-age-days", type=int, default=183)
    args = parser.parse_args()

    urls, deployments = collect_urls()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = dict(zip(urls, pool.map(check, urls)))
    old = stale(deployments, args.max_age_days, datetime.date.today())
    text, problems = report(results, urls, old, args.markdown)
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
