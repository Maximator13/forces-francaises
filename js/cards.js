// Cartes à collectionner : jeu construit à partir des données réelles (photos et insignes
// de Wikimedia Commons quand le catalogue en a, pictogrammes sinon),
// tirage pondéré par rareté, collection sauvegardée dans le navigateur.

import { isSea, FORCES } from "./data.js";
import { silhouette } from "./geo.js";
import { t, pick, date, num } from "./i18n.js";
import { read, write, remove } from "./store.js";

export const RARITIES = ["commune", "peu_commune", "rare", "legendaire"];

/** Probabilité de chaque rareté pour un emplacement de paquet. */
export const ODDS = { commune: 0.65, peu_commune: 0.25, rare: 0.08, legendaire: 0.02 };
export const PACK_SIZE = 5;

const STORE_KEY = "ff-collection-v1";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Toutes les cartes : une par déploiement, par unité et par matériel du catalogue. */
export function buildDeck(data, world) {
  const shapes = new Map(world.features.map((f) => [f.id, f.geometry]));
  const usedBy = new Map();
  for (const dep of data.deployments) {
    for (const c of dep.composantes) {
      for (const id of [...c.unites, ...c.materiel]) {
        if (!usedBy.has(id)) usedBy.set(id, new Set());
        usedBy.get(id).add(dep);
      }
    }
  }

  const deck = data.deployments.map((dep) => {
    const land = dep.zones.find((z) => !isSea(z) && shapes.has(z));
    return {
      id: `dep:${dep.id}`,
      kind: "dep",
      rarete: dep.rarete,
      nom: dep.nom,
      forces: FORCES.filter((f) => dep.composantes.some((c) => c.force === f)),
      shape: land ? silhouette(shapes.get(land), 100) : null,
      deployments: [dep],
      source: dep,
    };
  });
  for (const [kind, items] of [["unite", data.units], ["mat", data.materiels]]) {
    for (const item of items.values()) {
      deck.push({
        id: `${kind}:${item.id}`,
        kind,
        rarete: item.rarete,
        nom: item.nom,
        forces: [item.force],
        categorie: item.categorie ?? null,
        deployments: [...(usedBy.get(item.id) ?? [])],
        source: item,
      });
    }
  }
  return deck;
}

function pickRarity(random, allowed = RARITIES) {
  const total = allowed.reduce((s, r) => s + ODDS[r], 0);
  let roll = random() * total;
  for (const r of allowed) {
    roll -= ODDS[r];
    if (roll < 0) return r;
  }
  return allowed[allowed.length - 1];
}

/** Tire un paquet ; au moins une carte peu commune ou mieux. */
export function drawPack(deck, random = Math.random) {
  const byRarity = Object.fromEntries(RARITIES.map((r) => [r, deck.filter((c) => c.rarete === r)]));
  const available = RARITIES.filter((r) => byRarity[r].length);
  const pack = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    const better = available.filter((r) => r !== "commune");
    const guarantee = i === PACK_SIZE - 1 && pack.every((c) => c.rarete === "commune") && better.length;
    const rarity = pickRarity(random, guarantee ? better : available);
    const pool = byRarity[rarity];
    pack.push(pool[Math.floor(random() * pool.length)]);
  }
  return pack;
}

/* Collection */

export function loadCollection() {
  return read(STORE_KEY, { cards: {}, packs: 0 });
}

/** Ajoute les cartes d'un paquet ; renvoie les identifiants obtenus pour la première fois. */
export function addPack(pack) {
  const collection = loadCollection();
  const fresh = [];
  for (const card of pack) {
    if (!collection.cards[card.id]) fresh.push(card.id);
    collection.cards[card.id] = (collection.cards[card.id] ?? 0) + 1;
  }
  collection.packs += 1;
  write(STORE_KEY, collection);
  return new Set(fresh);
}

export function resetCollection() {
  remove(STORE_KEY);
}

/* Rendu */

const ICONS = {
  // pictogrammes génériques de catégorie, tracés à la main
  aeronef: '<path d="M50 14l6 26 30 14v8l-30-6-2 20 10 7v5l-14-4-14 4v-5l10-7-2-20-30 6v-8l30-14z"/>',
  navire: '<path d="M18 62h64l-10 16H28zM30 58V44h40v14M42 44V32h16v12M50 32V20"/>',
  vehicule: '<path d="M16 60h68v10H16zM24 60V48h40l10 12M36 48V40h22M58 42h26"/><circle cx="28" cy="74" r="6"/><circle cx="50" cy="74" r="6"/><circle cx="72" cy="74" r="6"/>',
  systeme: '<path d="M20 76h60M50 76V46M50 46l24-20M50 46L26 26"/><circle cx="50" cy="46" r="8"/>',
  autre: '<circle cx="50" cy="50" r="22"/><path d="M50 28v44M28 50h44"/>',
  unite: '<path d="M50 14l32 12v22c0 20-14 32-32 40-18-8-32-20-32-40V26z"/><path d="M38 50l8 8 16-18"/>',
  mer: '<path d="M14 40c9-8 18-8 27 0s18 8 27 0 18-8 18 0M14 56c9-8 18-8 27 0s18 8 27 0 18-8 18 0M14 72c9-8 18-8 27 0s18 8 27 0 18-8 18 0"/>',
};

function art(card) {
  if (card.kind === "dep") {
    return card.shape
      ? `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="card-shape" d="${card.shape}"/></svg>`
      : `<svg viewBox="0 0 100 100" aria-hidden="true" class="card-icon">${ICONS.mer}</svg>`;
  }
  const image = card.source.image;
  if (image) {
    // la légende décrit les photos de contexte, qui ne montrent pas l'unité elle-même
    const alt = image.legende ? pick(image.legende)
      : t(image.type === "insigne" ? "cards.insignia_alt" : "cards.photo_alt", { name: pick(card.nom) });
    return `<img class="card-img card-img--${image.type}" src="${esc(image.fichier)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  }
  const icon = card.kind === "unite" ? ICONS.unite : ICONS[card.categorie] ?? ICONS.autre;
  return `<svg viewBox="0 0 100 100" aria-hidden="true" class="card-icon">${icon}</svg>`;
}

function subtitle(card) {
  if (card.kind === "dep") {
    const dep = card.source;
    return `${t(`type.${dep.type}`)} · ${date(dep.date_debut)}${dep.date_fin ? ` – ${date(dep.date_fin)}` : ""}`;
  }
  const kind = card.kind === "unite" ? t("cards.kind.unite") : t(`cards.cat.${card.categorie}`);
  return `${kind} · ${t(`force.${card.forces[0]}`)}`;
}

function footer(card) {
  if (card.kind === "dep") {
    const e = card.source.effectif_total;
    return e.valeur === null ? t("na") : `${e.approximatif ? t("approx") + " " : ""}${num(e.valeur)} ${t("cards.people")}`;
  }
  const n = card.deployments.length;
  return t(n === 0 ? "cards.seen_none" : n > 1 ? "cards.seen_many" : "cards.seen_one", { n });
}

/** Face d'une carte. count > 1 affiche le nombre d'exemplaires. */
export function cardFace(card, { count = 1, fresh = false } = {}) {
  const logos = card.forces.map((f) => `<span class="logo" data-force="${f}" title="${esc(t(`force.${f}`))}"></span>`).join("");
  return `<div class="card card--${card.rarete}" data-kind="${card.kind}"${card.forces.length === 1 ? ` data-force="${card.forces[0]}"` : ""}>
    <div class="card-top">
      <span class="card-rarity">${esc(t(`rarete.${card.rarete}`))}</span>
      ${fresh ? `<span class="card-new">${esc(t("cards.new"))}</span>` : ""}
      ${count > 1 ? `<span class="card-count">×${count}</span>` : ""}
    </div>
    <div class="card-art">${art(card)}</div>
    <div class="card-logos">${logos}</div>
    <h3 class="card-name">${esc(pick(card.nom))}</h3>
    <p class="card-sub">${esc(subtitle(card))}</p>
    <p class="card-foot">${esc(footer(card))}</p>
  </div>`;
}

/** Dos de carte, aussi utilisé pour les cartes pas encore obtenues. */
export function cardBack(label = "") {
  return `<div class="card card--back">
    <svg viewBox="0 0 32 32" aria-hidden="true" class="card-back-logo">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M2 16h28M16 2c-5 4-5 24 0 28M16 2c5 4 5 24 0 28" fill="none" stroke="currentColor" stroke-width="1"/>
      <circle cx="22" cy="11" r="3" fill="#e1000f" stroke="#fff"/><circle cx="9" cy="19" r="3" fill="#000091" stroke="#fff"/>
    </svg>
    ${label ? `<span class="card-back-label">${esc(label)}</span>` : ""}
  </div>`;
}
