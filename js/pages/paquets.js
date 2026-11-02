// Page paquets : tirage, animation d'ouverture, retournement des cartes.
// Les cartes sont enregistrées dès le tirage : quitter la page pendant l'animation ne fait rien perdre.

import { initLayout, setMeta } from "../layout.js";
import { loadData, loadWorld } from "../data.js";
import { buildDeck, drawPack, addPack, loadCollection, cardFace, cardBack, PACK_SIZE } from "../cards.js";
import { t, pick, num, plural } from "../i18n.js";

await initLayout();
setMeta("meta.packs.title", "meta.packs.description");

const [data, world] = await Promise.all([loadData(), loadWorld()]);
const deck = buildDeck(data, world);

const stage = document.getElementById("stage");
const openButton = document.getElementById("open");
const flipAllButton = document.getElementById("flip-all");
const summary = document.getElementById("summary");
const stats = document.getElementById("stats");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
let running = [];
let current = null;

function renderStats() {
  const c = loadCollection();
  const owned = Object.keys(c.cards).length;
  stats.textContent = `${t("packs.stats", { owned: num(owned), total: num(deck.length) })} · ${
    t(plural(c.packs, "packs.opened_one", "packs.opened_many"), { n: num(c.packs) })}`;
}

function packButton() {
  stage.innerHTML = `<button class="pack" type="button" id="pack"><span>${t("packs.pack_label")}</span></button>`;
  document.getElementById("pack").addEventListener("click", open);
}

function finishRunning() {
  running.forEach((a) => a.finish());
  running = [];
}

function revealDone() {
  const flips = [...stage.querySelectorAll(".flip")];
  if (!flips.every((f) => f.classList.contains("is-flipped"))) return;
  flipAllButton.hidden = true;
  const freshCount = current.fresh.size;
  summary.textContent = `${t(plural(freshCount, "packs.new_one", "packs.new_many"), { n: freshCount })} ${current.pack
    .map((c) => `${pick(c.nom)} (${t(`rarete.${c.rarete}`)})`).join(", ")}.`;
  renderStats();
}

function flip(button) {
  if (button.classList.contains("is-flipped")) return;
  button.classList.add("is-flipped");
  button.setAttribute("aria-label", button.dataset.name);
  if (button.dataset.rarity === "legendaire" && !reduced.matches) {
    running.push(button.animate(
      [{ scale: 1 }, { scale: 1.12 }, { scale: 1 }],
      { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", delay: 250 },
    ));
  }
  revealDone();
}

async function open() {
  finishRunning();
  const pack = drawPack(deck);
  const fresh = addPack(pack);
  current = { pack, fresh };
  summary.textContent = "";
  openButton.dataset.i18n = "packs.open_another";
  openButton.textContent = t("packs.open_another");

  const packEl = document.getElementById("pack");
  if (packEl && !reduced.matches) {
    const shake = packEl.animate(
      [{ rotate: "0deg" }, { rotate: "-4deg" }, { rotate: "4deg" }, { rotate: "-3deg" }, { rotate: "3deg" }, { rotate: "0deg" }],
      { duration: 450, easing: "ease-in-out" },
    );
    running.push(shake);
    await shake.finished.catch(() => {});
    const burst = packEl.animate(
      [{ scale: 1, opacity: 1, filter: "brightness(1)" }, { scale: 1.25, opacity: 0, filter: "brightness(2)" }],
      { duration: 280, easing: "ease-in", fill: "forwards" },
    );
    running.push(burst);
    await burst.finished.catch(() => {});
  }

  stage.innerHTML = `<div class="reveal-row">${pack.map((card) => `
    <button class="flip" type="button" data-rarity="${card.rarete}" data-name="${esc(pick(card.nom))}"
      aria-label="${t("packs.hidden_card")}">
      <div class="flip-inner">${cardBack()}<div class="face">${cardFace(card, { fresh: fresh.has(card.id) })}</div></div>
    </button>`).join("")}</div>`;

  const flips = [...stage.querySelectorAll(".flip")];
  flips.forEach((button) => button.addEventListener("click", () => flip(button)));
  flipAllButton.hidden = false;

  if (reduced.matches) {
    flips.forEach(flip);
    return;
  }
  // éventail : les cartes partent du centre, l'une après l'autre
  flips.forEach((button, i) => {
    const offset = (i - (PACK_SIZE - 1) / 2) * -110;
    running.push(button.animate(
      [{ translate: `${offset}% 30%`, rotate: `${(i - 2) * 8}deg`, opacity: 0 }, { translate: "0 0", rotate: "0deg", opacity: 1 }],
      { duration: 550, delay: i * 90, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
    ));
  });
  flips[0].focus({ preventScroll: true });
}

flipAllButton.addEventListener("click", () => {
  [...stage.querySelectorAll(".flip:not(.is-flipped)")].forEach((button, i) =>
    setTimeout(() => flip(button), reduced.matches ? 0 : i * 140));
});
openButton.addEventListener("click", () => {
  if (!document.getElementById("pack")) packButton();
  open();
});
document.addEventListener("langchange", renderStats);

packButton();
renderStats();
