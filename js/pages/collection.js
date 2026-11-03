// Page collection : progression, filtres, détail d'une carte, réinitialisation.

import { initLayout, setMeta } from "../layout.js";
import { loadData, loadWorld } from "../data.js";
import { buildDeck, loadCollection, resetCollection, cardFace, cardBack, RARITIES } from "../cards.js";
import { t, pick, num, date, lang } from "../i18n.js";

await initLayout();
setMeta("meta.collection.title", "meta.collection.description");

const [data, world] = await Promise.all([loadData(), loadWorld()]);
const deck = buildDeck(data, world);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const grid = document.getElementById("grid");
const progress = document.getElementById("progress");
const tools = document.getElementById("tools");
const detail = document.getElementById("detail");
const confirmReset = document.getElementById("confirm-reset");

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function renderProgress(owned) {
  const groups = [["all", deck], ...RARITIES.map((r) => [r, deck.filter((c) => c.rarete === r)])];
  progress.innerHTML = groups.map(([key, cards]) => {
    const have = cards.filter((c) => owned[c.id]).length;
    const label = key === "all" ? t("collection.total") : t(`rarete.${key}`);
    return `<div class="progress-item">
      <span>${esc(label)}</span>
      <strong>${num(have)} / ${num(cards.length)}</strong>
      <progress max="${cards.length}" value="${have}" aria-label="${esc(label)} : ${percent(have, cards.length)} %"></progress>
    </div>`;
  }).join("");
}

function filtered(owned) {
  const f = Object.fromEntries(new FormData(tools));
  return deck.filter((c) =>
    (f.kind === "all" || c.kind === f.kind)
    && (f.rarity === "all" || c.rarete === f.rarity)
    && (f.force === "all" || c.forces.includes(f.force))
    && (f.owned === "all" || (f.owned === "owned") === Boolean(owned[c.id])));
}

function render() {
  const owned = loadCollection().cards;
  renderProgress(owned);
  const cards = filtered(owned);
  grid.innerHTML = cards.length ? cards.map((c) => {
    const count = owned[c.id];
    if (!count) {
      const label = `${t(`rarete.${c.rarete}`)} · ${t(`cards.kind.${c.kind}`)}`;
      return `<li class="is-missing" aria-label="${esc(t("collection.missing"))} : ${esc(label)}">${cardBack(label)}</li>`;
    }
    return `<li><button type="button" data-card="${esc(c.id)}" aria-haspopup="dialog">${cardFace(c, { count })}</button></li>`;
  }).join("") : `<li>${esc(t("collection.empty"))}</li>`;
}

function openDetail(card) {
  const item = card.source;
  const deps = card.deployments.map((d) => `<li><a href="carte.html#${lang()}/${encodeURIComponent(d.zones[0])}">${esc(pick(d.nom))}</a>
      <span class="muted">(${esc(date(d.date_debut))}${d.date_fin ? ` – ${esc(date(d.date_fin))}` : ""})</span></li>`).join("");
  const text = card.kind === "dep" ? pick(item.mission) : pick(item.description);
  const sources = (item.sources ?? []).map((s) => `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.titre)}</a></li>`).join("");
  detail.innerHTML = `
    <div>${cardFace(card, { count: loadCollection().cards[card.id] })}</div>
    <div>
      <h2 id="detail-title">${esc(pick(card.nom))}</h2>
      ${text ? `<p>${esc(text)}</p>` : `<p class="na">${esc(t("na"))}</p>`}
      ${deps ? `<h3>${esc(t("collection.deployments"))}</h3><ul>${deps}</ul>` : ""}
      ${sources ? `<h3>${esc(t("panel.sources"))}</h3><ul>${sources}</ul>` : ""}
      ${item.image ? `<p class="credit">${esc(t(item.image.type === "insigne" ? "cards.insignia_credit" : "cards.photo_credit"))}
        ${item.image.legende ? `${esc(pick(item.image.legende))}, ` : ""}<a href="${esc(item.image.source)}" rel="noopener" target="_blank">${esc(item.image.auteur)}</a>, ${esc(item.image.licence)}, Wikimedia Commons</p>` : ""}
      <form method="dialog" class="close-row"><button class="button secondary" autofocus>${esc(t("panel.close"))}</button></form>
    </div>`;
  detail.showModal();
}

grid.addEventListener("click", (e) => {
  const id = e.target.closest("button[data-card]")?.dataset.card;
  const card = id && deck.find((c) => c.id === id);
  if (card) openDetail(card);
});
tools.addEventListener("change", render);

document.getElementById("reset").addEventListener("click", () => confirmReset.showModal());
confirmReset.addEventListener("close", () => {
  if (confirmReset.returnValue === "reset") {
    resetCollection();
    render();
  }
  confirmReset.returnValue = "";
});

document.addEventListener("langchange", render);
render();
