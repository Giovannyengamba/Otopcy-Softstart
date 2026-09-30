# 02 — Paiements

> Tout ce qui suit vient d'argent réel encaissé, et pour une bonne part
> d'incidents réels. C'est le module le plus dense du kit ; c'est aussi
> celui où une erreur coûte de l'argent plutôt que du temps.

---

## Arbre de décision : quel prestataire

```
Où sont tes acheteurs ?
├── Monde, carte bancaire ─────────────► Stripe (abonnements, one-shot, Checkout ou Elements)
├── Afrique centrale (XAF, CEMAC) ─────► agrégateur local mobile money
│                                         (Notch Pay au Cameroun, Moneroo pour la zone)
├── Afrique de l'Ouest (XOF, UEMOA) ───► Bictorys (SN/CI), PayTech (SN/ML/BJ), Moneroo (couverture large)
└── Hors Afrique sans Stripe ──────────► PayPal

Combien de prestataires en production ?
└── DEUX, pas cinq. Un par zone. Voir ci-dessous.
```

### Deux, et pas plus

La tentation est d'en brancher cinq « pour couvrir tout le monde ». C'est
une erreur d'exploitation, pas de code : **chaque prestataire actif est un
webhook à surveiller, une réconciliation à écrire, un tableau de bord à
consulter, et un mode de panne de plus**. Une commande créée sur un
prestataire dont plus personne ne regarde le webhook reste en attente pour
toujours.

Le modèle qui tient : une énumération **fermée** au niveau de la création
de commande.

```ts
const Prestataire = z.enum(['momo', 'paypal']).default('momo');
```

Et une règle qui se vérifie côté serveur : un couple prestataire/devise
impossible (PayPal en XAF, par exemple) renvoie `CURRENCY_NOT_SUPPORTED`,
il ne se « corrige » pas tout seul.

> **Retirer un prestataire ≠ supprimer son code.** Des paiements peuvent
> encore arriver sur des commandes créées avant la bascule. On le retire de
> l'énumération de création, on **garde** son adaptateur et son webhook.

---

## Les montants : entiers, plus petite unité, toujours

```ts
// ✅ 10,50 € se stocke, se transmet et se compare comme :
const montant = 1050;        // centimes, Int

// ❌ jamais
const montant = 10.50;       // 0.1 + 0.2 !== 0.3
```

Les devises sans décimale (XAF, XOF, JPY) n'ont pas de sous-unité : 1 000
XAF, c'est `1000`, pas `100000`. Un tableau de correspondance, pas une
supposition :

```ts
const DECIMALES: Record<string, 0 | 2> = { XAF: 0, XOF: 0, JPY: 0, EUR: 2, USD: 2 };
```

### La règle la plus importante du module

Si le navigateur calcule un montant et que le serveur le revérifie, **la
fonction de calcul doit être pure et partagée**, et tout ce qu'elle consomme
doit être une **constante du code** — jamais un taux de change appelé en
direct.

```ts
// lib/payments/montant.ts — importé par le client ET par le serveur
export function versUniteMineure(base: number, devise: Devise): number { … }
```

Pourquoi c'est vital : si le serveur lit un taux en direct au moment de
vérifier, et que le navigateur a lu le même taux deux secondes plus tôt, un
rafraîchissement du taux entre les deux fait **diverger les deux calculs**
et la commande est rejetée. L'acheteur ne comprend rien, et toi non plus.

Le taux vivant sert à **afficher**, jamais à **facturer**.

### Afficher une devise, en débiter une autre

Une distinction qui a l'air d'un détail et qui structure tout le domaine :

| | |
|---|---|
| **Devise débitée** | Ce que le prestataire encaisse réellement. Ensemble **fermé et petit** : `XAF \| XOF \| EUR \| USD`. |
| **Devise affichée** | Ce que le visiteur lit. Ensemble **ouvert** : naira, roupie, rouble, livre… déduit de son pays. |

Le visiteur nigérian lit « ≈ ₦8 400 » et est débité de 5,20 $. Les deux
chiffres sont montrés ensemble, et **le montant affiché se calcule à partir
du montant débité**, jamais en parallèle — sinon les deux dérivent et
l'acheteur voit deux prix qui ne collent pas.

Fais-en deux **types distincts**, pas un `string`. Le jour où tu sépares les
deux notions, le compilateur te montre chaque endroit du code qui les
confondait. Sur le produit d'origine, il y en avait vingt-six.

→ [`code/currency.ts`](code/currency.ts) — implémentation de référence,
générique, avec le découpage complet.

### Majorer les conversions

Vendre 30 000 (monnaie locale) à l'étranger ne rapporte pas 30 000 : le
prestataire prend sa commission, et le taux interbancaire n'est pas le taux
auquel tu seras payé. Une **majoration constante** sur toute conversion
couvre les deux.

```ts
export const MAJORATION = 1.1;   // +10 %, décidé une fois, écrit ici
```

Deux pièges qui ont été rencontrés :

- La majoration doit s'appliquer **aussi aux lignes du reçu**, pas seulement
  au total. Sinon les lignes somment 10 % en dessous du total et un
  « ajustement » fantôme apparaît sur la facture.
- Le taux figé dans le code **dérive**. Vérifie-le au calendrier, pas au
  hasard. La majoration absorbe la dérive entre deux relevés, elle ne la
  supprime pas.

### Un garde-fou gratuit sur les taux

Certaines devises ont une parité **fixée par traité** — le franc CFA vaut
exactement 655,957 pour un euro. Si l'API de taux te renvoie autre chose,
c'est que la réponse est corrompue ou que tu lis la mauvaise base : rejette
tout le paquet plutôt que d'afficher des prix faux.

→ [`code/taux-change.ts`](code/taux-change.ts)

---

## Webhooks : les quatre invariants

### 1. Corps brut avant tout parsage

```ts
// ✅
const brut = await req.arrayBuffer();
const signatureOk = verifierHmac(brut, req.headers.get('x-signature'));
if (!signatureOk) return new Response('bad signature', { status: 401 });
const evenement = JSON.parse(new TextDecoder().decode(brut));

// ❌ — et le pire, c'est que ça « marche » en test
const evenement = await req.json();
const signatureOk = verifierHmac(JSON.stringify(evenement), …);
```

`JSON.parse` puis `JSON.stringify` change l'espacement, l'ordre des clés et
l'encodage des nombres. La signature ne correspond plus. En test avec ton
propre émetteur, tout passe ; avec le vrai prestataire, tout échoue.

### 2. Idempotence par contrainte de base

Un prestataire **rejouera** ses webhooks : sur timeout, sur 500, ou parce
que c'est sa politique. Ne compte pas sur un `if (déjàTraité)` : deux appels
simultanés passent tous les deux le test avant que l'un écrive.

```prisma
model WebhookLog {
  externalId String
  eventType  String
  @@unique([externalId, eventType])   // c'est la base qui arbitre
}
```

Insère dans une transaction `Serializable`. Le doublon échoue sur la
contrainte, tu attrapes l'erreur et tu réponds 200 — l'événement était déjà
traité, tout va bien.

### 3. Les effets de bord passent par la boîte d'envoi

```ts
// ❌ l'argent est encaissé, puis le processus meurt. Le client n'a rien reçu.
await tx.order.update({ … });
await tx.$commit();
await envoyerEmail(…);

// ✅ l'e-mail est une ligne de la MÊME transaction
await tx.order.update({ … });
await enqueueOutbox(tx, { type: 'order.paid', payload: { … } });
```

Une tâche planifiée vide la boîte toutes les minutes, avec des tentatives
espacées. Soit la commande **et** l'e-mail existent, soit ni l'un ni
l'autre. → [`code/outbox/`](code/outbox/)

### 4. Le webhook peut ne jamais arriver

C'est arrivé en production : paiement marqué « complété » chez le
prestataire, commande restée en attente chez nous, aucun webhook reçu,
aucune trace d'erreur. Rien dans le code n'était fautif.

**Tout paiement a besoin d'un filet** : une tâche planifiée qui liste les
commandes encore en attente au-delà de quelques minutes et va demander leur
état au prestataire.

```
Toutes les minutes :
  commandes PENDING créées il y a > 3 min
    → interroger le prestataire
      → payée   : appliquer le même traitement que le webhook (idempotent, donc sûr)
      → échouée : marquer échouée
      → inconnue: laisser, réessayer
```

Le traitement étant idempotent, le webhook qui arrive en retard ne fait rien
de plus. C'est exactement pour ça que l'idempotence n'est pas négociable.

---

## Retraits et soldes : la double dépense

Deux requêtes simultanées du même utilisateur, chacune vérifie le solde,
chacune le trouve suffisant, chacune écrit. Le solde passe en négatif.

Vérifier puis écrire hors transaction **est** le bug. La parade :

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  // les deux requêtes du même utilisateur passent ici l'une APRÈS l'autre
  const solde = await calculerSolde(tx, userId);
  if (solde < montant) throw new Erreur('INSUFFICIENT_BALANCE');
  await tx.withdrawal.create({ data: { userId, montant, statut: 'PENDING' } });
}, { isolationLevel: 'Serializable' });
```

Le verrou est pris **sur l'utilisateur**, pas sur la table : deux
utilisateurs différents ne se bloquent pas. Et la réservation `PENDING`
compte dans le solde, sinon le verrou ne sert à rien.

→ [`code/lock.ts`](code/lock.ts)

---

## Prestataires enfichables

Une interface, un adaptateur par prestataire, un disjoncteur devant.

```ts
export interface PaymentProvider {
  readonly name: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
  verifyWebhook(brut: ArrayBuffer, entetes: Headers): WebhookEvent | null;
}
```

Le **disjoncteur** ([`code/circuit-breaker.ts`](code/circuit-breaker.ts)) coupe
les appels après N échecs consécutifs et laisse passer un essai après un
délai. Sans lui, un prestataire en panne fait expirer chaque requête de
paiement pendant trente secondes, et ton application tombe avec lui.

> ⚠️ Un disjoncteur en mémoire est **par instance**. Sur plusieurs machines,
> chacune a le sien et découvre la panne séparément. Acceptable au début,
> à remplacer par une version Redis quand ça compte — et à écrire dans le
> fichier, pour que ce soit une limite connue et pas une surprise.

---

## Abonnements

Un abonnement récurrent exige, presque partout, une entité juridique et un
contrat avec le prestataire. Tant que ce n'est pas le cas :

- **une adhésion est une commande unique**, et le droit se déduit de la
  commande payée (date + durée) ;
- « résilier » arrête les **rappels de renouvellement**, pas un prélèvement
  — il n'y en a pas ;
- une tâche planifiée quotidienne prévient à J-30 / J-14 / J-7 / J-1.

C'est moins élégant qu'un vrai abonnement, et ça se met en place en une
journée au lieu d'un mois. Câbler le vrai récurrent quand il y a une
société, pas avant.

---

## Pièges vécus

| Symptôme | Cause | Où |
|---|---|---|
| Signature de webhook toujours invalide en production, jamais en test | `req.json()` appelé avant la vérification | [invariant 1](#1-corps-brut-avant-tout-parsage) |
| Commande payée chez le prestataire, en attente chez nous | Webhook jamais reçu, pas de réconciliation | [invariant 4](#4-le-webhook-peut-ne-jamais-arriver) |
| Solde négatif après deux clics rapides | Vérification hors transaction | [Retraits](#retraits-et-soldes--la-double-dépense) |
| Commande rejetée : « montant incohérent » | Taux de change lu en direct des deux côtés | [Montants](#la-règle-la-plus-importante-du-module) |
| Ligne « ajustement » fantôme sur la facture | Majoration appliquée au total, pas aux lignes | [Majorer](#majorer-les-conversions) |
| L'application tombe quand le prestataire tombe | Pas de disjoncteur | [Prestataires](#prestataires-enfichables) |
| Client débité, aucun e-mail reçu | Effet de bord après le commit | [invariant 3](#3-les-effets-de-bord-passent-par-la-boîte-denvoi) |
| Doublon de commande | `POST` rejoué par le client HTTP | [Module 01](../01-securite/#le-client-http-du-navigateur) |
| Prix qui change entre l'affichage et le paiement | Devise affichée calculée en parallèle du débit | [Devises](#afficher-une-devise-en-débiter-une-autre) |

---

## Le code de ce module

> Ces fichiers se **copient**, ils ne s'installent pas. Les imports pointent vers ton projet et sont à recâbler — voir [Utiliser les dossiers `code/`](../UTILISER-LE-CODE.md).

| Fichier | Ce que c'est |
|---|---|
| [`code/handler.ts`](code/handler.ts) | Fabrique de webhook : corps brut + HMAC + transaction Serializable + idempotence |
| [`code/outbox/`](code/outbox/) | Boîte d'envoi transactionnelle, avec réclamation atomique et backoff |
| [`code/circuit-breaker.ts`](code/circuit-breaker.ts) | Disjoncteur par prestataire |
| [`code/lock.ts`](code/lock.ts) | Verrou consultatif par utilisateur |
| [`code/currency.ts`](code/currency.ts) | Devise affichée ≠ devise débitée, unités mineures, majoration |
| [`code/devises.ts`](code/devises.ts) | Correspondance pays → monnaie, symboles, décimales |
| [`code/taux-change.ts`](code/taux-change.ts) | Taux du jour, mis en cache, avec contrôle de cohérence |

## Check-list avant d'encaisser le premier euro

- [ ] Tous les montants sont des `Int` en plus petite unité
- [ ] La fonction de calcul du montant est pure, partagée client/serveur, sans taux vivant
- [ ] La signature du webhook est vérifiée sur le corps brut
- [ ] `@@unique([externalId, eventType])` existe et la transaction est `Serializable`
- [ ] Aucun effet de bord hors transaction — tout passe par la boîte d'envoi
- [ ] Une tâche de réconciliation interroge le prestataire pour les commandes en attente
- [ ] Les retraits passent par le verrou consultatif
- [ ] Les clés « charge » et « payout » ne sont pas confondues (ce sont deux clés distinctes)
- [ ] Les clés de test et de production sont séparées, et impossibles à confondre
- [ ] Un disjoncteur entoure chaque appel sortant
