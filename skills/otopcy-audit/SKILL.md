---
name: otopcy-audit
description: Use before shipping to production, or when asked to audit, review or harden the security of an app — including a vibe-coded or AI-generated one, with or without access to the source. Runs 20 controls, ranks findings by real impact, and refuses to mark anything green without evidence. Also covers what to do when a key has been exposed (revoke first, investigate second).
---

# Audit avant mise en ligne — Otopcy SoftStart

Par Giovanny Engamba (giovannyengamba.com) · Otopcy (otopcy.com).

> **Ne jamais marquer un contrôle bon sans l'avoir vérifié.** Un audit qui
> affiche « ✅ » sans preuve donne confiance à quelqu'un qui s'apprête à
> lancer. Ce qui n'a pas pu être contrôlé se note **⚪️ non vérifié**, avec
> ce qu'il faudrait pour trancher.

## Les quatre d'abord

1. Clé d'administration côté client — contourne tout (contrôle 3)
2. Règles d'accès à la base jamais activées (4)
3. Contrôle d'accès en React sans équivalent serveur (6)
4. `.env` commité au premier push (2)

## Les 20 contrôles

Secrets en dur (1) · secrets dans l'historique Git (2) · clé
d'administration côté client (3) · **règles d'accès de la base** (4) ·
**chiffrement** (5) · autorisation serveur par route (6) · test de la clé
publique (7) · injection SQL (8) · **cookies** (9) · **hachage des mots de
passe** (10) · limitation de débit (11) · validation des entrées (12) ·
XSS (13) · routes de débogage (14) · en-têtes et CSP (15) ·
**téléversements** (16) · dépendances (17) · CSRF (18) · **signature des
webhooks sur corps brut** (19) · fuite de données privées (20).

Les cinq en gras (4, 5, 9, 10, 16) **échappent à tout `grep`** : console du
fournisseur, navigateur, ou lecture attentive. Et l'absence de signal ne
prouve rien.

## Gravité — par impact, pas par difficulté

🔴 **Bloquant** : exploitable aujourd'hui sans compétence particulière.
🟠 **Important** : lancement possible, correction dans la semaine.
🟡 **À faire** : durcissement.
⚪️ **Non vérifié**.

Sans objet pour ce projet ⇒ **non applicable**, pas inventé pour remplir.

## Faux positifs à écarter

Clé de **test** · valeur factice dans un `README`/`.env.example` · clé
« service » dans un fichier **serveur** (c'est sa place) · HTML brut
inséré depuis une constante écrite par toi.

## Sans accès au code

Par lots de trois ou quatre demandes, jamais vingt :
**(1)** requêtes listant tables et règles d'accès · **(2)** chercher la clé
« service » et lister les `NEXT_PUBLIC_*` · **(3)** le test de la clé
publique — sans être connecté, lire une table sensible ; des données qui
remontent, c'est un 🔴 **démontré** · **(4)** le test des deux comptes.

## Rendre le rapport

Le risque **en scénario**, pas en jargon : pas « absence de politique
d'accès sur `users` » mais « n'importe qui peut ouvrir sa console et
télécharger la liste de vos utilisateurs avec leurs e-mails ».

Ne dramatise pas : tout en rouge pousse à tout ignorer. **Un verdict
« prêt à lancer » est un résultat valable.**

Verdict → tableau de comptage → failles avec **fichier:ligne + extrait** →
non vérifié → récapitulatif des 20. Sur un petit projet, supprime les
sections vides.

## Corriger

Faille par faille, une vérification après chacune. Ne réécris pas tout
d'un coup — tu ne sauras plus ce qui a corrigé quoi.

**Clé exposée : révoquer AVANT de comprendre.** Une heure d'enquête avec
une clé active, c'est une heure d'accès offerte. Retirer du code ne suffit
pas : révoquer, régénérer, chercher l'usage, puis fermer le chemin par
lequel elle est sortie.
