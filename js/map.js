// Carte Leaflet sans tuiles : pays (fond Natural Earth), territoires d'outre-mer et zones maritimes.
// Les couleurs sont portées par des classes CSS (voir map.css) pour suivre le mode sombre
// et animer les changements de filtre.

/* global L */
import { byZone, isSea, shownForces, FORCES, SIGLES } from "./data.js";
import { t, pick, plural } from "./i18n.js";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** Classe d'état d'une zone : une force, plusieurs forces, ou uniquement des opérations passées. */
function zoneState(deps, filters) {
  const active = deps.filter((d) => d.statut === "actif");
  if (!active.length) return { kind: "past", forces: [] };
  const present = new Set(active.flatMap((d) => shownForces(d, filters)));
  const forces = FORCES.filter((f) => present.has(f));
  return { kind: forces.length === 1 ? forces[0] : "multi", forces };
}

function setClass(el, classes) {
  if (el) el.setAttribute("class", classes.join(" "));
}

export function createMap(container, { world, data, names, onSelect, obscured = () => [0, 0] }) {
  const map = L.map(container, {
    center: [20, 15],
    zoom: 2,
    minZoom: 1.5,
    maxZoom: 7,
    zoomSnap: 0.25,
    maxBounds: [[-80, -220], [88, 220]],
    worldCopyJump: false,
  });
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution("Natural Earth · Leaflet");

  const labels = new Map(world.features.map((f) => [f.id, f.properties.label]));
  const layers = new Map();
  let selected = null;
  let visible = new Map();

  const countries = L.geoJSON(world, {
    style: { className: "zone", weight: 0.6 },
    onEachFeature(feature, layer) {
      layers.set(feature.id, layer);
      layer.on("click", () => visible.has(feature.id) && onSelect(feature.id));
    },
  }).addTo(map);

  // Motifs hachurés pour les zones à plusieurs forces et les territoires
  const svg = container.querySelector(".leaflet-overlay-pane svg");
  svg.insertAdjacentHTML("afterbegin", `<defs>
    <pattern id="hatch-multi" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect class="hatch-bg" width="6" height="6"/>
      <line class="hatch-line" x1="0" y1="0" x2="0" y2="6"/>
    </pattern>
  </defs>`);

  const pins = L.layerGroup().addTo(map);

  function markerPosition(id) {
    const place = data.territories.get(id) ?? data.seaZones.get(id);
    if (place) return [place.marqueur.lat, place.marqueur.lon];
    return labels.get(id);
  }

  function pinLabel(id, deps, state) {
    const forces = state.forces.map((f) => t(`force.${f}`)).join(", ");
    const count = t(plural(deps.length, "map.deployments_one", "map.deployments_many"), { n: deps.length });
    return `${pick(names.get(id))} : ${count}${forces ? ` (${forces})` : ` (${t("map.past_only")})`}`;
  }

  function update(filters) {
    visible = byZone(data.deployments, filters);
    pins.clearLayers();

    for (const [id, layer] of layers) {
      const deps = visible.get(id);
      const classes = ["zone"];
      if (data.territories.has(id)) classes.push("zone--fr");
      layer.unbindTooltip();
      if (deps) {
        const state = zoneState(deps, filters);
        classes.push("zone--on", `zone--${state.kind}`);
        layer.bindTooltip(pinLabel(id, deps, state), { sticky: true, className: "map-tip" });
      }
      if (id === selected) classes.push("zone--selected");
      setClass(layer.getElement(), classes);
    }

    for (const [id, deps] of visible) {
      const position = markerPosition(id);
      if (!position) continue;
      const state = zoneState(deps, filters);
      const sea = isSea(id);
      const text = sea ? "⚓" : state.forces.map((f) => SIGLES[f]).join("") || "·";
      const label = pinLabel(id, deps, state);
      const marker = L.marker(position, {
        keyboard: true,
        title: label,
        alt: label,
        riseOnHover: true,
        icon: L.divIcon({
          className: "pin-wrap",
          html: `<span class="pin pin--${state.kind}${sea ? " pin--sea" : ""}${id === selected ? " pin--selected" : ""}" aria-hidden="true">${text}</span>`,
          iconSize: null,
        }),
      });
      marker.on("click", () => onSelect(id));
      marker.on("add", () => {
        const el = marker.getElement();
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", label);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(id);
          }
        });
      });
      pins.addLayer(marker);
    }
  }

  /** Met une zone en évidence et la centre ; null pour revenir à la vue monde. */
  function select(id, filters) {
    selected = id;
    update(filters);
    if (!id) return;
    const place = data.seaZones.get(id) ?? data.territories.get(id);
    const bounds = place
      ? L.latLng(place.marqueur.lat, place.marqueur.lon).toBounds(1_500_000)
      : layers.get(id)?.getBounds();
    if (!bounds) return;
    // La fiche recouvre la droite (ordinateur) ou le bas (mobile) de la carte
    const [right, bottom] = obscured();
    map.flyToBounds(bounds, {
      animate: !reducedMotion.matches,
      duration: 0.8,
      maxZoom: 5,
      paddingTopLeft: [40, 40],
      paddingBottomRight: [right + 40, bottom + 40],
    });
  }

  return { map, update, select };
}
