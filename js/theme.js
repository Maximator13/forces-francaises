// Applique le thème choisi avant le premier affichage (script classique, chargé dans <head>).
try {
  const theme = JSON.parse(localStorage.getItem("ff-theme"));
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {
  // stockage indisponible : thème du système
}
