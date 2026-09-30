---
name: otopcy-paiements
description: Use when touching money — adding a payment provider (Stripe, PayPal, Notch Pay, Moneroo, Bictorys, PayTech, mobile money), handling a payment webhook, computing or converting an amount, displaying a price in a visitor's currency, implementing withdrawals or balances, or debugging an order stuck in PENDING. Covers raw-body HMAC ordering, idempotency by DB constraint, the transactional outbox, reconciliation when a webhook never arrives, advisory-lock withdrawals, minor units, and display-currency vs debit-currency.
---

# Paiements — Otopcy SoftStart

Par Giovanny Engamba (giovannyengamba.com) · Otopcy (otopcy.com).
Tout ce qui suit vient d'argent réel encaissé, et pour une bonne part
d'incidents réels.

## Montants

```ts
const montant = 1050;   // ✅ centimes, Int
const montant = 10.50;  // ❌ 0.1 + 0.2 !== 0.3
```

Devises sans sous-unité (XAF, XOF, JPY) : 1 000 XAF = `1000`, pas `100000`.
Table explicite, jamais une supposition.

**La règle la plus importante :** si le navigateur calcule un montant et
que le serveur le revérifie, la fonction est **pure, partagée, et ne
consomme que des constantes du code**. Jamais un taux de change lu en
direct — un rafraîchissement entre les deux calculs ferait rejeter des
commandes valides. Le taux vivant sert à **afficher**, jamais à facturer.

### Devise affichée ≠ devise débitée

Deux **types distincts**, pas un `string` :

- **débitée** — ce que le prestataire encaisse. Ensemble fermé (`XAF | XOF | EUR | USD`).
- **affichée** — ce que le visiteur lit. Ensemble ouvert, déduit du pays.

Le montant affiché se calcule **à partir du** montant débité, jamais en
parallèle, sinon les deux dérivent. Une majoration constante (p. ex. +10 %)
couvre commission et dérive du taux — et s'applique **aussi aux lignes du
reçu**, sinon un « ajustement » fantôme apparaît.

## Webhooks — quatre invariants

**1. Corps brut avant tout parsage.**
```ts
const brut = await req.arrayBuffer();
if (!verifierHmac(brut, req.headers.get('x-signature'))) return new Response(null, { status: 401 });
const evt = JSON.parse(new TextDecoder().decode(brut));
```
`req.json()` puis `JSON.stringify` change l'espacement et l'ordre des clés.
Ça passe en test, ça échoue toujours en production.

**2. Idempotence par contrainte de base**, pas par `if (déjàTraité)` :
`@@unique([externalId, eventType])` + transaction `Serializable`. Le
doublon échoue sur la contrainte, on attrape, on répond 200.

**3. Effets de bord par la boîte d'envoi** — `enqueueOutbox(tx, evt)` dans
la **même** transaction. Sinon : argent encaissé, client sans e-mail.

**4. Le webhook peut ne jamais arriver.** C'est arrivé en production, sans
la moindre erreur. Une tâche planifiée liste les commandes PENDING de plus
de quelques minutes et interroge le prestataire. Le traitement étant
idempotent, un webhook tardif ne fait rien de plus.

## Retraits — double dépense

Vérifier puis écrire hors transaction **est** le bug.

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  const solde = await calculerSolde(tx, userId);      // inclut les PENDING
  if (solde < montant) throw new Erreur('INSUFFICIENT_BALANCE');
  await tx.withdrawal.create({ data: { userId, montant, statut: 'PENDING' } });
}, { isolationLevel: 'Serializable' });
```

Verrou **par utilisateur**, pas sur la table.

## Prestataires

Deux en production, pas cinq : chacun est un webhook à surveiller et un
mode de panne de plus. Énumération **fermée** à la création de commande ;
couple prestataire/devise impossible → `CURRENCY_NOT_SUPPORTED`.

Retirer un prestataire ≠ supprimer son code : des paiements peuvent encore
arriver sur des commandes antérieures.

Un **disjoncteur** devant chaque appel sortant. En mémoire = par instance ;
écris-le comme limite connue.

## Abonnements

Sans entité juridique : une adhésion est une **commande unique**, le droit
se déduit de la commande payée. « Résilier » arrête les rappels, pas un
prélèvement — il n'y en a pas.

## Diagnostic

| Symptôme | Cause |
|---|---|
| Signature invalide en prod, jamais en test | `req.json()` avant vérification |
| Payé chez le prestataire, PENDING chez nous | Pas de réconciliation |
| Solde négatif après deux clics | Vérification hors transaction |
| « Montant incohérent » au paiement | Taux lu en direct des deux côtés |
| « Ajustement » fantôme sur la facture | Majoration au total, pas aux lignes |
| Doublon de commande | `POST` rejoué par le client HTTP |
| L'app tombe avec le prestataire | Pas de disjoncteur |

## Avant le premier euro

Montants entiers · calcul pur partagé · HMAC sur corps brut · contrainte
d'unicité + Serializable · aucun effet de bord hors transaction ·
réconciliation en place · verrou sur les retraits · clés charge/payout
distinctes · test/prod séparés · disjoncteur.
