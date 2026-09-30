# Utiliser les dossiers `code/`

Les fichiers sous `modules/*/code/` ne sont **pas un paquet à installer**.
Ils sont faits pour être **copiés** dans ton projet, puis possédés par toi.

## Ce que ça implique

**Les imports ne résolvent pas tels quels.** Tu verras des lignes comme
`import { log } from '@/lib/server/observability/log'` ou
`from '../queues/email-queue'`. Elles pointent vers *ton* projet, pas vers
ce dépôt. Recâble-les à la copie — c'est une minute par fichier, et c'est
le prix de ne pas avoir de dépendance.

**Rien ne te sera mis à jour.** Personne ne poussera un correctif qui casse
ton application, et personne ne corrigera un bug à ta place. C'est le même
marché que pour un composant copié depuis une bibliothèque de composants.

**Les versions bougent.** Le code vise Next.js 16, Prisma 5, React 19. Si
une signature a changé, lis le commentaire : il explique *pourquoi* le code
est ainsi, et c'est ça qui se transpose.

## La méthode

1. Copie le fichier à sa place logique dans `src/lib/server/…`
2. Recâble les imports
3. **Lis les commentaires** — ils portent les invariants, et ce sont eux qui
   valent, pas les lignes de code
4. Adapte les constantes marquées (`DEBIT_PAR_DEFAUT`, `TAUX`, `ENTETE_PAYS`,
   les tables de capacités)
5. Fais tourner `pnpm typecheck` — le compilateur te montre ce qui manque

## Ce qui se copie sans rien changer

`logger.ts` · `crypto.ts` · `rate-limit-store.ts` · `zod-helpers.ts` ·
`request-context.ts` · `runtime-enforcement.test.ts` · `circuit-breaker.ts` ·
`leader-lease.ts` · `sniff.ts` · `devises.ts`

## Ce qui demande un arbitrage

| Fichier | À décider |
|---|---|
| `currency.ts` | Tes devises encaissées, tes taux, ta majoration |
| `geo.ts` | Le nom de l'en-tête de pays, ton repli |
| `cache-public.ts` | Tes étiquettes, ta durée |
| `middleware/*` | Tes rôles et leur précédence |
| `handler.ts` | La forme de signature de ton prestataire |
| `audit.ts` | Le nom de ton modèle Prisma |
