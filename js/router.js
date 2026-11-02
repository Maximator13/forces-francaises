// État partageable dans l'URL de la carte : #fr, #en/DJI, #fr/MER-ROUGE.

import { lang, LANGS } from "./i18n.js";

export function readHash() {
  const [first = "", second = ""] = decodeURIComponent(location.hash.slice(1)).split("/");
  return LANGS.includes(first) ? { lang: first, zone: second || null } : { lang: null, zone: first || null };
}

/** Ouvre (ou ferme avec null) une zone : déclenche hashchange, donc l'affichage. */
export function openZone(zone) {
  location.hash = zone ? `${lang()}/${zone}` : lang();
}

/** Met la langue à jour dans l'URL sans ajouter d'entrée d'historique. */
export function syncLang() {
  const { zone } = readHash();
  history.replaceState(null, "", `#${zone ? `${lang()}/${zone}` : lang()}`);
}
