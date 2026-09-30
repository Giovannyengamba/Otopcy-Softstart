# 04 — Performance et mise en cache

> Une page lente n'a presque jamais une seule cause. Mais il y a un ordre
> pour les traiter, et la plupart des gens le prennent à l'envers : ils
> optimisent les images pendant que chaque visite fait un aller-retour
> inutile à l'autre bout du monde.

---

## Mesurer avant de toucher quoi que ce soit

Trois chiffres, dans cet ordre. Chacun répond à une question différente, et
tant qu'on ne les a pas, on optimise au hasard.

**1. Le plancher géographique.** Une route qui ne fait *rien*.

```bash
curl -o /dev/null -w '%{time_starttransfer}\n' https://ton-site.com/api/health
```

C'est le temps incompressible tant que le serveur reste où il est. S'il est
à 550 ms, aucune optimisation de code ne fera mieux que 550 ms.

**2. Le travail serveur.** Le temps d'une vraie page, moins le plancher.

**3. La charge utile.** Ce qui est réellement téléchargé — dans l'onglet
Réseau, pas en grepant le HTML.

> Un exemple d'erreur d'analyse, commise sur le produit d'origine : « 15 Mo
> d'images sur la boutique », conclu en cherchant des `.jpg` dans le HTML.
> La mesure réelle : 2,8 Mo en WebP optimisé, 47 images sur 50 en chargement
> différé. **Ce qui est référencé n'est pas ce qui est téléchargé.**

### Depuis où mesurer

Depuis là où sont tes utilisateurs, pas depuis ta machine. Un site servi
depuis Dublin répond en 30 ms à Paris et en 550 ms à Douala. Si ton public
est à Douala, les chiffres parisiens ne veulent rien dire.

---

## Le piège qui coûte le plus cher

**Lire un en-tête de requête dans le gabarit racine rend TOUTE
l'application dynamique.**

```tsx
// src/app/layout.tsx
export default async function RootLayout({ children }) {
  const pays = (await headers()).get('x-country');   // ← ceci
  // …
}
```

Ce seul appel fait que plus **aucune** page du site ne peut être mise en
cache. Chaque visite, même pour lire un article statique, repart jusqu'à la
fonction serveur. Et la partie cruelle : une page qui déclare
`export const revalidate = 300` n'y change rien — le gabarit racine
l'emporte.

Le symptôme : toutes les pages répondent
`cache-control: private, no-cache, no-store`, et personne ne comprend
pourquoi, parce que la cause est dans un fichier que personne ne relit.

### Comment vérifier en dix secondes

```bash
pnpm build          # puis lis le tableau des routes
```

```
○  (Static)   préenregistré                 ← bon
●  (SSG)      préenregistré via params      ← bon
ƒ  (Dynamic)  rendu à chaque requête        ← justifie-le, ou corrige-le
```

Si **tout** est en `ƒ`, la cause est dans le gabarit racine, presque à coup
sûr.

### La solution : descendre la dynamique d'un cran

Le besoin — afficher un prix dans la bonne monnaie dès le premier pixel —
est réel. Mais il ne concerne pas les pages qui n'affichent pas de prix.

```
app/
├── layout.tsx              ← AUCUN headers(). Reste statique.
├── actualite/              ← préenregistré, servi depuis le point d'accès proche
├── portfolio/              ← idem
├── boutique/
│   └── layout.tsx          ← <AvecDevise> : dynamique, ici seulement
└── academy/
    └── layout.tsx          ← idem
```

Un composant serveur qui résout la région et enveloppe la branche :

```tsx
export async function AvecDevise({ children }: { children: ReactNode }) {
  const region = await getRegion();   // lit l'en-tête → rend CETTE branche dynamique
  return <DeviseProvider initial={region}>{children}</DeviseProvider>;
}
```

Et pour le peu qui a besoin de la monnaie sur une page cachée — un total de
panier dans un tiroir qu'il faut ouvrir — le contexte l'apprend après coup
par un petit appel.

**Résultat mesuré** sur le produit d'origine, depuis l'Afrique centrale :
les pages sans prix sont passées de ≥550 ms de simple premier octet à
365–500 ms **corps entier téléchargé**. Les pages à prix sont restées où
elles étaient, volontairement.

---

## Mise en cache des lectures

Deux familles de lectures, à ne jamais confondre :

| | Cache | Exemple |
|---|---|---|
| **Affichage public** | oui | Le catalogue sur la boutique |
| **Décision** | **jamais** | Le même catalogue lu par un webhook de paiement |

Un webhook, une route de commande, un téléchargement protégé, une page
d'administration : ils lisent la base **à la seconde**. Servir une donnée
vieille de soixante secondes à un webhook, c'est encaisser sur un prix qui
n'existe plus.

Donc : **deux jeux de fonctions de lecture**, dans deux fichiers différents.
Pas un paramètre `{ cache: true }` qu'on oubliera.

```
lib/server/lectures-publiques.ts   ← mises en cache, pour les pages
lib/server/produits.ts             ← directes, pour l'argent et l'admin
```

### Ceinture et bretelles pour l'invalidation

Deux mécanismes, parce que chacun rattrape la faiblesse de l'autre :

```ts
// 1. une durée courte : un site d'écriture oublié est périmé 60 s, pas pour toujours
export const DUREE = 60;

// 2. une étiquette effacée à chaque écriture : effet immédiat
export function oublier(...etiquettes: Etiquette[]) {
  for (const e of etiquettes) revalidateTag(e, { expire: 0 });
}
```

La durée seule : tout est en retard d'une minute, y compris une correction
urgente. L'étiquette seule : le jour où quelqu'un ajoute une route
d'écriture sans appeler `oublier()`, la page est fausse **pour toujours**.
Les deux ensemble : le pire cas est soixante secondes.

→ [`code/cache-public.ts`](code/cache-public.ts)

### Ce que l'étiquette invalide vraiment

`revalidateTag` n'efface pas seulement l'entrée de données : il invalide
aussi le **cache de route** des pages qui ont consommé cette donnée pendant
leur rendu. Une page préenregistrée se régénère donc bien. C'est ce qui rend
le duo durée + étiquette suffisant, sans avoir à lister les pages à la main.

---

## Géographie

Trois lieux, à garder alignés :

1. **La région de la fonction** — où tourne ton code.
2. **La région de la base** — la fonction lui parle des dizaines de fois
   par page. Une fonction à Dublin et une base en Virginie, c'est un
   aller-retour transatlantique par requête SQL.
3. **Les utilisateurs** — ce qu'on ne peut pas déplacer.

Mets la fonction **près de la base**, jamais près des utilisateurs : une
page fait une requête HTTP et trente requêtes SQL. Puis rapproche les
**pages** des utilisateurs par la mise en cache au bord du réseau — ce qui
ramène à la section précédente.

---

## Animations et JavaScript

Deux réflexes qui rapportent beaucoup pour peu :

**Une translation régulière, c'est du CSS.** Un bandeau qui défile animé en
JavaScript occupe le fil principal en permanence et oblige à embarquer un
moteur d'animation dans le premier paquet de chaque page. La même chose en
`@keyframes` + `translate3d` part au compositeur, donc à la carte graphique,
et ne coûte plus rien.

**Le moteur d'animation se charge à la demande.** Les bibliothèques
sérieuses ont un mode où le moteur arrive en second paquet, après le
premier rendu. Le gain se mesure honnêtement — sur le produit d'origine,
902 → 812 Ko : réel, mais pas magique. Enlever le reste aurait voulu dire
enlever les animations, pas les alléger. **Dis lequel des deux tu fais.**

Et respecte `prefers-reduced-motion`. Ce n'est pas du confort : un
défilement continu peut rendre malade.

---

## Ordre de travail

1. Mesurer le plancher géographique
2. Vérifier le tableau des routes — combien de `ƒ` sont vraiment justifiés
3. Sortir la dynamique du gabarit racine
4. Mettre en cache les lectures d'affichage, avec durée **et** étiquettes
5. Paralléliser les lectures d'une même page (`Promise.all`)
6. Seulement ensuite : images, polices, JavaScript

Les trois premiers points valent typiquement des centaines de
millisecondes. Les trois derniers, des dizaines.

---

## Pièges vécus

| Symptôme | Cause |
|---|---|
| Aucune page n'est cachée, `revalidate` ignoré | `headers()` dans le gabarit racine |
| Une correction n'apparaît jamais | Écriture sans invalidation d'étiquette |
| Un webhook facture un ancien prix | Lecture mise en cache côté argent |
| Page rapide chez toi, lente pour les clients | Mesuré depuis le mauvais endroit |
| Requêtes SQL très lentes | Fonction et base dans deux régions |
| Le fil principal sature sur mobile | Animation continue en JavaScript |
| La construction échoue sur la base | Préenregistrement massivement parallèle → trop de connexions |

> Le dernier est un effet de bord du succès : dès que les pages sont
> préenregistrées, la **construction** lit la base pour chacune. Un
> processus par cœur, chacun avec sa réserve de connexions, saturent vite
> un répartiteur. Limite le nombre de processus de préenregistrement.

## Le code de ce module

> Ces fichiers se **copient**, ils ne s'installent pas. Les imports pointent vers ton projet et sont à recâbler — voir [Utiliser les dossiers `code/`](../UTILISER-LE-CODE.md).

| Fichier | Ce que c'est |
|---|---|
| [`code/cache-public.ts`](code/cache-public.ts) | `garde()` / `oublier()` — durée + étiquettes |
| [`code/geo.ts`](code/geo.ts) | Résolution du pays du visiteur depuis l'en-tête |
