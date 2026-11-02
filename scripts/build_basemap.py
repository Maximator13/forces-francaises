"""Génère data/world.geojson à partir de Natural Earth 1:50m « admin 0 map units ».

Le fichier « map units » sépare les départements d'outre-mer (Guyane, Réunion…) de la
métropole, ce qui permet de les afficher comme territoires distincts sur la carte.

Usage :
    python scripts/build_basemap.py [chemin/vers/ne_50m_admin_0_map_units.geojson]

Sans argument, le fichier source est téléchargé depuis le dépôt Natural Earth.
Dépendance : shapely (voir scripts/requirements.txt).
"""

import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_50m_admin_0_map_units.geojson"
)
OUTPUT = Path(__file__).resolve().parent.parent / "data" / "world.geojson"
TOLERANCE = 0.04  # degrés ; au-delà, les petites îles disparaissent
DECIMALS = 2
SKIP = {"ATA"}  # Antarctique : aucun déploiement, et il couvre toutes les longitudes en Mercator


def load_source(argv):
    if len(argv) > 1:
        return json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    with urllib.request.urlopen(SOURCE_URL, timeout=60) as response:
        return json.load(response)


def zone_id(props):
    """Code ISO 3166-1 alpha-3, ou code Natural Earth quand l'ISO n'existe pas (Kosovo…)."""
    if props["GU_A3"] == "FXX":  # France métropolitaine
        return "FRA"
    iso = props["ISO_A3"]
    return iso if iso != "-99" else props["ADM0_A3"]


def round_coords(value):
    if isinstance(value, (list, tuple)):
        return [round_coords(v) for v in value]
    return round(value, DECIMALS)


def main(argv):
    source = load_source(argv)
    geometries = defaultdict(list)
    names = {}
    labels = {}
    for feature in source["features"]:
        props = feature["properties"]
        key = zone_id(props)
        if key in SKIP:
            continue
        geometries[key].append(shape(feature["geometry"]))
        # le nom du pays entier quand plusieurs unités sont fusionnées (Royaume-Uni…)
        names.setdefault(key, {"fr": props["NAME_FR"], "en": props["NAME_EN"]})
        labels.setdefault(key, [props["LABEL_Y"], props["LABEL_X"]])
        if props["GU_A3"] == props["ADM0_A3"] or key == "FRA":
            names[key] = {"fr": props["NAME_FR"], "en": props["NAME_EN"]}
            labels[key] = [props["LABEL_Y"], props["LABEL_X"]]

    features = []
    for key in sorted(geometries):
        geom = unary_union(geometries[key]).simplify(TOLERANCE, preserve_topology=True)
        if geom.is_empty:
            continue
        geo = mapping(geom)
        features.append({
            "type": "Feature",
            "id": key,
            # point d'étiquette Natural Earth [lat, lon], placé à l'intérieur du pays
            "properties": {"nom": names[key], "label": round_coords(labels[key])},
            "geometry": {"type": geo["type"], "coordinates": round_coords(geo["coordinates"])},
        })

    OUTPUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": features},
                   ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{len(features)} zones écrites dans {OUTPUT} ({OUTPUT.stat().st_size // 1024} Ko)")


if __name__ == "__main__":
    main(sys.argv)
