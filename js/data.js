// Chargement des données et calculs partagés par la carte, la liste et les cartes à collectionner.

export const FORCES = ["terre", "marine", "air", "gendarmerie"];
export const TYPES = ["opex", "presence", "souverainete", "otan", "onu_ue", "naval", "gendarmerie"];
export const SIGLES = { terre: "T", marine: "M", air: "A", gendarmerie: "G" };

let dataPromise;
let worldPromise;

async function json(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} : ${response.status}`);
  return response.json();
}

/** Déploiements, catalogue et lieux, chargés une seule fois par page. */
export function loadData() {
  dataPromise ??= Promise.all([
    json("data/deployments.json"),
    json("data/catalogue.json"),
    json("data/places.json"),
  ]).then(([deployments, catalogue, places]) => ({
    updated: deployments.derniere_mise_a_jour,
    deployments: deployments.deploiements,
    units: new Map(catalogue.unites.map((u) => [u.id, u])),
    materiels: new Map(catalogue.materiels.map((m) => [m.id, m])),
    territories: new Map(places.territoires.map((p) => [p.id, p])),
    seaZones: new Map(places.zones_maritimes.map((p) => [p.id, p])),
  }));
  return dataPromise;
}

/** Contours des pays (≈ 550 Ko), chargés seulement par les pages qui en ont besoin. */
export function loadWorld() {
  worldPromise ??= json("data/world.geojson");
  return worldPromise;
}

/** Nom bilingue d'une zone : zone maritime, territoire ou pays du fond de carte. */
export function zoneNames(data, world) {
  const names = new Map(world.features.map((f) => [f.id, f.properties.nom]));
  for (const [id, p] of [...data.territories, ...data.seaZones]) names.set(id, p.nom);
  return names;
}

export function isSea(zoneId) {
  return zoneId.startsWith("MER-");
}

/** État des filtres par défaut : tout coché, opérations passées masquées. */
export function defaultFilters() {
  return { forces: new Set(FORCES), types: new Set(TYPES), past: false };
}

/** Sans répartition publiée par force, un déploiement n'apparaît que si toutes les forces sont cochées. */
function allForces(filters) {
  return FORCES.every((f) => filters.forces.has(f));
}

export function matches(dep, filters) {
  const forceOk = dep.composantes.length
    ? dep.composantes.some((c) => filters.forces.has(c.force))
    : allForces(filters);
  return (dep.statut === "actif" || filters.past) && filters.types.has(dep.type) && forceOk;
}

/** Forces d'un déploiement retenues par les filtres. */
export function shownForces(dep, filters) {
  return [...new Set(dep.composantes.map((c) => c.force).filter((f) => filters.forces.has(f)))];
}

/** Déploiements visibles regroupés par zone : Map(zone → [déploiements]). */
export function byZone(deployments, filters) {
  const zones = new Map();
  for (const dep of deployments) {
    if (!matches(dep, filters)) continue;
    for (const z of dep.zones) {
      if (!zones.has(z)) zones.set(z, []);
      zones.get(z).push(dep);
    }
  }
  return zones;
}

/**
 * Effectif d'un déploiement limité aux forces filtrées.
 * Si une composante n'a pas d'effectif publié, le total du déploiement n'est utilisé
 * que lorsque toutes ses forces sont cochées ; sinon l'effectif est partiel.
 */
export function strength(dep, filters) {
  const parts = dep.composantes.filter((c) => filters.forces.has(c.force));
  const everyForce = dep.composantes.length ? parts.length === dep.composantes.length : allForces(filters);
  const total = dep.effectif_total;
  if (parts.length && parts.every((c) => c.effectif.valeur !== null)) {
    return {
      value: parts.reduce((sum, c) => sum + c.effectif.valeur, 0),
      approx: parts.some((c) => c.effectif.approximatif),
      complete: true,
    };
  }
  if (everyForce && total.valeur !== null) {
    return { value: total.valeur, approx: total.approximatif, complete: true };
  }
  const known = parts.filter((c) => c.effectif.valeur !== null);
  return {
    value: known.reduce((sum, c) => sum + c.effectif.valeur, 0),
    approx: true,
    complete: false,
  };
}

/** Compteur global : opérations en cours uniquement, même quand le passé est affiché. */
export function summary(deployments, filters) {
  const active = deployments.filter((d) => d.statut === "actif" && matches(d, filters));
  let people = 0;
  let approx = false;
  let missing = 0;
  const zones = new Set();
  for (const dep of active) {
    const s = strength(dep, filters);
    people += s.value;
    approx ||= s.approx;
    if (!s.complete) missing += 1;
    dep.zones.forEach((z) => zones.add(z));
  }
  const sea = [...zones].filter(isSea).length;
  return { people, approx, missing, places: zones.size - sea, sea, count: active.length };
}

/** Actifs d'abord, puis du plus récent au plus ancien. */
export function sortDeployments(list) {
  return [...list].sort((a, b) =>
    (a.statut === b.statut ? 0 : a.statut === "actif" ? -1 : 1)
    || (b.date_debut ?? "").localeCompare(a.date_debut ?? ""));
}
