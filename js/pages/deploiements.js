// Page liste : filtres, compteur et tableau triable.

import { initLayout, setMeta } from "../layout.js";
import { loadData, loadWorld, zoneNames } from "../data.js";
import { createFilters } from "../filters.js";
import { createList } from "../list.js";

await initLayout();
setMeta("meta.list.title", "meta.list.description");

const [data, world] = await Promise.all([loadData(), loadWorld()]);
const list = createList(document.getElementById("deps"), { data, names: zoneNames(data, world) });
const filters = createFilters(document.getElementById("filters"), document.getElementById("counter"), {
  deployments: data.deployments,
  onChange: (f) => list.update(f),
});
list.update(filters);
