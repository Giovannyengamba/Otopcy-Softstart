# 00 — Architecture

> La forme du projet, et les quatre ou cinq décisions qu'on ne peut plus
> défaire une fois qu'il y a cent fichiers.

---

## Un seul déploiement, pas deux

La tentation au départ est de séparer une API (Express, NestJS) d'un client
(Next, React). Sur un produit tenu par une à trois personnes, c'est une
erreur : deux déploiements, deux jeux de types qui divergent, deux endroits
où lire un journal, et une frontière HTTP à traverser pour lire une ligne
de base de données.

**Un seul projet Next.js** qui contient ses propres routes serveur suffit
jusqu'à très loin. Le jour où une partie doit vraiment vivre à part, on
l'extrait — et ce jour-là on saura laquelle, ce qu'on ne sait pas au début.

```
src/
├── app/
│   ├── api/<ressource>/route.ts   ← les routes serveur
│   ├── (pages)/                   ← les pages
│   └── layout.tsx
├── lib/
│   ├── server/                    ← TOUT ce qui ne doit jamais partir au navigateur
│   │   ├── auth.ts
│   │   ├── middleware/
│   │   ├── payments/
│   │   ├── observability/
│   │   └── …
│   ├── <domaine>.ts               ← code partagé, PUR (pas d'accès base, pas de secret)
│   └── api.ts                     ← le client HTTP du navigateur
└── components/
```

La règle tient en une ligne : **`lib/server/` ne s'importe jamais depuis un
composant client.** Le reste de `lib/` doit pouvoir s'importer des deux
côtés, donc ne contenir que des fonctions pures.

### Le piège qui ne se voit qu'en production

Une page serveur importe un fichier partagé ; ce fichier importe, même
indirectement, quelque chose de `lib/server/`. En développement, tout
fonctionne. En production, la page renvoie 500 — le regroupement de modules
n'est pas le même, et un module serveur se retrouve tiré dans un paquet
client, où `process.env` et les modules Node n'existent pas.

Deux parades, à poser tôt :

```ts
// en tête de tout fichier de lib/server/
import 'server-only';
```

`server-only` fait échouer la **construction**, avec un message clair, dès
qu'un composant client l'atteint. C'est un échec au bon moment, plutôt
qu'un 500 à minuit.

Et pour la réciproque, un fichier qui ne doit tourner que dans le
navigateur : `import 'client-only'`.

---

## `export const runtime = 'nodejs'` sur chaque route

Next choisit par défaut le runtime « edge » dans certains cas. Prisma,
bcrypt et la lecture du corps brut d'une requête n'y fonctionnent pas.
L'oubli ne produit **aucune erreur en développement** : il casse au
déploiement, sur une route qu'on n'avait pas retestée.

Ne compte pas sur ta vigilance. Copie
[`code/observability/runtime-enforcement.test.ts`](code/observability/runtime-enforcement.test.ts) :
il parcourt `app/api/**/route.ts` et fait échouer l'intégration continue
si une seule route l'a oublié.

> **Le principe général, et c'est le plus important de ce module :** quand
> une règle compte, on écrit un test qui la surveille. Une règle dans un
> fichier de documentation est une règle que quelqu'un enfreindra dans six
> mois sans même savoir qu'elle existait.

D'autres garde-fous du même genre valent la peine :

- un test qui vérifie que chaque cron déclaré dans `vercel.json` a bien une
  route correspondante, et l'inverse ;
- un test qui refuse une variable d'environnement utilisée dans le code
  mais absente de `.env.example` ;
- un test qui refuse `NEXT_PUBLIC_` sur un nom contenant `SECRET`, `KEY`
  ou `TOKEN`.

---

## L'observabilité se pose avant la première route

Une application qui tombe sans identifiant de requête dans ses journaux se
débogue à l'aveugle. Et on ne rétro-instrumente jamais : soit c'est là dès
le départ, soit ça n'y sera jamais.

Deux fichiers, à copier tels quels :

| Fichier | Rôle |
|---|---|
| [`code/logger.ts`](code/logger.ts) | Journal structuré en JSON, avec **occultation** des champs sensibles (`password`, `token`, `authorization`…). Un journal qui imprime un mot de passe est une fuite, même privé. |
| [`code/observability/request-context.ts`](code/observability/request-context.ts) | Un `AsyncLocalStorage` qui porte `requestId`, `userId` et `route`. Toute ligne écrite pendant la requête les porte automatiquement. |

Usage, à répéter dans chaque route :

```ts
export async function POST(req: NextRequest) {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    log.info('machin.debut');      // porte déjà requestId, route, userId
    // …
  });
}
```

Renvoie aussi `x-request-id` dans la réponse. Quand un utilisateur signale
un bug, il peut te donner l'identifiant, et tu retrouves sa requête exacte
en une recherche.

---

## « Absent = inerte », jamais « absent = fatal »

Un projet accumule les prestataires : stockage, e-mail, paiement, mesure
d'audience, IA. Si chacun exige sa clé au démarrage, l'application ne
démarre plus nulle part — ni chez un nouveau développeur, ni en test, ni
dans un environnement de recette.

La convention :

```ts
// code/redis.ts — le modèle canonique
export const redis: Redis | null = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    log.warn('redis.non_configure');   // on le dit, une fois
    return null;                        // on ne jette pas
  }
  return new Redis({ url, token });
})();
```

Trois conséquences, à tenir partout :

1. Le type est `| null`, donc **le compilateur oblige** chaque appelant à
   décider du repli. C'est là toute la valeur : on ne peut pas oublier.
2. Le repli est un choix explicite par appel. La limitation de débit
   retombe sur un compteur en mémoire ; l'envoi d'e-mail met en file ; le
   téléversement renvoie `503 STORAGE_NOT_CONFIGURED`.
3. Un avertissement part au démarrage, une seule fois. Sinon on passe une
   journée à chercher pourquoi les e-mails ne partent pas.

Voir [`cles/`](../../cles/) pour le tableau complet : quelle clé débloque
quoi, et que fait l'application sans elle.

### Valider l'environnement, mais au bon moment

Valide **à l'usage**, pas au chargement du module. Une validation au
chargement casse la construction, les tests, et l'outillage — pour une
variable dont 90 % du code n'a pas besoin.

```ts
function requisEnProd(nom: string): string {
  const v = process.env[nom];
  if (v) return v;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${nom} est obligatoire en production`);
  }
  return `dev-${nom.toLowerCase()}`;  // valeur de développement, jamais en prod
}
```

---

## Multi-tenancy

**Ne la mets pas si tu n'en as pas besoin aujourd'hui.** C'est la décision
la plus souvent prise « au cas où », et celle qui coûte le plus cher en
complexité permanente : chaque requête porte un filtre de plus, chaque test
un contexte de plus, chaque bug une dimension de plus.

Le chemin réaliste :

1. **Départ** — tout appartient à un utilisateur (`userId`). Simple, et
   c'est ce dont 90 % des produits ont besoin pour toujours.
2. **Le jour où un vrai client demande des équipes** — ajoute
   `organizationId String?` sur les modèles concernés, **seulement** ceux-là.
   Le `?` permet de migrer sans réécrire l'existant.
3. Passe les routes concernées derrière un contrôle de rôle d'organisation.
   → [`code/middleware/require-org-role.ts`](../01-securite/code/middleware/require-org-role.ts)

Une seule subtilité, mais elle compte : **un non-membre reçoit 404, pas
403.** Un 403 confirme que l'organisation existe — c'est une fuite
d'information qui permet d'énumérer les clients.

---

## Conventions TypeScript

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,     // tableau[i] est T | undefined
  "exactOptionalPropertyTypes": true    // { a?: string } ≠ { a: string | undefined }
}
```

Les deux dernières sont inhabituelles et franchement pénibles les premiers
jours. Elles attrapent exactement les bugs qui, sans elles, se manifestent
en production sous forme de `Cannot read property of undefined`.

Et la règle qui va avec : **on ne fait pas taire le compilateur avec
`any` ou `as`.** Un `as` est une affirmation que le compilateur ne peut pas
vérifier ; s'il y en a un, il a besoin d'un commentaire qui dit pourquoi
elle est vraie. Sinon c'est un `any` déguisé.

---

## Le code de ce module

> Ces fichiers se **copient**, ils ne s'installent pas. Les imports pointent vers ton projet et sont à recâbler — voir [Utiliser les dossiers `code/`](../UTILISER-LE-CODE.md).

| Fichier | Ce que c'est |
|---|---|
| [`code/logger.ts`](code/logger.ts) | Journal structuré avec occultation |
| [`code/redis.ts`](code/redis.ts) | Le modèle « absent = inerte » |
| [`code/zod-helpers.ts`](code/zod-helpers.ts) | Petits schémas partagés |
| [`code/observability/request-context.ts`](code/observability/request-context.ts) | Identifiant de requête propagé |
| [`code/observability/runtime-enforcement.test.ts`](code/observability/runtime-enforcement.test.ts) | Le garde-fou `runtime = 'nodejs'` |
