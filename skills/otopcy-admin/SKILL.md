---
name: otopcy-admin
description: Use when building or reviewing a back-office / admin portal — CRUD routes under /api/admin, role and capability gating, audit logging, deciding what should be editable, bootstrapping the first superadmin, or filling an admin dashboard with data. Covers logAdminAction as a mandatory path, capability-based UI, why API keys must never be editable from an interface, and never inventing a number to fill a chart.
---

# Administration — Otopcy SoftStart

Par Giovanny Engamba (giovannyengamba.com) · Otopcy (otopcy.com).

Le back-office est la surface où une seule personne peut, en un clic,
changer les prix, lire les données de tous les clients ou supprimer une
commande payée.

## Trois exigences avant toute esthétique

1. Dire **qui a fait quoi, quand**.
2. Refuser côté **serveur** — masquer un bouton n'est pas un contrôle.
3. Montrer les **vraies** données, ou rien.

## Journal d'audit — sans exception

```ts
await logAdminAction(prisma, {
  actorId: auth.user.id,
  action: 'product.price_change',      // objet.verbe, stable
  targetType: 'Product', targetId: id,
  metadata: { avant: 30000, apres: 35000 },   // l'avant ET l'après
});
```

Non modifiable : aucune route ne supprime ni n'édite une ligne d'audit.
Écris le test qui vérifie que toute route `/api/admin/*` qui écrit l'appelle.

## Capacités plutôt que rôles

L'interface demande « a-t-il le droit de supprimer un devis ? », pas
« est-il ADMIN ? ». Une table de capacités par rôle, servie par
`/api/admin/me`. Le jour où tu ajoutes un « éditeur », tu changes une
table, pas trente composants. **Le serveur revérifie toujours.**

| Action | Rôle minimum |
|---|---|
| Lire, créer, modifier | ADMIN |
| **Supprimer** | SUPERADMIN (irréversible) |
| Changer un rôle | SUPERADMIN (sinon un admin se promeut) |
| Annuler un retrait | SUPERADMIN (c'est de l'argent) |

On refuse de rétrograder le **dernier** SUPERADMIN.

Premier administrateur : un script en ligne de commande qui promeut un
compte **existant**. Jamais un bouton dans l'interface.

## Éditable, ou pas

| Éditable | Jamais |
|---|---|
| Contenu, prix, textes, statuts | **Les clés d'API** |
| Réglages du site | Un montant de commande déjà payée |
| Rôles et statuts de comptes | Les lignes d'audit, le résultat d'un webhook |

### Les clés d'API ne se gèrent pas depuis l'interface

C'est la fonctionnalité que les agents proposent le plus spontanément, et
une des pires. Trois raisons : une clé affichable est lisible par
quiconque obtient une session ou une capture ; une clé en base est une
surface de chiffrement et de rotation de plus ; **une clé modifiable par
hameçonnage détourne les paiements sans que rien ne semble cassé.**

Les clés vivent dans les variables d'environnement de l'hébergeur.

Corollaire : un montant déjà payé ne se modifie pas — on crée un
remboursement ou un avoir, sinon la piste comptable est détruite.

## Ne jamais inventer un chiffre

```tsx
<EtatVide titre="Aucune donnée d'audience"
          detail="La mesure n'est pas encore branchée." />   // ✅
<Graphique donnees={[120, 145, 132, 178]} />                 // ❌
```

Le coût n'est pas esthétique : une décision sera prise dessus.

## Le motif, sept étapes toujours dans cet ordre

`runtime = 'nodejs'` → contexte de requête → `verifyCsrf` → `requireAdmin`
→ valider le corps → lire l'**avant** → écrire → `logAdminAction` avec
avant/après → répondre.
