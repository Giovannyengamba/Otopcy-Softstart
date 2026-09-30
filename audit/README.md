# Audit avant mise en ligne

> Vingt contrôles. Le principe directeur tient en une phrase :
> **ne jamais marquer un contrôle bon sans l'avoir vérifié.**
> Un audit qui affiche « ✅ » sans preuve est pire que pas d'audit — il
> donne confiance à quelqu'un qui s'apprête à lancer.

Ce qui n'a pas pu être vérifié se note **⚪️ non vérifié**, avec ce qu'il
faudrait pour trancher. C'est un résultat honnête.

---

## Les quatre à traiter avant tout

Sur un projet écrit vite, ces quatre-là expliquent à eux seuls la majorité
des bases vidées :

1. Clé d'administration utilisée côté client → contrôle **3**
2. Règles d'accès à la base jamais activées → contrôle **4**
3. Contrôle d'accès fait en React sans équivalent serveur → contrôle **6**
4. `.env` commité au premier push → contrôle **2**

---

## Gravité

| | |
|---|---|
| 🔴 **Bloquant** | Ne pas mettre en ligne. Exploitable aujourd'hui, sans compétence particulière. |
| 🟠 **Important** | Le lancement peut se faire, la correction suit dans la semaine. |
| 🟡 **À faire** | Durcissement. Réduit la surface sans faille exploitable aujourd'hui. |
| ⚪️ **Non vérifié** | N'a pas pu être contrôlé. Dire ce qu'il faudrait. |

Un contrôle sans objet (pas de téléversement → le 16) se note **non
applicable**. On ne l'invente pas pour remplir le tableau.

---

## Les 20 contrôles

| # | Contrôle | Comment vérifier |
|---|---|---|
| 1 | Aucun secret en dur dans le code | `grep -rEn "(sk_live\|api[_-]?key\|secret)\s*[:=]\s*['\"][A-Za-z0-9_-]{16,}" src/` |
| 2 | Aucun secret dans l'historique Git | `git log --all -p -- '*.env*' \| head -50` — s'il y en a eu, **révoquer** |
| 3 | Aucune clé d'administration côté client | Chercher la clé « service » ; sa place est dans `/api`, `/server`, une fonction |
| 4 | Règles d'accès de la base actives | Les lister et les **lire**. « Activé » sans règle = tout ouvert |
| 5 | Chiffrement au repos et en transit | `sslmode=require` ; chiffrement du disque chez l'hébergeur |
| 6 | Autorisation côté serveur sur chaque route privée | Lire les routes une par une. Un composant ne protège rien |
| 7 | Test de la clé publique | Sans session, appeler l'API en lecture sur une table sensible. Si des données remontent : 🔴 démontré |
| 8 | Pas d'injection SQL | Chercher les requêtes brutes concaténées |
| 9 | Cookies `httpOnly` + `Secure` + `SameSite` | Onglet Application du navigateur |
| 10 | Mots de passe hachés (bcrypt/argon2) | Lire le code d'inscription |
| 11 | Limitation de débit sur les routes sensibles | Connexion, inscription, mot de passe oublié, commande |
| 12 | Validation des entrées côté serveur | Un schéma sur chaque corps de requête |
| 13 | Pas de XSS | Chercher les insertions de HTML brut ; du contenu utilisateur ⇒ 🔴 |
| 14 | Pas de routes de débogage exposées | Chercher `/debug`, `/test`, `/_internal` |
| 15 | En-têtes de sécurité et CSP | `curl -I` en production → [module 01](../modules/01-securite/) |
| 16 | Téléversements validés | Taille, **octets magiques**, liste blanche, nom regénéré |
| 17 | Dépendances sans vulnérabilité connue | `pnpm audit --prod` |
| 18 | CSRF sur toute mutation | Lire le premier bloc de chaque route d'écriture |
| 19 | Webhooks à signature vérifiée sur le corps brut | 🔴 sinon : n'importe qui déclare une commande payée |
| 20 | Pas de fuite de données privées | Liens nominatifs, URL de téléchargement de produits payants, e-mails dans les réponses publiques |

### Les cinq qui échappent à tout `grep`

Les contrôles **4, 5, 9, 10 et 16** ne se voient pas dans le code : ils se
vérifient dans la console du fournisseur, dans le navigateur, ou en lisant
attentivement. Traite-les systématiquement à la main. Et souviens-toi que
l'absence de signal ne prouve rien — un `grep` ne voit pas ce qui n'est pas
dans le code.

### Faux positifs à écarter sans les compter

- une clé de **test** (`sk_test_`, `pk_test_`) ;
- une valeur factice dans un `README` ou un `.env.example` ;
- une clé « service » dans un fichier **serveur** — c'est sa place ;
- du HTML brut inséré à partir d'une **constante écrite par toi**.

---

## Sans accès au code

Quatre lots de vérifications à faire faire, trois ou quatre demandes à la
fois — jamais une liste de vingt, sinon la personne abandonne en route.

1. **La base** — faire exécuter les requêtes qui listent les tables et
   leurs règles d'accès.
2. **Les clés** — faire chercher la clé « service » dans tout le projet, et
   lister les variables `NEXT_PUBLIC_*` / `VITE_*`.
3. **Le test de la clé publique** — le plus parlant, et la personne le fait
   elle-même : sans être connectée, tenter de lire une table sensible. Des
   données qui remontent, c'est un 🔴 démontré, pas une supposition.
4. **Le test des deux comptes** — se connecter avec le premier, tenter
   d'ouvrir une ressource du second en changeant l'identifiant dans l'URL.

---

## Rendre le rapport

Explique le risque **en scénario**, pas en jargon. Pas « absence de
politique d'accès sur la table `users` » mais « n'importe qui peut ouvrir
la console de son navigateur et télécharger la liste complète de vos
utilisateurs avec leurs e-mails ».

Et ne dramatise pas ce qui ne l'est pas : tout signaler en rouge pousse à
tout ignorer. **Un verdict « prêt à lancer » est un résultat valable.**

```markdown
# Audit — <projet>

**Verdict : PRÊT À LANCER / À CORRIGER AVANT LANCEMENT**
<une ou deux phrases : ce qui bloque, ou ce qui est sain>

| 🔴 | 🟠 | 🟡 | ⚪️ |
|----|----|----|----|
| 0  | 2  | 5  | 3  |

## 🔴 À corriger avant la mise en ligne
### 1. <titre> — contrôle n°<x>
**Où :** `chemin/fichier.ts:42`
**Le problème :** <ce qu'un attaquant peut faire, concrètement>
**La correction :** <code ou étapes>

## 🟠 Dans la semaine
## 🟡 Durcissement
## ⚪️ Non vérifié — et ce qu'il faudrait pour trancher
## Les 20 contrôles — tableau récapitulatif
```

Sur un petit projet, garde le verdict, les failles avec leur preuve et le
tableau ; supprime les sections vides.

---

## Après l'audit

Corrige **faille par faille**, avec une vérification après chacune. Ne
réécris pas tout d'un coup : tu ne sauras plus ce qui a corrigé quoi.

Et le point qu'on néglige presque toujours : **retirer une clé du code ne
suffit pas — il faut la révoquer et la régénérer.** Une clé publiée un jour
est compromise pour toujours.
