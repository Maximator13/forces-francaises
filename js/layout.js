// En-tête et pied de page communs, injectés dans chaque page.
// La page indique sa rubrique avec <body data-page="carte">.

import { initI18n, lang, setLang, t, date, translatePage } from "./i18n.js";
import { loadData } from "./data.js";
import { initConsent } from "./consent.js";

const PAGES = [
  ["accueil", "index.html", "nav.home"],
  ["carte", "carte.html", "nav.map"],
  ["deploiements", "deploiements.html", "nav.list"],
  ["paquets", "paquets.html", "nav.packs"],
  ["collection", "collection.html", "nav.collection"],
  ["methode", "methode.html", "nav.method"],
];

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M2 16h28M16 2c-5 4-5 24 0 28M16 2c5 4 5 24 0 28" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="22" cy="11" r="3" fill="#0072b2"/><circle cx="9" cy="19" r="3" fill="#e69f00"/>
</svg>`;

function header(current) {
  const links = PAGES.map(([id, href, key]) =>
    `<li><a href="${href}" data-i18n="${key}"${id === current ? ' aria-current="page"' : ""}></a></li>`
  ).join("");
  return `
  <a class="skip-link" href="#contenu" data-i18n="skip"></a>
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="index.html">${LOGO}<span data-i18n="site.short"></span></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-i18n="nav.menu"></button>
      <nav class="site-nav" id="site-nav" data-i18n-attr="aria-label:nav.label"><ul>${links}</ul></nav>
      <button class="lang-toggle" type="button" data-i18n="lang.switch" data-i18n-attr="aria-label:lang.switch_label"></button>
    </div>
  </header>`;
}

function footer() {
  return `
  <footer class="site-footer">
    <div class="wrap">
      <p data-i18n="footer.disclaimer"></p>
      <p><span data-i18n="footer.updated"></span> <time data-updated></time></p>
      <nav data-i18n-attr="aria-label:footer.legal">
        <a href="mentions-legales.html" data-i18n="footer.notice"></a>
        <a href="confidentialite.html" data-i18n="footer.privacy"></a>
        <a href="cgu.html" data-i18n="footer.terms"></a>
        <a href="methode.html" data-i18n="footer.method"></a>
        <a href="https://github.com/Maximator13/forces-francaises" data-i18n="footer.source"></a>
      </nav>
    </div>
  </footer>`;
}

/** Monte l'en-tête et le pied de page, charge la langue ; à appeler en premier sur chaque page. */
export async function initLayout() {
  const page = document.body.dataset.page;
  document.body.insertAdjacentHTML("afterbegin", header(page));
  document.body.insertAdjacentHTML("beforeend", footer());
  await initI18n();

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("site-nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });

  document.querySelector(".lang-toggle").addEventListener("click", () => {
    setLang(lang() === "fr" ? "en" : "fr");
  });

  const updated = document.querySelector("[data-updated]");
  const showDate = (value) => {
    updated.dateTime = value;
    updated.textContent = date(value);
  };
  loadData().then((data) => {
    showDate(data.updated);
    document.addEventListener("langchange", () => showDate(data.updated));
  });

  initConsent();
  translatePage();
}

/** Titre et description de la page dans la langue courante. */
export function setMeta(titleKey, descriptionKey) {
  const apply = () => {
    document.title = t(titleKey);
    document.querySelector('meta[name="description"]')?.setAttribute("content", t(descriptionKey));
  };
  apply();
  document.addEventListener("langchange", apply);
}
