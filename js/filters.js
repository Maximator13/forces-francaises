// Filtres par force et par type, interrupteur des opérations passées, compteur global.

import { FORCES, TYPES, SIGLES, defaultFilters, summary } from "./data.js";
import { t, num, plural, translatePage } from "./i18n.js";

function checkbox(group, value, labelKey, extra = "") {
  return `<label class="check">
    <input type="checkbox" name="${group}" value="${value}" checked>
    ${extra}<span data-i18n="${labelKey}"></span>
  </label>`;
}

export function createFilters(form, counter, { deployments, onChange }) {
  const filters = defaultFilters();

  form.innerHTML = `
    <fieldset>
      <legend data-i18n="filters.forces"></legend>
      ${FORCES.map((f) => checkbox("force", f, `force.${f}`,
        `<span class="swatch swatch--${f}" aria-hidden="true">${SIGLES[f]}</span>`)).join("")}
    </fieldset>
    <fieldset>
      <legend data-i18n="filters.types"></legend>
      ${TYPES.map((ty) => checkbox("type", ty, `type.${ty}`)).join("")}
    </fieldset>
    <label class="switch">
      <input type="checkbox" role="switch" name="past">
      <span data-i18n="filters.past"></span>
    </label>`;
  translatePage(form);

  function renderCounter() {
    const s = summary(deployments, filters);
    const people = (s.approx ? t("approx") + " " : "") + num(s.people);
    counter.innerHTML = `<strong>${people}</strong> ${t("counter.people")}
      · <strong>${num(s.places)}</strong> ${t(plural(s.places, "counter.place", "counter.places"))}
      · <strong>${num(s.sea)}</strong> ${t(plural(s.sea, "counter.sea", "counter.seas"))}
      ${s.missing ? `<span class="counter-note">${t(plural(s.missing, "counter.missing_one", "counter.missing_many"), { n: s.missing })}</span>` : ""}`;
  }

  form.addEventListener("change", (e) => {
    const input = e.target;
    if (input.name === "past") filters.past = input.checked;
    else {
      const set = input.name === "force" ? filters.forces : filters.types;
      input.checked ? set.add(input.value) : set.delete(input.value);
    }
    renderCounter();
    onChange(filters);
  });
  form.addEventListener("submit", (e) => e.preventDefault());
  document.addEventListener("langchange", renderCounter);

  renderCounter();
  return filters;
}
