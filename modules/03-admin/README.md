# 03 — Administration

> Le back-office est la partie qu'on bâcle parce que « ce n'est que pour
> nous ». C'est pourtant la seule surface où une seule personne peut, en
> un clic, changer les prix, lire les données de tous les clients ou
> supprimer une commande payée.

---

## Ce qu'un back-office doit faire avant d'être joli

1. **Dire qui a fait quoi, quand.** Sans ça, le jour où un prix est faux,
   personne ne peut répondre à « qui l'a changé ? ».
2. **Refuser ce qui n'est pas permis, côté serveur.** Masquer un bouton
   n'est pas un contrôle d'accès.
3. **Montrer les vraies données, ou rien.** Un tableau de bord qui affiche
   un chiffre approximatif est pire qu'un tableau vide : on prend des
   décisions dessus.

Le reste — la mise en page, les graphiques, le confort — vient après, et
n'est pas dans ce kit.

---

## Le journal d'audit n'est pas optionnel

Toute mutation d'administration écrit une ligne. Sans exception, y compris
celles qui « ne changent rien d'important ».

```ts
await logAdminAction(prisma, {
  actorId: auth.user.id,
  action: 'product.price_change',
  targetType: 'Product',
  targetId: produit.id,
  metadata: { avant: 30000, apres: 35000 },   // l'avant ET l'après
});
```

→ [`code/audit.ts`](code/audit.ts)

Trois détails qui font la différence entre un journal utile et un journal
décoratif :

- **`avant` et `après`.** Savoir qu'un prix a changé sans savoir de quoi
  vers quoi ne sert à rien.
- **Un nom d'action stable**, en `objet.verbe`. On filtrera dessus.
- **Non modifiable.** Aucune route ne supprime ni ne modifie une ligne
  d'audit. Si la rétention pose problème, on archive — on n'édite pas.

Et le garde-fou qui va avec : une revue de code où l'on vérifie que toute
route sous `/api/admin/` qui écrit appelle `logAdminAction`. Mieux, un test
qui le vérifie automatiquement — c'est exactement le genre de règle que
personne ne tiendra à la main pendant deux ans.

---

## Capacités plutôt que rôles

L'interface ne demande pas « est-il ADMIN ? » mais « a-t-il le droit de
supprimer un devis ? ».

```ts
// une seule table, consommée par /api/admin/me
const CAPACITES: Record<Role, string[]> = {
  USER: [],
  ADMIN: [
    'articles:read', 'articles:write',
    'orders:read',
    'quote-requests:read', 'quote-requests:update',
  ],
  SUPERADMIN: [
    ...CAPACITES.ADMIN,
    'users:role',
    'quote-requests:delete',    // destructif → rôle le plus élevé
    'withdrawals:cancel',
  ],
};
```

Le gain se voit le jour où tu ajoutes un rôle intermédiaire — un
« éditeur » qui touche au contenu mais pas à l'argent. Tu changes une
table, pas trente composants.

**Et ça reste de l'affichage.** Chaque route revérifie. Les capacités
décident de ce qu'on **montre** ; le serveur décide de ce qu'on **peut**.

### Où placer la barre

| Action | Rôle minimum | Pourquoi |
|---|---|---|
| Lire | ADMIN | |
| Créer, modifier | ADMIN | Réversible |
| **Supprimer** | SUPERADMIN | Irréversible |
| Changer un rôle | SUPERADMIN | Sinon un admin se promeut |
| Annuler un retrait | SUPERADMIN | C'est de l'argent |

Et la règle qui évite de se verrouiller dehors : **on refuse de rétrograder
le dernier SUPERADMIN.** Sinon plus personne ne peut administrer, et il faut
passer par la base de données pour s'en sortir.

---

## Amorcer le premier administrateur

Il n'y a pas de bouton « crée-moi un super-administrateur » dans
l'interface : ce serait une porte ouverte. Un script en ligne de commande,
exécuté par quelqu'un qui a déjà accès au serveur :

```bash
pnpm db:make-superadmin quelquun@exemple.com
```

Le script promeut un compte **existant**. Il ne crée pas de compte, et ne
contourne pas la vérification d'e-mail.

---

## Ce qui doit être éditable, et ce qui ne doit pas

La question revient à chaque fois. Le critère :

| Éditable depuis l'admin | Pas éditable |
|---|---|
| Contenu : articles, produits, projets, événements | **Les clés d'API** — jamais, sous aucune forme |
| Prix, disponibilité, textes | La structure des données |
| Statut d'un devis, note interne | Un montant de commande déjà payée |
| Réglages du site (mode maintenance, bascules) | Les lignes du journal d'audit |
| Rôles et statuts de comptes | Le résultat d'un webhook |

### Les clés d'API ne se gèrent pas depuis l'interface

C'est tentant — « un écran pour coller sa clé Stripe ». Trois raisons de ne
jamais le faire :

1. Une clé affichable est une clé lisible par quiconque obtient une session
   d'administration, ou une capture d'écran.
2. Une clé stockée en base est une clé de plus à chiffrer, à faire tourner
   et à sauvegarder — une surface entière pour un confort marginal.
3. Une clé modifiable depuis une interface est une clé qu'un
   hameçonnage peut remplacer par celle de l'attaquant. Les paiements
   partiraient ailleurs, et rien ne semblerait cassé.

Les clés vivent dans les variables d'environnement du fournisseur
d'hébergement. On ne les met jamais, on ne les affiche jamais.
→ [`cles/`](../../cles/)

### Corollaire : un montant déjà payé ne se modifie pas

Si un montant est faux, on crée un remboursement ou un avoir. Modifier la
ligne d'origine détruit la piste comptable, et personne ne pourra
reconstituer ce qui s'est passé.

---

## Rendre les vraies données, ou dire qu'il n'y en a pas

Un tableau de bord d'administration invente très facilement. Un graphique a
besoin de points, alors on met des points.

La règle : **une section sans source de données réelle s'affiche vide, avec
une phrase qui dit pourquoi.**

```tsx
// ✅
<EtatVide
  titre="Aucune donnée d'audience"
  detail="La mesure d'audience n'est pas encore branchée. Voir le module 05."
/>

// ❌ — et personne ne saura jamais que ces chiffres sont faux
<Graphique donnees={[120, 145, 132, 178]} />
```

Le coût d'un chiffre inventé n'est pas l'esthétique : c'est qu'une décision
sera prise dessus.

---

## Le motif d'une route d'administration

```ts
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrf = verifyCsrf(req);
    if (csrf) return csrf;

    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const corps = Schema.safeParse(await req.json());
    if (!corps.success) return erreur(400, 'INVALID_BODY');

    const avant = await prisma.produit.findUnique({ where: { id } });
    if (!avant) return erreur(404, 'NOT_FOUND');

    const apres = await prisma.produit.update({ where: { id }, data: corps.data });

    await logAdminAction(prisma, {
      actorId: auth.user.id,
      action: 'produit.update',
      targetType: 'Produit',
      targetId: id,
      metadata: { avant: avant.prix, apres: apres.prix },
    });

    return NextResponse.json(apres);
  });
}
```

Sept étapes, toujours les mêmes, toujours dans cet ordre. Copie-le.

---

## Pièges vécus

| Symptôme | Cause |
|---|---|
| « Qui a changé ce prix ? » — personne ne sait | Mutation sans `logAdminAction` |
| Un admin s'est promu SUPERADMIN | Changement de rôle non réservé au SUPERADMIN |
| Plus aucun administrateur ne peut se connecter | Dernier SUPERADMIN rétrogradé |
| Un client a lu la fiche d'un autre | Contrôle fait dans le composant, pas dans la route |
| Un chiffre du tableau de bord est faux depuis des mois | Donnée inventée au lieu d'un état vide |
| Les paiements partent sur un autre compte | Clé d'API éditable depuis l'interface |

## Le code de ce module

> Ces fichiers se **copient**, ils ne s'installent pas. Les imports pointent vers ton projet et sont à recâbler — voir [Utiliser les dossiers `code/`](../UTILISER-LE-CODE.md).

| Fichier | Ce que c'est |
|---|---|
| [`code/audit.ts`](code/audit.ts) | `logAdminAction` — le passage obligé de toute écriture |

Les contrôles d'accès sont dans [le module 01](../01-securite/code/middleware/).
