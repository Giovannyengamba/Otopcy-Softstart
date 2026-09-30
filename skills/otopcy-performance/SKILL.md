---
name: otopcy-performance
description: Use when a site or page is slow, when nothing is being cached, when adding ISR or cache tags, when a stale value keeps being served, when choosing a deployment region, or when writing background/scheduled work. Covers the dynamic-root-layout trap that makes an entire app uncacheable, cache tags plus TTL invalidation, splitting cached display reads from to-the-second reads, region placement, and why setInterval does not work on serverless.
---

# Performance et travail de fond — Otopcy SoftStart

Par Giovanny Engamba (giovannyengamba.com) · Otopcy (otopcy.com).

## Mesurer d'abord

1. **Plancher géographique** — `curl -w '%{time_starttransfer}'` sur une
   route qui ne fait rien. Aucune optimisation ne passera sous ce chiffre.
2. **Travail serveur** — une vraie page, moins le plancher.
3. **Charge utile** — onglet Réseau, **pas** un grep du HTML.

Mesure depuis là où sont les utilisateurs. Un site à 30 ms de Paris est à
550 ms de Douala.

> Erreur d'analyse réelle : « 15 Mo d'images », conclu en grepant des
> `.jpg` dans le HTML. Mesure réelle : 2,8 Mo en WebP, 47/50 différées.
> **Ce qui est référencé n'est pas ce qui est téléchargé.**

## Le piège le plus coûteux

**`headers()` (ou `cookies()`) dans le gabarit racine rend TOUTE
l'application dynamique.** Plus aucune page mise en cache ; un
`export const revalidate` sur une page n'y change rien.

Vérification : `pnpm build`, puis le tableau des routes. Tout en `ƒ` ⇒ la
cause est là, presque à coup sûr.

Solution — descendre la dynamique d'un cran :

```
app/layout.tsx         ← AUCUN headers(). Reste statique.
app/actualite/         ← préenregistré, servi du point d'accès proche
app/boutique/layout.tsx ← <AvecDevise> : dynamique ICI seulement
```

Mesuré : pages sans prix passées de ≥550 ms de premier octet à 365–500 ms
**corps entier**.

## Deux familles de lectures

| | Cache | Exemple |
|---|---|---|
| Affichage public | oui | Catalogue sur la boutique |
| **Décision** | **jamais** | Le même catalogue lu par un webhook |

Webhooks, routes de commande, téléchargements protégés, administration :
lecture **à la seconde**. Deux fichiers distincts, pas un paramètre
`{ cache: true }` qu'on oubliera.

## Invalidation : ceinture et bretelles

```ts
export const DUREE = 60;                                  // 1. plafond de péremption
export function oublier(...t) { for (const e of t) revalidateTag(e, { expire: 0 }); }  // 2. immédiat
```

Durée seule : tout est en retard d'une minute. Étiquette seule : une route
d'écriture oubliée rend la page fausse **pour toujours**. Les deux : pire
cas 60 s.

`revalidateTag` invalide aussi le **cache de route** des pages qui ont
consommé la donnée — les pages préenregistrées se régénèrent.

## Géographie

Fonction **près de la base** (une page fait 1 requête HTTP et 30 SQL),
jamais près des utilisateurs. Rapproche les **pages** des utilisateurs par
la mise en cache au bord.

## Travail de fond : `setInterval` ne marche pas

Pas de processus maintenu en vie entre deux requêtes. Le code n'échoue pas,
il ne s'exécute **pas** — bien pire à diagnostiquer.

Une route HTTP + un planificateur externe, et **toujours** :

```ts
const refus = verifyCronSecret(req);   // Authorization: Bearer ${CRON_SECRET}
if (refus) return refus;
```

Sans ce contrôle, n'importe qui déclenche ton travail de fond.

Quatre propriétés : **idempotent** (il tournera deux fois) · **borné**
(`take: 100`, sinon tué au milieu) · **réclamation atomique**
(`updateMany({ where: { statut: 'PENDING' }, data: { statut: 'PROCESSING' } })`,
`count === 0` ⇒ quelqu'un d'autre l'a pris) · **observable** (un cron
silencieux arrêté depuis trois semaines, personne ne le remarque).

Verrou entre instances : bail Redis **qui expire**. Un verrou éternel dont
le porteur meurt bloque le travail pour toujours.

## Animations

Une translation régulière est du CSS (`@keyframes` + `translate3d` → part
au compositeur). Le moteur d'animation se charge à la demande. Mesure
honnêtement : 902 → 812 Ko est réel, pas magique — enlever le reste
voudrait dire enlever les animations. Respecte `prefers-reduced-motion`.

## Ordre de travail

Plancher → tableau des routes → sortir la dynamique du gabarit racine →
cache des lectures d'affichage → `Promise.all` → **ensuite** images,
polices, JS. Les trois premiers valent des centaines de ms ; les derniers,
des dizaines.
