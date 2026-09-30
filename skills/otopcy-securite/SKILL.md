---
name: otopcy-securite
description: Use when writing or reviewing anything touching authentication, sessions, cookies, CSRF, rate limiting, roles and permissions, security headers or CSP, file uploads, or the browser HTTP client. Also use when asked to "secure", "harden" or review an endpoint. Covers enumeration-resistant signup, double-submit CSRF and its one documented exception, two-tier rate limiting, role precedence, origin-list CSP (and why not a nonce), magic-byte upload validation.
---

# Sécurité — Otopcy SoftStart

Par Giovanny Engamba (giovannyengamba.com) · Otopcy (otopcy.com).

## Les quatre failles à chercher en premier

1. Clé d'administration (« service ») côté client — contourne tout.
2. Règles d'accès à la base jamais activées (resté en mode prototype).
3. Contrôle d'accès fait en React sans équivalent serveur.
4. `.env` commité au premier push — et resté dans l'historique.

## Sessions

| Jeton | Durée | Portée |
|---|---|---|
| Accès | 15 min | tous chemins |
| Rafraîchissement | 7 j | **`/api/auth` uniquement** |
| CSRF | 7 j | tous chemins |

Cookies `httpOnly` + `Secure` (prod) + `SameSite=Lax`, préfixés par projet.

**L'inscription ne révèle rien** : réponse identique que l'e-mail existe ou
non, **aucun cookie émis à l'inscription** (ils viennent de la vérification
d'e-mail). Compare contre un haché factice quand l'utilisateur n'existe pas
— sinon le **temps de réponse** trahit l'existence du compte.

## CSRF

Double soumission : cookie `<prefix>-csrf` + en-tête `x-csrf-token`. Un
tiers peut faire envoyer le cookie, pas le lire.

```ts
const csrf = verifyCsrf(req);
if (csrf) return csrf;   // en tête de CHAQUE POST/PUT/PATCH/DELETE
```

Exception possible — un acheteur sans compte n'a pas de cookie CSRF :
vérifier **seulement si une session existe**, parce que le CSRF ne défend
que l'autorité ambiante d'une session. Compenser par une limitation de
débit. **Toute exception s'écrit dans le code, avec sa raison et sa date.**

## Limitation de débit

Deux étages : **par IP** (bruit, balayages) et **par e-mail** (attaque
ciblée, qui passe l'étage IP en changeant d'adresse).
Connexion 10/15 min · inscription 5/h · mot de passe oublié 3/h.
Repli mémoire = **par instance** : insuffisant en production.

## Rôles

`USER < ADMIN < SUPERADMIN` · `MEMBER < ADMIN < OWNER`.

```ts
const auth = await requireAdmin(req);
if (auth instanceof NextResponse) return auth;
```

Seul un SUPERADMIN change un rôle · on refuse de rétrograder le **dernier**
SUPERADMIN · un non-membre d'organisation reçoit **404, pas 403** (un 403
confirme l'existence).

L'interface s'adosse à des **capacités** (`devis:delete`), pas à des rôles.
Ça reste de l'affichage : le serveur revérifie toujours.

## En-têtes et CSP

Dans `next.config.ts`, pas le middleware — pour que le cache les serve sans
réveiller de fonction.

**Liste d'origines, pas nonce** : un nonce force chaque page par une
fonction et tue la mise en cache du site entier, alors que `'unsafe-inline'`
reste souvent nécessaire de toute façon.

Ce qui compte vraiment : `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, `frame-ancestors 'none'`, `script-src <liste>`.

⚠️ **Gestionnaire de balises** : c'est un script qui en **injecte d'autres**.
Une campagne publicitaire tirera un domaine absent de ton dépôt. Non listé
⇒ bloqué en silence ⇒ conversions à zéro sans explication.

## Téléversements

Taille → **octets magiques** (pas `File.type`, qui vient du client) → liste
blanche. Jamais dans le dossier public. **Nom regénéré** :
`../../etc/passwd` est un nom de fichier valide.

## Client HTTP du navigateur

Rafraîchissement sur 401 avec **verrou à un seul vol** (sinon dix 401
simultanés lancent dix rafraîchissements, neuf échouent, l'utilisateur est
déconnecté) · CSRF attaché automatiquement · **seuls `GET`/`HEAD` sont
rejoués** — rejouer un `POST` = commande ou retrait en double.

Codes d'erreur **stables** (`PIN_REQUIRED`) ; l'interface teste le code,
jamais le message.
