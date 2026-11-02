// Tableau triable des déploiements : alternative accessible à la carte.

import { matches } from "./data.js";
import { t, pick, num, date, lang } from "./i18n.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const COLUMNS = [
  { key: "name", label: "list.name", value: (d) => pick(d.nom) },
  { key: "zones", label: "list.zones", value: (d, names) => d.zones.map((z) => pick(names.get(z))).join(", ") },
  { key: "forces", label: "list.forces", value: (d) => d.composantes.map((c) => c.force).join(" ") },
  { key: "type", label: "list.type", value: (d) => t(`type.${d.type}`) },
  { key: "start", label: "list.start", value: (d) => d.date_debut ?? "" },
  { key: "end", label: "list.end", value: (d) => d.date_fin ?? "9999" },
  { key: "strength", label: "list.strength", value: (d) => d.effectif_total.valeur ?? -1 },
];

function cell(d, key, names) {
  switch (key) {
    case "name":
      return `<a href="carte.html#${lang()}/${encodeURIComponent(d.zones[0])}">${esc(pick(d.nom))}</a>`;
    case "zones":
      return esc(d.zones.map((z) => pick(names.get(z)) || z).join(", "));
    case "forces": {
      const forces = [...new Set(d.composantes.map((c) => c.force))];
      return forces.length
        ? forces.map((f) => `<span class="force" data-force="${f}"><span class="visually-hidden">${esc(t(`force.${f}`))}</span></span>`).join("")
        : `<span class="na">${esc(t("na"))}</span>`;
    }
    case "type":
      return esc(t(`type.${d.type}`));
    case "start":
      return esc(date(d.date_debut));
    case "end":
      return esc(d.date_fin ? date(d.date_fin) : t("panel.ongoing"));
    case "strength": {
      const e = d.effectif_total;
      return e.valeur === null ? `<span class="na">${esc(t("na"))}</span>` : esc((e.approximatif ? t("approx") + " " : "") + num(e.valeur));
    }
  }
}

export function createList(table, { data, names }) {
  let sort = { key: "start", dir: -1 };
  let filters;

  function render() {
    const column = COLUMNS.find((c) => c.key === sort.key);
    const rows = data.deployments
      .filter((d) => matches(d, filters))
      .sort((a, b) => {
        const va = column.value(a, names);
        const vb = column.value(b, names);
        const order = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), lang());
        return order * sort.dir;
      });

    table.innerHTML = `
      <caption class="visually-hidden">${esc(t("list.caption"))}</caption>
      <thead><tr>${COLUMNS.map((c) => `<th scope="col"${c.key === sort.key ? ` aria-sort="${sort.dir > 0 ? "ascending" : "descending"}"` : ""}>
        ${c.key === "forces" ? esc(t(c.label)) : `<button type="button" data-sort="${c.key}">${esc(t(c.label))}</button>`}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((d) => `<tr class="${d.statut === "termine" ? "is-past" : ""}">
        ${COLUMNS.map((c) => `<td${c.key === "strength" ? ' class="num"' : ""}>${cell(d, c.key, names)}</td>`).join("")}</tr>`).join("")}
      </tbody>`;
    if (!rows.length) table.querySelector("tbody").innerHTML = `<tr><td colspan="${COLUMNS.length}">${esc(t("list.empty"))}</td></tr>`;
  }

  table.addEventListener("click", (e) => {
    const key = e.target.closest("button[data-sort]")?.dataset.sort;
    if (!key) return;
    sort = { key, dir: sort.key === key ? -sort.dir : 1 };
    render();
    table.querySelector(`button[data-sort="${key}"]`).focus();
  });
  document.addEventListener("langchange", () => render());

  return {
    update(next) {
      filters = next;
      render();
    },
  };
}
