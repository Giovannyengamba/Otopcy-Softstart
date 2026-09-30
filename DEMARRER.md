# Démarrer un projet neuf

Quatre-vingt-dix minutes, dans cet ordre. Chaque étape est faisable sans
avoir lu le reste du dépôt ; les liens mènent au détail quand il en faut.

L'ordre n'est pas arbitraire : il est choisi pour que **rien de coûteux à
changer plus tard** ne soit décidé par défaut. La forme de la base, la
frontière client/serveur et la convention de journalisation sont les trois
choses qu'on ne corrige plus une fois qu'il y a cent fichiers.

---

> **Tu n'as pas encore le kit ?**
> [⬇ Télécharger l'archive (.zip)](https://github.com/Giovannyengamba/otopcy-softstart/releases/latest)
> ou `git clone https://github.com/Giovannyengamba/otopcy-softstart.git`.
> Les chemins ci-dessous (`modules/…`) partent de la racine du dossier
> obtenu. Voir [Récupérer le kit](README.md#récupérer-le-kit).

## 1. Poser le squelette — 15 min

```bash
pnpm create next-app@latest mon-projet --typescript --app --eslint
cd mon-projet
pnpm add @prisma/client zod
pnpm add -D prisma vitest
pnpm exec prisma init
```

Dans `tsconfig.json`, active les trois options qui font vraiment travailler
le compilateur. Elles sont pénibles au début et te sauvent ensuite :

```jsonc
{
  "compilerOptions": {
    "strict": true,
    // interdit d'accéder à tableau[i] sans vérifier que ça existe
    "noUncheckedIndexedAccess": true,
    // distingue « propriété absente » de « propriété à undefined »
    "exactOptionalPropertyTypes": true
  }
}
```

→ [Module 00 — Architecture](modules/00-architecture/)

## 2. Décider la forme des données — 20 min

C'est le moment où l'on réfléchit, pas où l'on tape. Trois questions :

- **Qui possède quoi ?** Un objet appartient-il à un utilisateur
  (`userId`) ou à une organisation (`organizationId`) ? Ce choix se change
  très mal après coup. Dans le doute, commence par l'utilisateur : ajouter
  les organisations plus tard est une migration ; les retirer est une
  réécriture. → [Module 00](modules/00-architecture/#multi-tenancy)
- **Qu'est-ce qui est de l'argent ?** Tout montant est un `Int` en plus
  petite unité. Jamais `Float`, jamais `Decimal` « pour être tranquille ».
  → [Module 02](modules/02-paiements/)
- **Qu'est-ce qui doit être traçable ?** Toute table que l'administration
  pourra modifier a besoin de `createdAt` et `updatedAt`.

## 3. Brancher la base et les secrets — 10 min

Copie [`cles/.env.example`](cles/.env.example) en `.env`, et remplis
uniquement le premier bloc (`DATABASE_URL`, `JWT_SECRET`, `COOKIE_PREFIX`).
Tout le reste peut rester vide : les prestataires absents sont inertes.

```bash
cp .env.example .env
echo ".env" >> .gitignore    # AVANT le premier commit, pas après
pnpm exec prisma db push
```

> ⚠️ Le `.gitignore` se met en place **avant** le premier commit. Un `.env`
> commité une fois reste dans l'historique même après suppression, et
> toutes les clés qu'il contenait sont à révoquer.

→ [cles/](cles/)

## 4. Poser l'observabilité — 10 min

Avant la première route, pas après. Une application sans identifiant de
requête dans ses journaux est une application qu'on déboguera à l'aveugle
le jour où elle tombera.

Copie dans `src/lib/server/` :

- [`logger.ts`](modules/00-architecture/code/logger.ts) — journalisation
  structurée, avec occultation des champs sensibles
- [`observability/request-context.ts`](modules/00-architecture/code/observability/request-context.ts)
  — l'identifiant de requête qui se propage tout seul

→ [Module 00](modules/00-architecture/)

## 5. Poser la barrière de sécurité — 20 min

Ces quatre briques se copient une fois et servent partout ensuite :

| Fichier | Ce qu'il fait |
|---|---|
| [`middleware/index.ts`](modules/01-securite/code/middleware/index.ts) | `requireAuth`, `requireAdmin`, `optionalAuth` |
| [`rate-limit-store.ts`](modules/01-securite/code/rate-limit-store.ts) | Limitation de débit, Redis si présent, mémoire sinon |
| [`crypto.ts`](modules/01-securite/code/crypto.ts) | Jetons, comparaisons à temps constant |
| [`api-client.ts`](modules/01-securite/code/api-client.ts) | Le client navigateur : rafraîchit la session, attache le CSRF, **ne rejoue jamais un POST** |

Puis colle la CSP et les en-têtes de sécurité dans `next.config.ts`.

→ [Module 01](modules/01-securite/)

## 6. Poser le garde-fou automatique — 5 min

Une seule chose, mais qui rattrape la faute la plus fréquente de la pile :
oublier `export const runtime = 'nodejs'` sur une route qui utilise Prisma.
Ça ne casse pas en développement, ça casse en production.

Copie
[`runtime-enforcement.test.ts`](modules/00-architecture/code/observability/runtime-enforcement.test.ts).
Il parcourt toutes tes routes et fait échouer l'intégration continue si
l'une d'elles l'a oublié.

C'est le modèle à reproduire : **quand une règle est importante, on écrit un
test qui la surveille**, plutôt qu'un paragraphe dans un fichier que
personne ne relira.

## 7. Seulement maintenant, la première fonctionnalité — 10 min

Modèle d'une route qui fait tout correctement :

```ts
// src/app/api/machin/route.ts
export const runtime = 'nodejs';            // 1. obligatoire

export async function POST(req: NextRequest) {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrf = verifyCsrf(req);           // 2. avant toute écriture
    if (csrf) return csrf;

    const auth = await requireAuth(req);    // 3. avant toute donnée privée
    if (auth instanceof NextResponse) return auth;

    const corps = Schema.safeParse(await req.json());   // 4. valider
    if (!corps.success) return erreur(400, 'INVALID_BODY');

    // 5. le travail
  });
}
```

Les cinq lignes avant « le travail » ne sont pas de la cérémonie. Chacune
ferme une classe entière de failles, et les oublier ne provoque aucune
erreur visible — juste un trou.

---

## Ce qui reste, dans l'ordre où le besoin arrive

| Quand | Module |
|---|---|
| Tu dois encaisser | [02 — Paiements](modules/02-paiements/) |
| Quelqu'un doit gérer le contenu | [03 — Administration](modules/03-admin/) |
| Tu dois envoyer un e-mail | [07 — E-mails](modules/07-emails/) |
| Un traitement doit tourner tout seul | [08 — Tâches planifiées](modules/08-taches-planifiees/) |
| Le site est lent | [04 — Performance](modules/04-performance/) |
| Tu veux savoir qui vient | [05 — Statistiques](modules/05-statistiques/) |
| Tu veux être trouvé | [06 — SEO](modules/06-seo/) |
| Tu dois brancher un service, ou un compte Google | [10 — Comptes et outils](modules/10-comptes-et-outils/) |
| **Avant la mise en ligne** | [audit/](audit/) — les 20 contrôles |
