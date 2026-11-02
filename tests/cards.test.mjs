// Vérifie le tirage des paquets : taille, carte garantie, fréquences proches des probabilités.
// Lancer avec : node --test "tests/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { drawPack, ODDS, PACK_SIZE, RARITIES } from "../js/cards.js";

const deck = RARITIES.flatMap((rarete) =>
  Array.from({ length: 20 }, (_, i) => ({ id: `${rarete}-${i}`, rarete })));

test("un paquet contient toujours une carte peu commune ou mieux", () => {
  for (let i = 0; i < 5000; i++) {
    const pack = drawPack(deck);
    assert.equal(pack.length, PACK_SIZE);
    assert.ok(pack.some((c) => c.rarete !== "commune"));
  }
});

test("les fréquences suivent les probabilités annoncées", () => {
  const counts = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  const packs = 20000;
  for (let i = 0; i < packs; i++) drawPack(deck).forEach((c) => counts[c.rarete]++);
  const total = packs * PACK_SIZE;
  // la garantie relève un peu les raretés supérieures : tolérance de 3 points
  for (const r of RARITIES) assert.ok(Math.abs(counts[r] / total - ODDS[r]) < 0.03, `${r} : ${counts[r] / total}`);
});

test("une rareté absente du jeu n'est jamais tirée", () => {
  const small = deck.filter((c) => c.rarete !== "legendaire");
  for (let i = 0; i < 2000; i++) assert.ok(drawPack(small).every((c) => c.rarete !== "legendaire"));
});
