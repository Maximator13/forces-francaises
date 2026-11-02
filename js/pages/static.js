// Pages de texte (méthode, pages légales, 404) : en-tête, pied de page et langue.
// Le texte existe dans les deux langues ; le CSS n'affiche que celui de la langue courante.
// La page indique sa clé de titre avec <body data-meta="methode">.

import { initLayout, setMeta } from "../layout.js";
import { consentState, setConsent } from "../consent.js";
import { t } from "../i18n.js";

await initLayout();
const key = document.body.dataset.meta;
setMeta(`meta.${key}.title`, `meta.${key}.description`);

// Page confidentialité : modifier son choix de mesure d'audience
const choice = document.getElementById("consent-choice");
if (choice) {
  const render = () => {
    const state = consentState();
    choice.querySelector("[data-state]").textContent =
      t(state === "yes" ? "privacy.state_yes" : state === "no" ? "privacy.state_no" : "privacy.state_none");
  };
  choice.addEventListener("click", (e) => {
    const value = e.target.dataset.set;
    if (!value) return;
    setConsent(value === "yes");
    render();
  });
  document.addEventListener("langchange", render);
  render();
}
