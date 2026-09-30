#!/usr/bin/env node
// Tout lien relatif d'un fichier Markdown doit pointer vers un fichier qui
// existe. Un sommaire qui ment est la première chose qu'on remarque dans
// un dépôt public, et la dernière qu'on pense à vérifier.

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';

const fichiers = globSync('**/*.md', { exclude: (p) => p.includes('node_modules') || p.includes('.git/') });
const casses = [];

for (const md of fichiers) {
  const contenu = readFileSync(md, 'utf8');
  // [texte](cible) — on ignore les ancres et les URL absolues
  for (const [, cible] of contenu.matchAll(/\]\(([^)#\s]+?)(?:#[^)]*)?\)/g)) {
    if (/^(https?:|mailto:)/.test(cible)) continue;
    if (!existsSync(join(dirname(md), decodeURIComponent(cible)))) {
      casses.push(`${md} → ${cible}`);
    }
  }
}

if (casses.length) {
  console.error(`✗ ${casses.length} lien(s) cassé(s) :`);
  for (const c of casses) console.error(`   ${c}`);
  process.exit(1);
}
console.log(`✓ ${fichiers.length} fichiers Markdown, tous les liens relatifs résolvent`);
