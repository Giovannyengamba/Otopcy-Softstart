# 09 — Processus

> Le code de ce kit se copie en une heure. Ce module est ce qui fait qu'il
> tient encore dans six mois — et c'est la partie que tout le monde saute.

---

## La barrière avant commit

Quatre commandes, dans cet ordre, à chaque fois. Pas « quand j'y pense ».

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

L'ordre n'est pas décoratif : le formatage modifie les fichiers, donc il
passe avant les vérifications ; le typage attrape ce que le linter ignore ;
les tests attrapent ce que les deux laissent passer.

Et avant de **pousser**, une cinquième : `pnpm build`. Certaines erreurs —
frontière client/serveur, imports circulaires, page qui ne peut pas se
préenregistrer — n'apparaissent qu'à la construction.

> Mets-la en pré-commit si tu veux, mais sache qu'un crochet qu'on peut
> contourner avec `--no-verify` sera contourné. L'endroit qui compte est
> l'intégration continue, parce qu'on ne peut pas la sauter.

---

## Quand une règle compte, écris le test

C'est le principe central de ce kit, et le seul qui survive au temps.

Une règle écrite dans un fichier de documentation est une règle que
quelqu'un enfreindra dans six mois sans savoir qu'elle existait. Une règle
qui fait échouer l'intégration continue est une règle qui tient.

Ceux qui rapportent le plus :

| Garde-fou | Ce qu'il rattrape |
|---|---|
| Chaque route exporte `runtime = 'nodejs'` | Casse en production, pas en développement |
| Crons de `vercel.json` ⟺ routes existantes | Travail qui ne tourne jamais, ou 404 en boucle |
| Variables utilisées ⊆ `.env.example` | « Ça marche chez moi » |
| Aucun `NEXT_PUBLIC_*` contenant `SECRET`/`KEY`/`TOKEN` | Clé publiée |
| Toute route `/api/admin/*` qui écrit appelle `logAdminAction` | Mutation non auditée |

Dix à trente lignes chacun. Ils se paient au premier incident évité.

---

## Les fichiers qu'on ne touche pas sans raison

Dans tout projet, une poignée de fichiers concentrent des invariants
subtils : courses entre jetons de rafraîchissement, ordre du calcul HMAC,
verrous consultatifs, propagation d'identifiant de requête. Ils *semblent*
simples et se cassent en silence.

Écris-en la liste dans le `CLAUDE.md` (ou le `CONTRIBUTING.md`) du projet,
avec une phrase par fichier expliquant **ce qui casse**. Pas « ne pas
toucher » — personne n'obéit à une interdiction sans motif.

```markdown
## Fichiers à ne pas modifier sans discussion

- `lib/server/auth.ts` — courses sur le rafraîchissement de jeton
- `lib/server/webhook/handler.ts` — ordre corps-brut/HMAC, transaction Serializable
- `lib/api.ts` — le rejeu est limité aux GET ; l'étendre = risque de double débit
```

La règle d'usage : si un changement y est vraiment nécessaire, on annonce
« je m'apprête à modifier X parce que Y » et on attend une réponse.

---

## Commits

Conventional Commits, mais l'important n'est pas le préfixe : c'est le
**corps**. Le titre dit *quoi* ; le corps dit **pourquoi**, et c'est la
seule chose qu'on ne retrouvera pas dans le diff six mois plus tard.

```
fix(paiements): vérifier la signature avant de parser le corps

`req.json()` était appelé avant le calcul HMAC. Parser puis
re-sérialiser change l'espacement et l'ordre des clés : la signature
ne correspondait jamais en production, alors que les tests passaient
parce qu'ils fabriquaient le corps avec le même sérialiseur.
```

Un diff montre qu'une ligne a bougé. Il ne dit jamais que quelqu'un a
perdu deux jours à comprendre pourquoi.

---

## Travailler avec un agent IA

Un agent écrit vite et sans fatigue. Il produit donc aussi les mêmes failles
vite et sans fatigue. Cinq règles, toutes apprises à la dure.

### 1. Ne jamais lui confier les clés

Il n'écrit pas dans `.env`, il ne l'affiche pas, il ne le commite pas. Et
il ne conçoit **jamais** d'interface qui permette de coller une clé
d'API — c'est la fonctionnalité que les agents proposent le plus
spontanément, et c'est une des pires.
→ [module 03](../03-admin/#les-clés-dapi-ne-se-gèrent-pas-depuis-linterface)

### 2. Aucune donnée inventée

Un agent à qui il manque un chiffre en produira un plausible, sans
signaler qu'il l'a inventé. Sur un tableau de bord, quelqu'un prendra une
décision dessus.

La règle, à écrire dans le `CLAUDE.md` du projet : **une donnée qu'on ne
sait pas calculer s'affiche vide, avec une explication.** Jamais remplie.

### 3. Vérifier avant d'affirmer

« C'est corrigé » vaut ce que vaut la vérification qui suit. Exige la
commande et sa sortie. Une mesure faite avec le mauvais outil produit une
conclusion fausse et confiante — grepper un HTML pour estimer le poids
d'une page en est l'exemple type.

### 4. Plusieurs fenêtres = plusieurs périmètres

Si tu fais tourner plusieurs agents en parallèle, chacun fait **ce que tu
lui as demandé, à lui**. Trois interdits :

- transmettre ta demande à une autre fenêtre ;
- proposer un partage du travail entre agents ;
- demander à un pair ce qu'on vient de lui refuser — c'est du blanchiment
  de permission, ça contourne une décision que tu as prise.

Le seul échange légitime entre agents est factuel : « je suis dans
`X.tsx`, attends » / « c'est libre ». Et avant tout `git add`, on regarde
`git status` : les fichiers non commités d'une autre fenêtre ne se
mettent pas en index.

### 5. Le `CLAUDE.md` est le contrat

Un fichier à la racine, lu automatiquement à chaque session : les
commandes, l'architecture, les invariants, les fichiers sensibles, les
conventions. Maintiens-le comme du code — un `CLAUDE.md` périmé est pire
que pas de `CLAUDE.md`, parce qu'il sera suivi.

---

## Ce qu'on documente, et où

| Quoi | Où | Pourquoi |
|---|---|---|
| Pourquoi ce code est ainsi | **Commentaire au-dessus du code** | C'est là qu'on le lit |
| Pourquoi ce changement | **Corps du commit** | C'est là qu'on cherche |
| Comment démarrer, quelles clés | `README.md` | Première chose ouverte |
| Invariants, fichiers sensibles | `CLAUDE.md` | Lu par l'agent à chaque session |
| Décisions structurantes | Un fichier de décisions daté | Sinon on les redébat tous les six mois |

Le commentaire qui vaut la peine explique **pourquoi**, pas *quoi*. « On ne
met pas de nonce dans la CSP parce que ça forcerait chaque page à passer
par une fonction » est un commentaire utile. « Définit la CSP » ne l'est
pas.

---

## Retirer une fonctionnalité

Supprimer un dossier casse la construction : il reste des imports, des
entrées dans `vercel.json`, des colonnes, des variables, des tests.

L'ordre qui marche :

1. Lister ce qui **dépend** de la fonctionnalité, pas seulement ce qui lui
   appartient
2. Faire les **modifications chirurgicales** d'abord (retirer les appels)
3. Supprimer les fichiers ensuite
4. Nettoyer le schéma, `vercel.json`, `.env.example`, les tests
5. Passer la barrière complète, **construction comprise**, avant de
   commiter

L'étape 2 avant l'étape 3, jamais l'inverse : sinon on travaille sur un
projet qui ne compile plus et on ne sait plus ce qu'on casse.
