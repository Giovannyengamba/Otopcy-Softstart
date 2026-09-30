# 10 — Comptes et outils

> Quels services brancher, dans quel ordre, et les pièges de chacun.
> Les clés elles-mêmes sont dans [`cles/`](../../cles/) ; ici c'est le
> **choix** et l'**ouverture des comptes**.

---

## La contrainte qui commande tout le reste

Le déploiement visé est **serverless** : une fonction démarre pour une
requête et s'arrête après. Trois choses n'y survivent pas, et ce sont
précisément celles qu'on code par réflexe :

| Réflexe | Pourquoi ça casse | À la place |
|---|---|---|
| `setInterval` pour du travail de fond | Aucun processus n'est maintenu en vie | Cron externe → [module 08](../08-taches-planifiees/) |
| WebSocket / Socket.IO / SSE depuis une route | Pas de connexion longue durée | **Ably** (jetons de capacité, présence, historique) |
| File d'attente en mémoire | Perdue au démarrage à froid, non partagée | **QStash**, ou la boîte d'envoi en base → [module 02](../02-paiements/) |
| Cache en mémoire | Par instance, donc incohérent | **Redis** (Upstash) |

Le code ne lève pas d'erreur : il **ne s'exécute pas**, ou se comporte
différemment selon l'instance. C'est ce qui le rend si difficile à
diagnostiquer.

---

## La pile de référence

| Besoin | Recommandé | Pourquoi celui-là |
|---|---|---|
| Hébergement | **Vercel** | Le framework et l'hébergeur sont faits ensemble ; crons, variables et aperçus de branche inclus |
| Base de données | **PostgreSQL** géré (Supabase, Neon) | Relationnel, transactions sérialisables, verrous consultatifs — tout le module 02 en dépend |
| Cache / débit / verrous | **Upstash Redis** | Accès HTTP, donc compatible serverless (un client TCP classique ne l'est pas) |
| E-mail transactionnel | **Resend** | Vérification de domaine simple, API lisible |
| Fichiers et images | **Cloudinary** | Téléversement, transformation et diffusion en un service |
| Erreurs | **Sentry** | La seule façon d'apprendre un bug autrement que par un client |
| Mesure produit | **PostHog** | Hébergement en Europe possible, API de requêtes pour rapatrier les chiffres |
| Temps réel | **Ably** | Voir le tableau ci-dessus |
| Paiement carte monde | **Stripe** | Récurrent, portail client, remboursements |
| Paiement Afrique | agrégateur local | Mobile money ; PayPal ne fait ni XAF ni XOF |
| Visioconférence | **Zoom** (OAuth serveur-à-serveur) | Une réunion par événement, liens **nominatifs** par participant |

**Aucun n'est obligatoire.** Chacun manquant rend sa fonctionnalité inerte,
jamais l'application. → [module 00](../00-architecture/#absent--inerte-jamais-absent--fatal)

---

## Ordre d'ouverture des comptes

Ouvrir les comptes trop tôt coûte du temps ; trop tard coûte des données
perdues. L'ordre qui marche :

**Avant la première ligne de code**
1. Hébergeur du dépôt (GitHub)
2. Base de données
3. Hébergement

**Avant la première mise en ligne**
4. Registraire du domaine, puis DNS
5. E-mail — **la vérification de domaine prend du temps**, lance-la tôt
6. Sentry
7. Mesure produit (installée avant le lancement, sinon les données du
   lancement sont perdues pour toujours)

**Avant d'encaisser**
8. Prestataire de paiement — la validation d'un compte marchand peut
   prendre des jours, voire des semaines
9. Redis (limitation de débit sérieuse)

**Après le lancement**
10. Search Console, puis Merchant Center si tu vends
11. Gestionnaire de balises, Analytics, Ads

---

## La constellation Google

C'est là qu'on se perd, parce que ce sont **cinq produits différents** qui
partagent un compte et se ressemblent.

| Produit | À quoi ça sert | Quand |
|---|---|---|
| **Google Cloud Console** | Créer les identifiants OAuth « Se connecter avec Google » | Quand tu ajoutes la connexion Google |
| **Search Console** | Voir ce que le moteur comprend de ton site, soumettre le plan de site | Dès la mise en ligne |
| **Merchant Center** | Faire apparaître tes produits dans l'onglet Shopping | Si tu vends |
| **Tag Manager** | Poser les balises sans redéployer | Avant la première campagne |
| **Analytics / Ads** | Mesure et campagnes | Avec le gestionnaire de balises |

### Le piège du profil de navigateur

Tu as probablement plusieurs comptes Google. Une propriété Search Console
créée avec le mauvais compte est **invisible** depuis l'autre, et tu
passeras une heure à chercher pourquoi « il n'y a rien ».

Décide **une fois** quel compte possède quoi, écris-le quelque part, et
ouvre toujours ces consoles depuis le même profil de navigateur. Ajoute
les autres comptes en utilisateurs plutôt que de recréer les propriétés.

### Connexion Google

La configuration est dans Cloud Console, mais **l'invariant de sécurité est
dans ton code** — refuser `email_verified !== true`, sinon un attaquant
prend le compte de sa victime sans jamais avoir accédé à sa boîte mail.
→ [module 01](../01-securite/#connexion-google-et-tout-autre-oauth)

Et l'URI de redirection doit être déclarée **à l'identique**, protocole et
barre oblique finale compris. Première cause de `redirect_uri_mismatch`, et
le message ne dit pas ce qui diffère.

### Search Console

Vérifie le domaine par **enregistrement DNS** plutôt que par fichier ou
balise : ça couvre tous les sous-domaines et ça survit à un redéploiement.

Soumets le plan de site, puis **attends**. L'indexation prend des jours à
des semaines. Et sache lire ce que Search Console te dit vraiment : « page
explorée, actuellement non indexée » n'est pas une erreur technique, c'est
un jugement de valeur sur le contenu.

> Ce que Search Console ne résoudra jamais : si une organisation plus
> ancienne et plus citée occupe déjà ton nom, aucun réglage ne renverse ça.
> → [module 06](../06-seo/#ce-que-le-technique-règle-et-ce-quil-ne-réglera-jamais)

### Gestionnaire de balises

Un seul script, mais **il en injecte d'autres**. Une campagne branchée
depuis son interface tirera un domaine que rien dans ton dépôt ne
mentionne — non listé dans la CSP, il est bloqué **en silence**, et tes
conversions restent à zéro sans explication.
→ [module 01](../01-securite/#en-têtes-et-politique-de-contenu)

Et ces balises ne se chargent qu'**après consentement**.
→ [module 05](../05-statistiques/)

---

## Visioconférence, si tu vends du direct

Le schéma qui tient, avec Zoom en OAuth serveur-à-serveur :

- **une réunion par événement**, créée à la publication, avec un cron de
  rattrapage pour celles qui n'en ont pas ;
- **un lien par personne** (inscription Zoom), jamais un lien partagé — un
  lien commun circule, et tu ne sais plus qui a assisté ;
- **le droit d'assister se déduit des commandes payées**, jamais de la
  table d'inscription. L'inscription est une conséquence, pas une preuve ;
- le webhook vérifie sa signature sur le corps brut, comme tout webhook
  → [module 02](../02-paiements/#webhooks--les-quatre-invariants) ;
- sans les clés : repli sur un lien partagé, et on le dit.

---

## Le domaine et le DNS

| Enregistrement | Pour quoi | Sans lui |
|---|---|---|
| `A` / `CNAME` | Pointer vers l'hébergeur | Le site n'existe pas |
| **SPF** | Qui peut envoyer pour ton domaine | Indésirables |
| **DKIM** | Signature des messages | Indésirables |
| **DMARC** | Que faire si SPF/DKIM échoue | Usurpation possible |
| `TXT` de vérification | Search Console, e-mail | Propriété non prouvée |

Choisis **un** domaine canonique — avec ou sans `www` — et redirige l'autre
en 301. Deux domaines qui répondent, c'est du contenu dupliqué et des
cookies qui ne suivent pas.

---

## Coût réel

Presque tous ces services ont une offre gratuite qui suffit au démarrage.
Les trois qui surprennent :

- **La base de données** — la facture vient du nombre de connexions, pas de
  la taille. D'où le répartiteur de connexions. → [`cles/`](../../cles/)
- **Les images** — la transformation et la bande passante coûtent plus que
  le stockage. Sers en WebP, en tailles bornées, et diffère le chargement.
- **Les appels à un modèle d'IA** — la seule ligne qui peut exploser sans
  prévenir. Plafonne, et journalise le nombre d'appels **avant** de
  l'ouvrir au public.

---

## Check-list d'ouverture

- [ ] Un compte Google décidé comme propriétaire, écrit quelque part
- [ ] Domaine vérifié par DNS chez l'hébergeur d'e-mail (SPF + DKIM + DMARC)
- [ ] Un envoi réel reçu dans une vraie boîte, hors indésirables
- [ ] URI de redirection OAuth identiques entre le code et Cloud Console
- [ ] Clés de test et de production séparées, et impossibles à confondre
- [ ] `CRON_SECRET` posé dès la première tâche planifiée
- [ ] Sentry reçoit une erreur de test
- [ ] Mesure produit installée **avant** le lancement
- [ ] Un seul domaine canonique, l'autre en 301
- [ ] Plafond posé sur tout service facturé à l'appel
