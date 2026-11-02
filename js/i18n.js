// Chaînes d'interface. Le HTML est écrit en français ; les éléments marqués
// data-i18n="clé" (texte) ou data-i18n-attr="attribut:clé;…" sont traduits au chargement.

import { read, write } from "./store.js";

export const LANGS = ["fr", "en"];
const tables = {};
let current = "fr";

export function lang() {
  return current;
}

/** Langue demandée par l'URL (#en/…), sinon mémorisée, sinon celle du navigateur. */
function initialLang() {
  const fromHash = location.hash.slice(1).split("/")[0];
  if (LANGS.includes(fromHash)) return fromHash;
  const saved = read("ff-lang", null);
  if (LANGS.includes(saved)) return saved;
  return navigator.language?.startsWith("fr") ? "fr" : "en";
}

async function loadTable(code) {
  if (!tables[code]) {
    const response = await fetch(`i18n/${code}.json`, { cache: "no-cache" });
    tables[code] = await response.json();
  }
  return tables[code];
}

/** Traduit une clé ; {nom} est remplacé par vars.nom. */
export function t(key, vars = {}) {
  const text = tables[current]?.[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}

/** Texte bilingue des données : { fr, en } → chaîne dans la langue courante. */
export function pick(text) {
  return text?.[current] ?? text?.fr ?? "";
}

export function translatePage(root = document) {
  document.documentElement.lang = current;
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr, t(key));
    }
  }
}

export async function setLang(code) {
  if (!LANGS.includes(code)) return;
  await loadTable(code);
  current = code;
  write("ff-lang", code);
  translatePage();
  document.dispatchEvent(new CustomEvent("langchange", { detail: code }));
}

export async function initI18n() {
  current = initialLang();
  await loadTable(current);
  translatePage();
}

/** Choisit la clé au singulier ou au pluriel : en français 0 et 1 sont au singulier. */
export function plural(n, one, many) {
  return (current === "fr" ? n < 2 : n === 1) ? one : many;
}

/** Nombre formaté selon la langue (12 300 / 12,300). */
export function num(value) {
  return new Intl.NumberFormat(current === "fr" ? "fr-FR" : "en-GB").format(value);
}

/** Date au format des données (AAAA, AAAA-MM, AAAA-MM-JJ) rendue lisible. */
export function date(value) {
  if (!value) return t("na");
  const [y, m, d] = value.split("-").map(Number);
  const options = d ? { day: "numeric", month: "long", year: "numeric" }
    : m ? { month: "long", year: "numeric" } : { year: "numeric" };
  options.timeZone = "UTC";
  return new Intl.DateTimeFormat(current === "fr" ? "fr-FR" : "en-GB", options)
    .format(new Date(Date.UTC(y, (m || 1) - 1, d || 1)));
}
