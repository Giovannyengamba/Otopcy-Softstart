---
name: otopcy-architecture
description: Use when laying out a new codebase, deciding where server-only code lives, debugging a page that works in dev but 500s in production, setting up logging and request IDs, adding an optional third-party provider, validating environment variables, or deciding whether to add multi-tenancy. Covers the server-only boundary, runtime='nodejs' enforcement, AsyncLocalStorage request context, the "missing key = inert, never fatal" convention, and tripwire tests.
---

# Architecture — Otopcy SoftStart

Par Giovanny Engamba (giovannyengamba.com) · Otopcy (otopcy.com).

## Un seul déploiement

Un projet Next.js qui contient ses propres routes serveur suffit très
loin. Deux déploiements = deux jeux de types qui divergent, deux endroits
où lire un journal, une frontière HTTP pour lire une ligne de base.

```
src/
├── app/api/<ressource>/route.ts
├── lib/
│   ├── server/          ← ne s'importe JAMAIS d'un composant client
│   ├── <domaine>.ts     ← partagé, donc PUR (pas de base, pas de secret)
│   └── api.ts           ← client HTTP du navigateur
└── components/
```

## La frontière, et le 500 qui n'arrive qu'en production

Un fichier partagé qui importe, même indirectement, quelque chose de
`lib/server/` : tout marche en développement, 500 en production — le
regroupement de modules n'est pas le même.

```ts
import 'server-only';   // en tête de TOUT fichier de lib/server/
```

Fait échouer la **construction**, avec un message clair, plutôt qu'un 500
à minuit. Réciproque : `import 'client-only'`.

## `export const runtime = 'nodejs'`

Sur **chaque** route. Prisma, bcrypt et la lecture du corps brut ne
fonctionnent pas en edge. L'oubli ne produit aucune erreur en
développement.

Ne compte pas sur ta vigilance : écris le test qui parcourt
`app/api/**/route.ts` et fait échouer l'intégration continue.

> **Principe central :** quand une règle compte, on écrit un test qui la
> surveille. Une règle dans un document sera enfreinte dans six mois par
> quelqu'un qui ignorait qu'elle existait.

## Observabilité — avant la première route

```ts
const ctx = makeRequestContext(req.headers);
return withRequestContext(ctx, async () => {
  log.info('machin.debut');   // porte déjà requestId, route, userId
});
```

`AsyncLocalStorage` pour le contexte · journal **structuré** avec
occultation des champs sensibles (un journal qui imprime un mot de passe
est une fuite) · renvoie `x-request-id` : l'utilisateur te le donne, tu
retrouves sa requête.

On ne rétro-instrumente jamais. Soit c'est là au départ, soit jamais.

## Absent = inerte, jamais fatal

```ts
export const redis: Redis | null = (() => {
  if (!url || !token) { log.warn('redis.non_configure'); return null; }
  return new Redis({ url, token });
})();
```

Le type `| null` **oblige** chaque appelant à décider du repli — c'est là
toute la valeur. Repli explicite par appel : limitation en mémoire, e-mail
en file, téléversement en `503 STORAGE_NOT_CONFIGURED`. Un avertissement au
démarrage, une fois.

Valide l'environnement **à l'usage**, pas au chargement du module : une
validation au chargement casse la construction, les tests et l'outillage.

## Multi-tenancy

**Ne la mets pas si tu n'en as pas besoin aujourd'hui.** Chaque requête
porte un filtre de plus, chaque test un contexte de plus, chaque bug une
dimension de plus, pour toujours.

Départ : tout appartient à un `userId`. Le jour où un vrai client demande
des équipes : `organizationId String?` sur les modèles concernés seulement.
Non-membre ⇒ **404**, jamais 403.

## TypeScript

`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
Pénible trois jours, et ça attrape exactement les
`Cannot read property of undefined` de production.

On ne fait pas taire le compilateur : un `as` sans commentaire expliquant
pourquoi l'affirmation est vraie est un `any` déguisé.
