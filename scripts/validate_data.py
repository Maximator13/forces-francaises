"""Valide les fichiers de données du site.

Contrôles : JSON Schema, identifiants uniques, références au catalogue, cohérence
statut/dates, zones connues (fond de carte ou places.json), images présentes,
traductions d'interface.

Usage :
    python scripts/validate_data.py
Code de sortie 1 en cas d'erreur ; les avertissements n'empêchent pas la validation.
"""

import datetime
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def schema_errors(schema, definition, document, label):
    validator = Draft202012Validator({**schema, "$ref": f"#/$defs/{definition}"})
    return [
        f"{label} : {'/'.join(map(str, e.absolute_path)) or '(racine)'} : {e.message}"
        for e in validator.iter_errors(document)
    ]


def duplicates(ids):
    seen, dup = set(), set()
    for i in ids:
        (dup if i in seen else seen).add(i)
    return dup


def date_key(value, end=False):
    """'2013', '2013-01' et '2013-01-11' deviennent comparables.
    Une date de fin imprécise est lue comme la fin de la période (2013 → fin 2013)."""
    return value + ("-99" if end else "-00") * (2 - value.count("-"))


def check(deployments, catalogue, places, world, i18n):
    errors, warnings = [], []
    today = datetime.date.today().isoformat()
    deps = deployments["deploiements"]

    for label, ids in (
        ("déploiement", [d["id"] for d in deps]),
        ("unité", [u["id"] for u in catalogue["unites"]]),
        ("matériel", [m["id"] for m in catalogue["materiels"]]),
        ("lieu", [p["id"] for p in places["territoires"] + places["zones_maritimes"]]),
    ):
        for dup in sorted(duplicates(ids)):
            errors.append(f"{label} en double : {dup}")

    known_zones = {f["id"] for f in world["features"]} | {
        z["id"] for z in places["zones_maritimes"]
    }
    for t in places["territoires"]:
        if t["id"] not in known_zones:
            errors.append(f"territoire {t['id']} absent du fond de carte")

    unit_ids = {u["id"] for u in catalogue["unites"]}
    mat_ids = {m["id"] for m in catalogue["materiels"]}
    used_units, used_mats = set(), set()

    for d in deps:
        where = f"déploiement {d['id']}"
        if (d["statut"] == "termine") != (d["date_fin"] is not None):
            errors.append(f"{where} : date_fin doit être renseignée si et seulement si statut = termine")
        if d["date_fin"] and d["date_debut"] and date_key(d["date_fin"], end=True) < date_key(d["date_debut"]):
            errors.append(f"{where} : date_fin antérieure à date_debut")
        if d["derniere_verification"] > today:
            errors.append(f"{where} : derniere_verification dans le futur")
        for s in d["sources"]:
            if s["date_consultation"] > today:
                errors.append(f"{where} : date de consultation dans le futur ({s['url']})")
        for z in d["zones"]:
            if z not in known_zones:
                errors.append(f"{where} : zone inconnue {z}")
        for c in d["composantes"]:
            if (c["specialite"] is not None) != (c["force"] == "gendarmerie"):
                errors.append(f"{where} : specialite réservée à la gendarmerie et obligatoire pour elle")
            for u in c["unites"]:
                if u not in unit_ids:
                    errors.append(f"{where} : unité inconnue {u}")
                used_units.add(u)
            for m in c["materiel"]:
                if m not in mat_ids:
                    errors.append(f"{where} : matériel inconnu {m}")
                used_mats.add(m)
        parts = [c["effectif"]["valeur"] for c in d["composantes"]]
        total = d["effectif_total"]["valeur"]
        if total is not None and None not in parts and sum(parts) > total:
            warnings.append(f"{where} : la somme des composantes ({sum(parts)}) dépasse le total ({total})")

    for item in catalogue["unites"] + catalogue["materiels"]:
        image = item.get("image")
        if image and not (ROOT / image["fichier"]).is_file():
            errors.append(f"{item['id']} : image absente {image['fichier']}")

    for u in sorted(unit_ids - used_units):
        warnings.append(f"unité inutilisée : {u}")
    for m in sorted(mat_ids - used_mats):
        warnings.append(f"matériel inutilisé : {m}")

    fr, en = i18n
    for key in sorted(set(fr) ^ set(en)):
        errors.append(f"clé de traduction présente dans une seule langue : {key}")
    for lang, table in (("fr", fr), ("en", en)):
        for key, value in table.items():
            if not str(value).strip():
                errors.append(f"traduction vide ({lang}) : {key}")

    return errors, warnings


def main():
    schema = load(DATA / "schema.json")
    deployments = load(DATA / "deployments.json")
    catalogue = load(DATA / "catalogue.json")
    places = load(DATA / "places.json")
    world = load(DATA / "world.geojson")
    i18n_dir = ROOT / "i18n"
    i18n = tuple(
        load(i18n_dir / f"{lang}.json") if (i18n_dir / f"{lang}.json").exists() else {}
        for lang in ("fr", "en")
    )

    errors = (
        schema_errors(schema, "fichier_deploiements", deployments, "deployments.json")
        + schema_errors(schema, "fichier_catalogue", catalogue, "catalogue.json")
        + schema_errors(schema, "fichier_lieux", places, "places.json")
    )
    warnings = []
    if not errors:  # les contrôles suivants supposent une structure valide
        more_errors, warnings = check(deployments, catalogue, places, world, i18n)
        errors += more_errors

    for w in warnings:
        print(f"avertissement : {w}")
    for e in errors:
        print(f"ERREUR : {e}")
    print(
        f"{len(deployments['deploiements'])} déploiements, {len(catalogue['unites'])} unités, "
        f"{len(catalogue['materiels'])} matériels : "
        + (f"{len(errors)} erreur(s)" if errors else "données valides")
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
