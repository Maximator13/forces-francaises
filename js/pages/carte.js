// Page carte : relie la carte, les filtres, la fiche et l'URL.

import { initLayout, setMeta } from "../layout.js";
import { loadData, loadWorld, zoneNames } from "../data.js";
import { createMap } from "../map.js";
import { createPanel } from "../panel.js";
import { createFilters } from "../filters.js";
import { readHash, openZone, syncLang } from "../router.js";

await initLayout();
setMeta("meta.map.title", "meta.map.description");

const [data, world] = await Promise.all([loadData(), loadWorld()]);
const names = zoneNames(data, world);
let current = null;

const panelEl = document.getElementById("panel");
const wide = matchMedia("(min-width: 60rem)");

const map = createMap(document.getElementById("map"), {
  world,
  data,
  names,
  onSelect: (id) => openZone(id),
  obscured: () => {
    const box = panelEl.getBoundingClientRect();
    return wide.matches ? [box.width, 0] : [0, box.height];
  },
});
const panel = createPanel(panelEl, {
  data, names, onClose: () => openZone(null),
});
const filters = createFilters(document.getElementById("filters"), document.getElementById("counter"), {
  deployments: data.deployments,
  onChange: () => render(),
});

/** La fiche liste tous les déploiements de la zone, quels que soient les filtres. */
function render() {
  const deps = current ? data.deployments.filter((d) => d.zones.includes(current)) : [];
  deps.length ? panel.open(current, deps) : panel.close();
  map.select(deps.length ? current : null, filters); // après la fiche, pour connaître sa taille
}

function fromHash() {
  const zone = readHash().zone;
  current = zone && names.has(zone) ? zone : null;
  render();
}

window.addEventListener("hashchange", fromHash);
document.addEventListener("langchange", () => {
  syncLang();
  render();
});
fromHash();
document.body.classList.add("is-ready");
