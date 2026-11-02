// Accès protégé à localStorage : en navigation privée ou si le stockage est bloqué,
// les valeurs restent en mémoire le temps de la visite.

const memory = new Map();

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return memory.has(key) ? memory.get(key) : fallback;
  }
}

export function write(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible : la copie en mémoire suffit
  }
}

export function remove(key) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // rien à faire
  }
}
