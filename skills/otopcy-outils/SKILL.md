---
name: otopcy-outils
description: Use when choosing or connecting a third-party service — hosting, database, Redis, email, file storage, error tracking, analytics, real-time, video conferencing, payments — or when setting up Google properties (Cloud Console OAuth credentials, Search Console, Merchant Center, Tag Manager, Analytics, Ads), DNS and email authentication. Also use when asked "what should I use for X", when something works locally but not on serverless, or when planning the order in which to open accounts.
---

# Comptes et outils — Otopcy SoftStart

Par Giovanny Engamba (giovannyengamba.com) · Otopcy (otopcy.com).

## La contrainte serverless commande tout

Une fonction démarre pour une requête et s'arrête. Le code ne lève pas
d'erreur — il **ne s'exécute pas**, ou diffère selon l'instance.

| Réflexe | À la place |
|---|---|
| `setInterval` | Cron externe + route signée par `CRON_SECRET` |
| WebSocket / Socket.IO / SSE depuis une route | **Ably** (jetons de capacité, présence, historique) |
| File en mémoire | **QStash**, ou boîte d'envoi en base |
| Cache en mémoire | **Redis** — et par accès HTTP (Upstash), un client TCP classique ne survit pas |

Déclencheurs à repérer : « temps réel », « live », « websocket »,
« notifications push navigateur », « au lieu de sonder », « chat »,
« présence », « collaboration », « tableau de bord live ».

## Pile de référence

Hébergement **Vercel** · base **PostgreSQL géré** (transactions
sérialisables et verrous consultatifs : tout le module paiements en
dépend) · **Upstash Redis** · e-mail **Resend** · fichiers **Cloudinary** ·
erreurs **Sentry** · mesure **PostHog** · temps réel **Ably** · carte
monde **Stripe** · Afrique : agrégateur local (PayPal ne fait ni XAF ni
XOF) · visio **Zoom** (OAuth serveur-à-serveur).

**Aucun n'est obligatoire** : clé absente ⇒ fonctionnalité inerte, jamais
l'application.

## Ordre d'ouverture

**Avant le code** : dépôt, base, hébergement.
**Avant la mise en ligne** : domaine + DNS, e-mail (*la vérification de
domaine prend du temps, lance-la tôt*), Sentry, mesure produit (*installée
avant le lancement, sinon les données du lancement sont perdues*).
**Avant d'encaisser** : prestataire de paiement (*validation marchande :
des jours à des semaines*), Redis.
**Après** : Search Console, Merchant Center, gestionnaire de balises,
Analytics, Ads.

## Google — cinq produits distincts

| Produit | Pour quoi |
|---|---|
| Cloud Console | Identifiants OAuth « Se connecter avec Google » |
| Search Console | Ce que le moteur comprend, plan de site |
| Merchant Center | Onglet Shopping |
| Tag Manager | Poser des balises sans redéployer |
| Analytics / Ads | Mesure et campagnes |

**Piège du profil de navigateur** : une propriété créée avec le mauvais
compte Google est invisible depuis l'autre. Décide une fois quel compte
possède quoi, écris-le, ouvre toujours depuis ce profil. Ajoute les autres
en utilisateurs plutôt que de recréer les propriétés.

### Connexion Google — l'invariant critique

```ts
if (claims.email_verified !== true) return refus('GOOGLE_EMAIL_NOT_VERIFIED');
```

Sans cette ligne : un attaquant crée un compte Google portant l'adresse de
sa victime sans la vérifier, clique « Se connecter avec Google », ton code
relie par e-mail et lui ouvre la session. Il n'a jamais eu accès à la boîte
mail. Rien n'a l'air anormal dans les journaux.

Aussi : **PKCE** en plus du `state` · cookies `state`/`verifier` à 5 min et
portés sur `/api/auth/oauth` · `state` supprimé après usage · erreurs vers
une page avec un **code**, pas un message.

⚠️ URI de redirection **identique** au caractère près entre le code et
Cloud Console — protocole et barre oblique finale compris. Première cause
de `redirect_uri_mismatch`, et le message ne dit pas ce qui diffère.

### Search Console

Vérifie par **DNS** (couvre les sous-domaines, survit aux redéploiements).
« Page explorée, actuellement non indexée » n'est pas une erreur technique.
Et si une organisation plus ancienne occupe déjà ton nom, aucun réglage ne
renverse ça.

### Gestionnaire de balises

Un script qui en **injecte d'autres**. Une campagne branchée depuis son
interface tire un domaine absent de ton dépôt ⇒ bloqué par la CSP **en
silence** ⇒ conversions à zéro sans explication. Liste ses domaines.
Chargement **après consentement** uniquement.

## DNS et e-mail

`A`/`CNAME` · **SPF** · **DKIM** · **DMARC** · `TXT` de vérification.
Un seul domaine canonique, l'autre en 301.
Vérifie un envoi réel vers une vraie boîte avant de considérer que c'est
fait — un domaine non vérifié n'envoie **rien**, sans erreur.

## Visio, si tu vends du direct

Une réunion par événement · **un lien par personne**, jamais partagé · le
droit d'assister se déduit des **commandes payées**, jamais de la table
d'inscription · webhook vérifié sur corps brut · sans clés, repli sur un
lien commun, et on le dit.

## Coût — les trois qui surprennent

Base : facturée aux **connexions**, pas à la taille (d'où le répartiteur).
Images : transformation et bande passante coûtent plus que le stockage.
Appels à un modèle d'IA : la seule ligne qui explose sans prévenir —
plafonne et journalise **avant** d'ouvrir au public.
