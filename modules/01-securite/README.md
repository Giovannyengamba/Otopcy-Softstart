# 01 — Sécurité

> Les failles qui vident une base ne sont presque jamais sophistiquées.
> Ce sont les cinq mêmes, et elles sont toutes dans ce module.

Avant de lire : si le projet existe déjà, passe
[l'audit en 20 contrôles](../../audit/) d'abord. On ne durcit pas ce qu'on
n'a pas mesuré, et on perd un temps fou à blinder une porte pendant que la
fenêtre est ouverte.

---

## Les quatre à traiter en premier

Sur un projet écrit vite — a fortiori avec un agent IA — ces quatre-là
expliquent à elles seules la majorité des incidents.

1. **Une clé d'administration côté client.** La clé « service » d'un
   Supabase, d'un Firebase ou d'un Stripe, présente dans un fichier
   téléchargé par le navigateur. Elle contourne toutes les règles d'accès.
   N'importe qui ouvre les outils de développement et lit la base.
2. **Les règles d'accès jamais activées.** La base est restée en mode
   prototype, où tout est lisible par la clé publique. Elle l'est encore le
   jour du lancement.
3. **Un contrôle d'accès fait en React.** `if (user.isAdmin) return <Admin/>`
   cache un bouton. Il ne protège pas la route derrière.
4. **Un `.env` commité au premier push.** Et qui reste dans l'historique
   Git après suppression. Toutes ses clés sont à révoquer.

---

## Authentification

Le schéma qui tient, sans être une usine :

| Jeton | Durée | Portée | Pourquoi |
|---|---|---|---|
| Accès | 15 min | tous chemins | Court, donc un vol a une fenêtre étroite |
| Rafraîchissement | 7 j | **`/api/auth` uniquement** | Restreindre le chemin réduit la surface : il ne part pas avec chaque requête |
| CSRF | 7 j | tous chemins | Double soumission (cookie + en-tête) |

Cookies : `httpOnly` + `Secure` en production + `SameSite=Lax`. Préfixés
par un nom d'application (`COOKIE_PREFIX`), pour que deux projets sur deux
sous-domaines ne se marchent pas dessus.

### L'inscription ne doit rien révéler

Un formulaire d'inscription qui répond « cet e-mail existe déjà » est un
**oracle d'énumération** : on lui donne une liste d'adresses et il dit
lesquelles ont un compte chez toi. Pour un service sensible, c'est déjà une
fuite en soi.

La forme correcte :

- réponse **identique** que l'e-mail existe ou non (même code, même corps,
  et idéalement même temps de réponse) ;
- **aucun cookie émis à l'inscription** — les cookies sont émis par la
  vérification d'e-mail, une fois le code saisi ;
- l'e-mail envoyé diffère selon le cas (« voici ton code » ou « quelqu'un a
  tenté de créer un compte avec ton adresse »), mais ça, l'attaquant ne le
  voit pas.

Même logique pour « mot de passe oublié » : toujours « si un compte existe,
un e-mail est parti ».

### Le temps de réponse est un canal de fuite

Si un e-mail inconnu répond en 5 ms et un e-mail connu en 300 ms (le temps
de comparer le haché bcrypt), l'énumération reste possible malgré des
réponses identiques. La parade : comparer le mot de passe contre un haché
factice quand l'utilisateur n'existe pas, pour payer le même coût.

---

## CSRF : double soumission

Le serveur pose un cookie `<prefix>-csrf` à la connexion. Le client le lit
et le renvoie dans l'en-tête `x-csrf-token` à chaque écriture. Un site
tiers peut faire envoyer le cookie par le navigateur, mais **ne peut pas le
lire** pour fabriquer l'en-tête.

```ts
const csrf = verifyCsrf(req);
if (csrf) return csrf;        // en tête de CHAQUE POST/PUT/PATCH/DELETE
```

### L'exception, et comment la documenter

Sur une boutique, un acheteur peut payer avant d'avoir un compte. Il n'a
donc pas de cookie CSRF, et l'exiger rendrait l'achat impossible.

La décision prise ici : **CSRF vérifié seulement si une session existe.**
Ce n'est pas un relâchement arbitraire — le CSRF ne défend qu'une chose,
l'autorité ambiante d'une session. Une requête sans session n'en a aucune à
détourner. La création de commande anonyme est en revanche limitée en débit
(10/h par e-mail, repli sur l'IP) et exige un e-mail.

Ce qui compte ici n'est pas la décision, c'est sa forme : **une exception à
une règle de sécurité s'écrit dans le code, avec sa justification et sa
date.** Sans ça, quelqu'un la généralisera « par cohérence » dans un an.

---

## Limitation de débit

Deux étages, parce qu'ils arrêtent deux choses différentes :

- **par IP**, global — arrête le bruit et les balayages automatiques ;
- **par e-mail**, sur les routes sensibles — arrête l'attaque ciblée sur un
  compte précis, qui passe l'étage IP en changeant d'adresse.

| Route | Limite |
|---|---|
| Connexion | 10 / 15 min |
| Inscription | 5 / h |
| Mot de passe oublié | 3 / h |
| Commande anonyme | 10 / h |

[`code/rate-limit-store.ts`](code/rate-limit-store.ts) utilise Redis s'il est
là, un compteur mémoire sinon. Sache ce que vaut le repli : en mémoire, le
compteur est **par instance**, donc inefficace sur plusieurs machines. En
développement c'est suffisant ; en production, Redis n'est pas optionnel.

[`code/middleware/rate-limit-by-email.ts`](code/middleware/rate-limit-by-email.ts)
porte l'étage par e-mail.

---

## Rôles et autorisation

Deux échelles, indépendantes :

```
Application :  USER  <  ADMIN  <  SUPERADMIN
Organisation : MEMBER < ADMIN  <  OWNER
```

Le motif dans une route, invariable :

```ts
const auth = await requireAdmin(req);
if (auth instanceof NextResponse) return auth;   // 401/403 déjà formés
// ici, auth.user est garanti ADMIN ou plus
```

Trois règles qui viennent d'incidents réels :

- **Seul un SUPERADMIN change un rôle.** Sinon un administrateur se promeut.
- **On refuse de rétrograder le dernier SUPERADMIN.** Sinon plus personne
  ne peut administrer, et il faut passer par la base.
- **Un non-membre d'organisation reçoit 404**, jamais 403.

### Capacités, plutôt que rôles, dans l'interface

L'interface ne doit pas demander « est-il ADMIN ? » mais « a-t-il le droit
de supprimer un devis ? ». Une route `/api/admin/me` renvoie la liste des
capacités du compte, et l'interface s'y adosse :

```ts
const CAPACITES_PAR_ROLE = {
  ADMIN:      ['articles:read', 'articles:write', 'orders:read', 'devis:update'],
  SUPERADMIN: [...CAPACITES_PAR_ROLE.ADMIN, 'users:role', 'devis:delete'],
};
```

Le jour où tu ajoutes un rôle intermédiaire — « éditeur », qui touche au
contenu mais pas à l'argent — tu changes une table, pas trente composants.

> Et ça reste de l'affichage. Le serveur revérifie, toujours. Les capacités
> décident de ce qu'on **montre**, jamais de ce qu'on **autorise**.

---

## Connexion Google (et tout autre OAuth)

Un bouton « Se connecter avec Google » a l'air d'un raccourci sans risque.
Il porte en réalité **le vecteur de prise de compte le plus direct de tout
ce module**.

### L'invariant critique

```ts
// dans la route de rappel, AVANT toute recherche de compte
if (claims.email_verified !== true) {
  log.warn('oauth.rappel: email_verified=false refusé', { sub: claims.sub });
  return redirect('/auth/error?code=GOOGLE_EMAIL_NOT_VERIFIED');
}
```

**Le scénario si tu l'oublies.** Ton application relie un compte Google à un
compte local **par l'e-mail** — c'est ce que tout le monde fait, et c'est
correct. Un attaquant crée alors un compte Google (ou Workspace sur un
domaine qu'il contrôle) portant l'adresse de sa victime, sans la vérifier.
Il clique sur « Se connecter avec Google ». Ton code trouve un compte local
avec cette adresse, considère la preuve de possession comme faite, et lui
ouvre la session.

Il n'a jamais eu accès à la boîte mail de la victime. Il n'a pas eu besoin
de son mot de passe. Et rien, dans tes journaux, n'aura l'air anormal.

Cette seule ligne ferme la faille. C'est la première chose à vérifier dans
une revue d'OAuth, avant même de regarder le reste.

### Le reste, qui compte aussi

| Point | Pourquoi |
|---|---|
| **PKCE** (`code_verifier`), pas seulement `state` | Le `state` défend contre le CSRF ; PKCE défend contre l'interception du code |
| Cookies `state` + `verifier` **à durée courte** (5 min) et **portés sur `/api/auth/oauth`** | Ils ne partent pas avec chaque requête du site |
| Valider le `state` reçu contre le cookie, **et le supprimer ensuite** | Un `state` rejouable est un `state` inutile |
| Lier par e-mail **seulement si vérifié** | Voir ci-dessus |
| Un compte OAuth par fournisseur, table séparée | Permet plusieurs fournisseurs sans dupliquer l'utilisateur |
| Erreurs vers une page dédiée avec un **code**, pas un message | `\/auth/error?code=…` — traduisible, et ne fuit rien |

### Et si la clé manque

Comme partout : le bouton disparaît, l'application démarre. Sans
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`, la
route renvoie 404 et l'interface ne propose pas le bouton.

> ⚠️ L'URI de redirection doit être **déclarée à l'identique** dans la
> console Google, protocole et barre oblique finale compris. C'est la
> première cause de `redirect_uri_mismatch`, et le message ne dit pas ce
> qui diffère.

→ [`code/oauth/google.ts`](code/oauth/google.ts)

---

## En-têtes et politique de contenu

Dans `next.config.ts`, pas dans le middleware — pour que le réseau de
diffusion puisse les servir sans réveiller de fonction.
→ [`code/security-headers.ts`](code/security-headers.ts)

### Liste d'origines, pas nonce

Une CSP « propre » utilise un nonce par requête. Le prix caché : générer un
nonce oblige à faire passer **chaque page** par une fonction, donc à
renoncer à la mise en cache sur tout le site. Sur un public éloigné du
serveur, ça coûte des centaines de millisecondes par page.

Et le gain est plus faible qu'il n'y paraît, parce que `'unsafe-inline'`
reste souvent nécessaire de toute façon (script d'amorçage du framework,
balises publicitaires qui s'installent en ligne).

Donc : **liste d'origines**, statique, servie depuis le cache. Ce qu'elle
arrête vraiment, et qui n'était arrêté par rien avant :

| Directive | Ce qu'elle empêche concrètement |
|---|---|
| `object-src 'none'` | Les greffons, vecteur d'injection classique |
| `base-uri 'self'` | Une balise `<base>` injectée qui détournerait toutes les URL relatives |
| `form-action 'self'` | Un formulaire injecté qui posterait les identifiants ailleurs |
| `frame-ancestors 'none'` | Le clickjacking |
| `script-src <liste>` | Un script venu d'un hôte non prévu |

> **Le piège de Google Tag Manager :** c'est un seul script, mais il en
> **injecte d'autres**. Une campagne publicitaire branchée depuis son
> interface tirera un domaine que rien dans ton dépôt ne mentionne. Si tu
> ne l'as pas listé, il sera bloqué en silence — et tu chercheras pendant
> des semaines pourquoi tes conversions sont à zéro.

### Ce qu'on laisse large, et pourquoi

`connect-src https:` et `img-src https:` restent ouverts. La collecte
d'erreurs et la mesure d'audience parlent à des sous-domaines qui changent
par région. Une CSP qui casse la remontée d'erreurs le jour d'un incident
coûte plus cher qu'elle ne protège.

C'est un arbitrage, pas un oubli — et il doit être écrit comme tel dans le
fichier, sinon quelqu'un le « corrigera ».

---

## Téléversements

Trois contrôles, dans cet ordre :

1. **Taille**, avant de lire le fichier.
2. **Octets magiques** — les premiers octets du fichier, comparés au type
   déclaré. `File.type` vient du navigateur : c'est une affirmation de
   l'attaquant, pas une mesure. → [`code/upload/sniff.ts`](code/upload/sniff.ts)
3. **Liste blanche** de types autorisés, jamais une liste noire.

Et deux règles sur le stockage :

- **Jamais dans le dossier public du serveur.** Un stockage tiers avec URL
  signée, ou un dossier hors racine web. Un fichier téléversé servi depuis
  ton domaine est un script potentiellement exécutable sur ton origine.
- **Ne jamais réutiliser le nom du fichier.** Génère un identifiant.
  `../../etc/passwd` est un nom de fichier valide.

---

## Le client HTTP du navigateur

[`code/api-client.ts`](code/api-client.ts) — petit, mais trois propriétés qui
comptent :

1. **Rafraîchissement automatique sur 401**, avec un verrou à un seul vol.
   Sans ce verrou, dix requêtes simultanées qui reçoivent 401 lancent dix
   rafraîchissements concurrents ; neuf échouent, et l'utilisateur est
   déconnecté sans raison.
2. **Le CSRF est attaché automatiquement**, donc personne ne l'oublie.
3. **Seuls `GET` et `HEAD` sont rejoués** en cas d'erreur réseau. Rejouer un
   `POST` dont la réponse s'est perdue, c'est une commande en double ou un
   retrait en double. **Ne jamais étendre le rejeu aux verbes qui écrivent.**

Et une convention qui économise beaucoup : le serveur renvoie un **code
d'erreur stable** (`PIN_REQUIRED`, `INSUFFICIENT_BALANCE`), l'interface
teste le code, jamais le message. Le message peut être traduit ou reformulé
sans rien casser.

---

## Le code de ce module

> Ces fichiers se **copient**, ils ne s'installent pas. Les imports pointent vers ton projet et sont à recâbler — voir [Utiliser les dossiers `code/`](../UTILISER-LE-CODE.md).

| Fichier | Ce que c'est |
|---|---|
| [`code/middleware/index.ts`](code/middleware/index.ts) | `requireAuth` / `requireAdmin` / `optionalAuth` |
| [`code/middleware/require-admin.ts`](code/middleware/require-admin.ts) | Précédence des rôles d'application |
| [`code/middleware/require-org-role.ts`](code/middleware/require-org-role.ts) | Rôles d'organisation, 404 aux non-membres |
| [`code/middleware/rate-limit-by-email.ts`](code/middleware/rate-limit-by-email.ts) | Limitation par identité |
| [`code/rate-limit-store.ts`](code/rate-limit-store.ts) | Redis si présent, mémoire sinon |
| [`code/crypto.ts`](code/crypto.ts) | Jetons, comparaison à temps constant |
| [`code/upload/sniff.ts`](code/upload/sniff.ts) | Validation par octets magiques |
| [`code/security-headers.ts`](code/security-headers.ts) | CSP et en-têtes, prêts à coller |
| [`code/oauth/google.ts`](code/oauth/google.ts) | OAuth Google : PKCE, état, décodage du jeton d'identité |
| [`code/api-client.ts`](code/api-client.ts) | Le client navigateur |
