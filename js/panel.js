// Fiche détaillée d'une zone : tous ses déploiements, actifs d'abord.
// Panneau non modal (la carte reste utilisable) : <dialog> ouvert avec show(),
// donc la fermeture par Échap et le retour du focus sont gérés ici.

import { t, pick, num, date } from "./i18n.js";
import { sortDeployments, SIGLES, isSea } from "./data.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function forceBadge(force) {
  return `<span class="force" data-force="${force}" data-sigle="${SIGLES[force]}">${esc(t(`force.${force}`))}</span>`;
}

function strengthText(e) {
  if (e.valeur === null) return t("na");
  return (e.approximatif ? t("approx") + " " : "") + num(e.valeur);
}

function list(ids, catalogue) {
  if (!ids.length) return `<span class="na">${esc(t("na"))}</span>`;
  return ids.map((id) => esc(pick(catalogue.get(id)?.nom) || id)).join(", ");
}

function component(c, data) {
  const specialite = c.specialite ? ` <span class="tag">${esc(t(`specialite.${c.specialite}`))}</span>` : "";
  return `<li class="component">
    <div class="component-head">${forceBadge(c.force)}${specialite}
      <span class="component-strength">${esc(strengthText(c.effectif))}</span></div>
    <dl>
      <dt>${esc(t("panel.units"))}</dt><dd>${list(c.unites, data.units)}</dd>
      <dt>${esc(t("panel.equipment"))}</dt><dd>${list(c.materiel, data.materiels)}</dd>
    </dl>
  </li>`;
}

function deployment(dep, data) {
  const past = dep.statut === "termine";
  const dates = `${date(dep.date_debut)} – ${dep.date_fin ? date(dep.date_fin) : t("panel.ongoing")}`;
  const places = (dep.lieux ?? []).map((l) => esc(pick(l.nom))).join(", ");
  const sources = dep.sources.map((s) =>
    `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.titre)}</a>
      <span class="muted">(${esc(t("panel.consulted"))} ${esc(date(s.date_consultation))})</span></li>`).join("");
  return `<article class="dep${past ? " dep--past" : ""}" id="dep-${dep.id}">
    <h3>${esc(pick(dep.nom))}</h3>
    <p class="dep-meta">
      <span class="tag tag--${dep.statut}">${esc(t(`statut.${dep.statut}`))}</span>
      <span class="tag">${esc(t(`type.${dep.type}`))}</span>
      <span class="tag">${esc(t(`cadre.${dep.cadre}`))}</span>
    </p>
    <dl class="facts">
      <dt>${esc(t("panel.dates"))}</dt><dd>${esc(dates)}</dd>
      <dt>${esc(t("panel.strength"))}</dt><dd>${esc(strengthText(dep.effectif_total))}${
        dep.effectif_total.date_reference ? ` <span class="muted">(${esc(dep.effectif_total.date_reference)})</span>` : ""}</dd>
      ${places ? `<dt>${esc(t("panel.places"))}</dt><dd>${places}</dd>` : ""}
    </dl>
    <h4>${esc(t("panel.mission"))}</h4><p>${esc(pick(dep.mission))}</p>
    <h4>${esc(t("panel.context"))}</h4><p>${esc(pick(dep.contexte))}</p>
    <h4>${esc(t("panel.components"))}</h4>
    ${dep.composantes.length
      ? `<ul class="components">${dep.composantes.map((c) => component(c, data)).join("")}</ul>`
      : `<p class="na">${esc(t("panel.no_breakdown"))}</p>`}
    <details class="sources"><summary>${esc(t("panel.sources"))} (${dep.sources.length})</summary><ul>${sources}</ul></details>
    <p class="muted small">${esc(t("panel.verified"))} ${esc(date(dep.derniere_verification))}</p>
  </article>`;
}

export function createPanel(dialog, { data, names, onClose }) {
  let invoker = null;
  const body = dialog.querySelector(".panel-body");
  const title = dialog.querySelector("#panel-title");

  dialog.querySelector(".panel-close").addEventListener("click", () => onClose());
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape") onClose();
  });

  function open(zoneId, deps) {
    if (!dialog.open) invoker = document.activeElement;
    title.textContent = pick(names.get(zoneId)) || zoneId;
    const kind = data.territories.has(zoneId) ? "panel.territory" : isSea(zoneId) ? "panel.sea" : null;
    const active = deps.filter((d) => d.statut === "actif").length;
    body.innerHTML = `
      ${kind ? `<p class="zone-kind">${esc(t(kind))}</p>` : ""}
      <p class="muted">${esc(t("panel.summary", { active, total: deps.length }))}</p>
      ${sortDeployments(deps).map((d) => deployment(d, data)).join("")}`;
    body.scrollTop = 0;
    if (!dialog.open) dialog.show();
    dialog.classList.add("is-open");
    title.focus({ preventScroll: true });
  }

  function close() {
    if (!dialog.open) return;
    dialog.classList.remove("is-open");
    dialog.close();
    invoker?.focus?.({ preventScroll: true });
    invoker = null;
  }

  return { open, close };
}
