// Conversion GeoJSON → chemins SVG en projection équirectangulaire
// (accueil animé et silhouettes des cartes à collectionner).

function rings(geometry) {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

/** Chemin SVG d'une géométrie ; project([lon, lat]) renvoie [x, y]. */
export function svgPath(geometry, project) {
  return rings(geometry)
    .map((ring) => "M" + ring.map((pt) => project(pt).map((v) => v.toFixed(1)).join(",")).join("L") + "Z")
    .join("");
}

/** Projection du monde entier dans un rectangle width × height. */
export function worldProjection(width, height) {
  return ([lon, lat]) => [((lon + 180) / 360) * width, ((90 - lat) / 180) * height];
}

/**
 * Silhouette d'un pays centrée dans un carré de côté size.
 * Seul le plus grand polygone compte pour l'emprise (les îles lointaines
 * comme celles de la Polynésie restent visibles mais ne réduisent pas tout).
 */
export function silhouette(geometry, size) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const area = (ring) => Math.abs(ring.reduce((s, [x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length];
    return s + x1 * y2 - x2 * y1;
  }, 0));
  const main = polygons.reduce((a, b) => (area(b[0]) > area(a[0]) ? b : a));
  const xs = main[0].map((p) => p[0]);
  const ys = main[0].map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const midLat = ((minY + maxY) / 2) * (Math.PI / 180);
  const kx = Math.cos(midLat); // corrige l'étirement est-ouest aux hautes latitudes
  const span = Math.max((maxX - minX) * kx, maxY - minY) || 1;
  const scale = (size * 0.8) / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const project = ([lon, lat]) => [size / 2 + (lon - cx) * kx * scale, size / 2 - (lat - cy) * scale];
  return svgPath({ type: "Polygon", coordinates: main }, project);
}
