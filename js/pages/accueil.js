// Accueil : carte du monde qui se dessine, chiffres qui défilent, aperçu des forces et des cartes.

import { initLayout, setMeta } from "../layout.js";
import { loadData, loadWorld, byZone, defaultFilters, summary, FORCES, TYPES } from "../data.js";
import { svgPath, worldProjection } from "../geo.js";
import { buildDeck, cardFace } from "../cards.js";
import { t, num, plural } from "../i18n.js";

await initLayout();
setMeta("meta.home.title", "meta.home.description");

const [data, world] = await Promise.all([loadData(), loadWorld()]);
const filters = defaultFilters();
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const W = 1000;
const H = 500;
const project = worldProjection(W, H);

/* Carte animée */
const active = byZone(data.deployments, filters);
const shapes = world.features
  .filter((f) => f.id !== "ATA") // l'Antarctique écrase le bas de la carte
  .map((f, i) => {
    const on = active.get(f.id);
    const forces = on ? new Set(on.flatMap((d) => d.composantes.map((c) => c.force))) : null;
    const kind = !forces ? "" : forces.size === 1 ? [...forces][0] : "multi";
    return `<path d="${svgPath(f.geometry, project)}" pathLength="1" class="h-land${kind ? ` h-on h-${kind}` : ""}"
      style="--i:${i % 40}"/>`;
  }).join("");
const pins = [...active.keys()].map((id, i) => {
  const place = data.seaZones.get(id) ?? data.territories.get(id);
  const label = place ? [place.marqueur.lat, place.marqueur.lon] : world.features.find((f) => f.id === id)?.properties.label;
  if (!label) return "";
  const [x, y] = project([label[1], label[0]]);
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="h-pin" style="--i:${i}"/>`;
}).join("");
document.getElementById("hero-map").innerHTML =
  `<svg viewBox="0 ${H * 0.08} ${W} ${H * 0.72}" aria-hidden="true" preserveAspectRatio="xMidYMid slice">${shapes}${pins}</svg>`;

/* Chiffres clés */
function countUp(el, value) {
  if (reduced) {
    el.textContent = num(value);
    return;
  }
  const start = performance.now();
  const duration = 1600;
  const step = (now) => {
    const k = Math.min(1, (now - start) / duration);
    el.textContent = num(Math.round(value * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const s = summary(data.deployments, filters);
function renderFigures(animate) {
  const figures = [
    ["people", s.people, t("home.fig_people")],
    ["places", s.places, t(plural(s.places, "counter.place", "counter.places"))],
    ["deps", s.count, t(plural(s.count, "home.fig_dep", "home.fig_deps"))],
  ];
  document.getElementById("figures").innerHTML = figures.map(([key, , label]) =>
    `<div class="figure"><strong data-fig="${key}">0</strong><span>${label}</span></div>`).join("");
  for (const [key, value] of figures) {
    const el = document.querySelector(`[data-fig="${key}"]`);
    animate ? countUp(el, value) : (el.textContent = num(value));
  }
  document.getElementById("figures-note").textContent = t("home.fig_note", { n: s.missing });
}
renderFigures(true);

/* Les quatre forces */
function renderForces() {
  document.getElementById("forces").innerHTML = FORCES.map((f) => {
    const deps = data.deployments.filter((d) => d.statut === "actif" && d.composantes.some((c) => c.force === f));
    return `<li class="force-card reveal" data-force="${f}">
      <span class="logo" aria-hidden="true"></span>
      <h3>${t(`force.${f}`)}</h3>
      <p><strong>${num(deps.length)}</strong> ${t(plural(deps.length, "home.fig_dep", "home.fig_deps"))}</p>
    </li>`;
  }).join("");
}

/* Types de déploiement */
function renderTypes() {
  document.getElementById("types").innerHTML = TYPES.map((ty) => {
    const n = data.deployments.filter((d) => d.statut === "actif" && d.type === ty).length;
    return `<li class="reveal"><strong>${num(n)}</strong> ${t(`type.${ty}`)}</li>`;
  }).join("");
}

/* Aperçu des cartes à collectionner : trois légendaires ou rares au hasard */
const deck = buildDeck(data, world);
const showcase = deck.filter((c) => c.rarete === "legendaire").sort(() => Math.random() - 0.5).slice(0, 3);
function renderShowcase() {
  document.getElementById("showcase").innerHTML = showcase.map((c) => `<div class="showcase-card">${cardFace(c)}</div>`).join("");
}

function renderAll() {
  renderForces();
  renderTypes();
  renderShowcase();
}
renderAll();
document.addEventListener("langchange", () => {
  renderFigures(false);
  renderAll();
});
