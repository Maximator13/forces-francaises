// Mesure d'audience GoatCounter (sans cookie), chargée uniquement après accord explicite.
// Le choix est mémorisé ; il peut être modifié depuis la page Confidentialité.

import { read, write } from "./store.js";
import { translatePage } from "./i18n.js";

const GOATCOUNTER = "https://maximator13.goatcounter.com/count";
const KEY = "ff-consent";

function loadAnalytics() {
  const script = document.createElement("script");
  script.src = "https://gc.zgo.at/count.js";
  script.async = true;
  script.dataset.goatcounter = GOATCOUNTER;
  document.head.append(script);
}

function banner() {
  const box = document.createElement("section");
  box.className = "consent";
  box.setAttribute("aria-labelledby", "consent-title");
  box.innerHTML = `
    <p><strong id="consent-title" data-i18n="consent.title"></strong></p>
    <p data-i18n="consent.text"></p>
    <div class="actions">
      <button class="button" type="button" data-choice="yes" data-i18n="consent.accept"></button>
      <button class="button secondary" type="button" data-choice="no" data-i18n="consent.refuse"></button>
      <a href="confidentialite.html" class="small" data-i18n="consent.more"></a>
    </div>`;
  box.addEventListener("click", (e) => {
    const choice = e.target.dataset.choice;
    if (!choice) return;
    setConsent(choice === "yes");
    box.remove();
  });
  document.body.append(box);
  translatePage(box);
}

export function setConsent(accepted) {
  write(KEY, accepted ? "yes" : "no");
  if (accepted) loadAnalytics();
}

export function consentState() {
  return read(KEY, null);
}

export function initConsent() {
  const state = consentState();
  if (state === "yes") loadAnalytics();
  else if (state === null) banner();
}
