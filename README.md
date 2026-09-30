# Otopcy SoftStart

**Le socle technique d'un SaaS qui encaisse de l'argent réel, distillé depuis
un produit en production.**

Par **[Giovanny Engamba](https://www.giovannyengamba.com)** — UX/UI Designer,
Développeur · hébergé par **[Otopcy](https://www.otopcy.com)**

Ce dépôt n'est pas un tutoriel. C'est ce qu'il reste quand on a construit,
mis en ligne, cassé et réparé une application complète : les règles qui
tiennent, les pièges qui coûtent cher, et le code qui a survécu au contact
de vrais utilisateurs et de vrais paiements.

Il ne contient **aucun design**. Délibérément : l'apparence d'un produit est
ce qui doit changer à chaque projet, l'ossature est ce qui ne doit pas.

---

## Ce que c'est, et ce que ce n'est pas

|  | |
|---|---|
| ✅ | Un **playbook en onze modules** : architecture, sécurité, paiements, administration, performance, statistiques, SEO, e-mails, tâches planifiées, processus, comptes et outils. |
| ✅ | Du **code réellement réutilisable**, dans `modules/*/code/` — à copier dans ton projet, pas à installer. |
| ✅ | Une **liste exhaustive des clés** à connecter, ce que chacune débloque, et ce qui se passe quand elle manque. |
| ✅ | Un **audit de sécurité en 20 contrôles**, avec la méthode de vérification de chacun. |
| ❌ | Ce n'est **pas une application** qu'on clone et qu'on lance. Rien à faire tourner ici. |
| ❌ | Ce n'est **pas un design system**. Aucun composant visuel, aucune palette, aucune police. |
| ❌ | Ce n'est **pas une dépendance npm**. Rien à mettre à jour, donc rien qui casse en silence. |

## Pour qui

Quelqu'un qui démarre un produit web qui devra, tôt ou tard, encaisser de
l'argent, gérer des comptes, et ne pas fuiter les données de ses clients.
La pile de référence est **Next.js (App Router) + Prisma + PostgreSQL +
Redis**, déployée sur Vercel. Les principes valent au-delà ; le code, non.

---

## Récupérer le kit

Trois façons, selon ce que tu comptes en faire.

### 1. Télécharger l'archive — le plus simple

**[⬇ Télécharger Otopcy SoftStart 1.0.0 (.zip)](https://github.com/Giovannyengamba/otopcy-softstart/releases/latest/download/otopcy-softstart-1.0.0.zip)**

Tu double-cliques, tu obtiens un dossier, tu lis. Aucun outil à installer.
C'est la bonne option si tu veux juste piocher du code et des règles.

> Depuis la page du dépôt, le même fichier est aussi sous le bouton vert
> **Code → Download ZIP** — mais il donne l'état du moment, pas la version
> figée. Pour une version stable, préfère le lien ci-dessus.

### 2. Cloner — si tu comptes suivre les mises à jour

```bash
git clone https://github.com/Giovannyengamba/otopcy-softstart.git
cd otopcy-softstart
```

Un `git pull` plus tard te rapporte les corrections et les nouveaux
modules. C'est la bonne option si tu t'en sers régulièrement.

### 3. Prendre seulement les compétences IA

Si tu ne veux que la partie qui fait travailler ton agent :

```bash
git clone --depth 1 https://github.com/Giovannyengamba/otopcy-softstart.git /tmp/softstart
cp -r /tmp/softstart/skills/* mon-projet/.claude/skills/
rm -rf /tmp/softstart
```

### Et ensuite ?

| Tu as | Lis |
|---|---|
| Un projet neuf | [`DEMARRER.md`](DEMARRER.md) — les 90 premières minutes |
| Un projet existant | [`audit/`](audit/) — les 20 contrôles avant de durcir quoi que ce soit |
| Un besoin précis | Le module concerné, dans le tableau plus bas |

> **Rien à installer, rien à faire tourner.** Ce dépôt n'est pas une
> application : c'est de la documentation et des fichiers à copier. La seule
> commande qui existe ici, `npm run verifier`, sert à contrôler le dépôt
> lui-même — tu n'en as pas besoin pour t'en servir.

---

## Comment s'en servir

**Projet neuf** → lis [`DEMARRER.md`](DEMARRER.md). Les quatre-vingt-dix
premières minutes, dans l'ordre, sans rien inventer.

**Projet existant** → passe [`audit/`](audit/) d'abord. On ne durcit pas ce
qu'on n'a pas mesuré.

**Besoin ponctuel** → va directement au module. Ils sont indépendants : on
peut prendre les paiements sans prendre le SEO.

---

## Les modules

| # | Module | Ce qu'il règle |
|---|--------|----------------|
| 00 | [Architecture](modules/00-architecture/) | La forme du projet, la frontière client/serveur, l'observabilité, la règle « absent = inerte » |
| 01 | [Sécurité](modules/01-securite/) | Authentification, CSRF, limitation de débit, en-têtes, CSP, téléversements, rôles |
| 02 | [Paiements](modules/02-paiements/) | Prestataires enfichables, webhooks, idempotence, boîte d'envoi, devises, retraits sans double dépense |
| 03 | [Administration](modules/03-admin/) | Back-office, capacités par rôle, journal d'audit, ce qui doit être éditable |
| 04 | [Performance](modules/04-performance/) | Mise en cache, ISR, étiquettes d'invalidation, géographie du serveur |
| 05 | [Statistiques](modules/05-statistiques/) | Mesure d'audience, consentement RGPD, balises publicitaires |
| 06 | [SEO](modules/06-seo/) | Métadonnées, plan de site, données structurées, ce que le SEO technique ne peut pas résoudre |
| 07 | [E-mails](modules/07-emails/) | Envoi transactionnel, file d'attente, notifications sans doublon |
| 08 | [Tâches planifiées](modules/08-taches-planifiees/) | Pourquoi `setInterval` ne marche pas, crons signés, verrous entre instances |
| 09 | [Processus](modules/09-processus/) | La barrière avant commit, les conventions, et comment travailler avec un agent IA sans se faire mal |
| 10 | [Comptes et outils](modules/10-comptes-et-outils/) | Quels services brancher, dans quel ordre ; la constellation Google, le DNS, les contraintes du serverless |

Transversal : [`cles/`](cles/) — toutes les variables d'environnement.
[`audit/`](audit/) — les 20 contrôles avant mise en ligne.

---

## Les dix règles non négociables

Si tu ne retiens qu'une page de ce dépôt, que ce soit celle-ci. Chacune
vient d'un incident réel ou d'une faille évitée de justesse.

1. **Les montants sont des entiers, en plus petite unité de la devise.**
   Jamais un flottant. Un centime perdu en arrondi devient un écart
   comptable qu'on ne retrouve plus. → [02](modules/02-paiements/)

2. **Un webhook se vérifie sur le corps brut, avant tout `JSON.parse`.**
   Parser d'abord et re-sérialiser ensuite change un octet et invalide la
   signature — silencieusement. → [02](modules/02-paiements/)

3. **Les effets de bord d'une transaction passent par une boîte d'envoi**,
   jamais par un `then()` après le commit. Sinon l'argent est encaissé et
   le client ne reçoit rien. → [02](modules/02-paiements/)

4. **Une clé secrète n'existe jamais côté client.** Pas dans une variable
   `NEXT_PUBLIC_*`, pas dans un composant client, pas dans un dépôt. Et une
   clé exposée une fois est compromise pour toujours : on la **révoque**, on
   ne se contente pas de la retirer du code. → [cles/](cles/)

5. **Un contrôle d'accès fait dans le navigateur n'est pas un contrôle
   d'accès.** Toute route qui rend des données privées les revérifie côté
   serveur. → [01](modules/01-securite/)

6. **Toute écriture d'administration est journalisée**, avec qui, quoi,
   quand. Une mutation non auditée est une mutation qu'on ne pourra pas
   expliquer le jour de l'incident. → [03](modules/03-admin/)

7. **Un prestataire dont la clé manque doit être inerte, pas fatal.**
   L'application démarre, la fonctionnalité se désactive, un avertissement
   part dans les journaux. → [00](modules/00-architecture/)

8. **Le webhook peut ne jamais arriver.** Tout paiement a besoin d'un
   filet : une tâche planifiée qui va demander au prestataire l'état des
   commandes encore en attente. → [02](modules/02-paiements/) et
   [08](modules/08-taches-planifiees/)

9. **Lire un en-tête de requête dans le gabarit racine rend toute
   l'application dynamique.** Le site entier perd sa mise en cache, et
   personne ne comprend pourquoi il est lent. → [04](modules/04-performance/)

10. **Aucune donnée affichée n'est inventée.** Un chiffre qu'on ne sait pas
    calculer se montre vide, avec une explication — jamais rempli d'une
    valeur plausible. → [09](modules/09-processus/)

---

## Origine et limites

Extrait d'une application Next.js en production : boutique, espace
d'apprentissage, adhésions, billetterie, portail d'administration,
paiements mobile money et PayPal, environ 1 900 tests unitaires.

Ce qu'il faut savoir avant de s'appuyer dessus :

- **Les versions bougent.** Le code vise Next.js 16 / Prisma 5 / React 19.
  Les principes tiendront plus longtemps que les signatures de fonctions.
- **Rien n'est une dépendance.** Tu copies, donc tu possèdes. Personne ne
  te poussera une mise à jour qui casse, et personne ne corrigera un bug à
  ta place.
- **Aucun secret ici.** Les fichiers `.env.example` ne contiennent que des
  valeurs factices. Si tu trouves quoi que ce soit qui ressemble à une vraie
  clé dans ce dépôt, c'est un bug : signale-le.

---

## Utilisable par un agent IA

Le dépôt se double d'un **paquet de compétences Claude Code**. Copie
[`skills/`](skills/) dans le `.claude/skills/` de ton projet et l'agent
appliquera ces règles de lui-même, au lieu de réinventer un `POST` sans
CSRF à chaque route.

```bash
cp -r otopcy-softstart/skills/* mon-projet/.claude/skills/
```

→ [`skills/README.md`](skills/README.md)

---

## Contribuer, publier

| | |
|---|---|
| [`PUBLIER.md`](PUBLIER.md) | Mettre ce dépôt en ligne : connexion GitHub, identité des commits, portée `workflow` |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Ce qui a sa place ici, et ce qui n'en a pas |
| [`SECURITY.md`](SECURITY.md) | Signaler une règle dangereuse, ou un secret oublié |
| [`CHANGELOG.md`](CHANGELOG.md) | Ce qui a changé |

```bash
npm install && npm run verifier   # liens · secrets · syntaxe
```

---

## Auteur et hébergement

Écrit par **Giovanny Engamba**, UX/UI Designer et développeur —
[www.giovannyengamba.com](https://www.giovannyengamba.com) ·
[hello@giovannyengamba.com](mailto:hello@giovannyengamba.com)

Hébergé et maintenu par **Otopcy** —
[www.otopcy.com](https://www.otopcy.com) ·
[hello@otopcy.com](mailto:hello@otopcy.com)

Réseaux et mention à reprendre : [`AUTEURS.md`](AUTEURS.md).

## Licence

MIT — voir [`LICENSE`](LICENSE). Prends, modifie, vends. Aucune garantie :
relis [l'audit](audit/) avant de mettre en ligne quoi que ce soit qui touche
à l'argent ou aux données des gens.
