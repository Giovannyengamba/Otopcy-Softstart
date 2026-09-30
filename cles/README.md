# Les clés

> Toutes les variables d'environnement, ce que chacune débloque, et ce que
> fait l'application quand elle manque.

**Aucune vraie clé ne figure dans ce dépôt.** `.env.example` ne contient
que des valeurs factices. Si tu crois en voir une, c'est un bug : écris à
[hello@giovannyengamba.com](mailto:hello@giovannyengamba.com).

---

## Les quatre règles

**1. `NEXT_PUBLIC_` veut dire « publié ».** Tout ce qui porte ce préfixe
part dans le navigateur et est lisible par n'importe qui. Pas « difficile
à trouver » : **lisible**, en deux clics dans les outils de développement.

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx       # ✅ conçue pour être publique
NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_xxx  # ❌ catastrophe
```

Écris le test qui refuse `NEXT_PUBLIC_*` contenant `SECRET`, `KEY` ou
`TOKEN` (sauf liste blanche explicite). Dix lignes.

**2. Une clé exposée est compromise pour toujours.** La retirer du code ne
suffit pas — elle reste dans l'historique Git, dans les caches, dans les
journaux de quelqu'un. **Révoque et régénère.** Toujours, même si « le dépôt
était privé ».

**3. Absent = inerte.** Une clé manquante désactive sa fonctionnalité et
journalise un avertissement. Elle n'empêche jamais le démarrage.
→ [module 00](../modules/00-architecture/#absent--inerte-jamais-absent--fatal)

**4. Test et production ne se mélangent pas.** Les identifiants créés avec
une clé de test n'existent pas en production. Un préfixe visible
(`sk_test_` / `sk_live_`) évite des heures de `resource_missing`.

---

## Bloc 1 — sans quoi rien ne démarre

| Variable | Ce que c'est | Où l'obtenir |
|---|---|---|
| `DATABASE_URL` | Chaîne PostgreSQL | Ton hébergeur de base |
| `JWT_SECRET` | Signature des jetons de session | `openssl rand -base64 48` |
| `COOKIE_PREFIX` | Espace de noms des cookies | Toi. Un mot par projet. |
| `NEXT_PUBLIC_SITE_URL` | URL canonique publique | Toi |

> `DATABASE_URL` pointe souvent vers un répartiteur de connexions. Vérifie
> les paramètres attendus par ton client (`pgbouncer=true`,
> `connection_limit=…`) : sans eux, tu verras des délais d'attente sous
> charge, et seulement sous charge.

## Bloc 2 — infrastructure

| Variable | Débloque | Sans elle |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Limitation de débit distribuée, verrous, cache | Compteur **en mémoire, par instance** — insuffisant en production multi-machines |
| `CRON_SECRET` | Authentifie les tâches planifiées | **Les crons sont ouverts à tous.** Obligatoire dès qu'il y en a un |
| `SENTRY_DSN` | Remontée d'erreurs | Silence. Tu apprends les bugs par tes clients |

## Bloc 3 — prestataires

| Variable | Débloque | Sans elle |
|---|---|---|
| `RESEND_API_KEY` | Envoi d'e-mails | Les messages restent en file |
| `EMAIL_FROM` | Expéditeur | — |
| `CLOUDINARY_*` | Téléversements | `503 STORAGE_NOT_CONFIGURED` |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Connexion Google | Bouton masqué |
| `<PRESTATAIRE>_API_KEY` | **Encaissement** | Paiements refusés proprement |
| `<PRESTATAIRE>_WEBHOOK_SECRET` | Vérification des webhooks | **À ne jamais oublier** : sans elle, n'importe qui peut déclarer une commande payée |

> ⚠️ Beaucoup de prestataires ont **deux clés distinctes** : une pour
> encaisser, une pour verser. Les confondre envoie de l'argent au mauvais
> endroit. Nomme-les sans ambiguïté (`_CHARGE_KEY`, `_PAYOUT_KEY`).

## Bloc 4 — mesure et publicité

| Variable | Débloque | Sans elle |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` + `_HOST` | Mesure produit (publique par nature) | Aucune mesure |
| `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` | Rapatrier les chiffres dans ton admin | Section « audience » vide |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics | Balise non chargée |
| `NEXT_PUBLIC_FB_PIXEL_ID` | Meta Pixel | Balise non chargée |

Les deux dernières ne se chargent qu'**après consentement**.
→ [module 05](../modules/05-statistiques/)

---

## Où les mettre

| Environnement | Où | Attention |
|---|---|---|
| Local | `.env.local` | Dans `.gitignore` **avant** le premier commit |
| Production | Variables du fournisseur d'hébergement | Jamais dans le dépôt |
| Intégration continue | Secrets du fournisseur | Les secrets ne sont pas exposés aux PR de forks |

### Les trois erreurs qui reviennent

**Le `.env` local qui pointe la base de production.** Ça arrive
naturellement — on copie les valeurs pour déboguer, et on oublie. Les
lectures sont sans danger ; une écriture de test détruit des données
réelles, et un `prisma migrate reset` détruit tout. Si tu dois le faire,
écris-le en tête du fichier et n'écris jamais sans réfléchir deux fois.

**Une variable ajoutée au code mais pas à `.env.example`.** Ça marche chez
toi, ça casse chez le suivant. → écris le test.

**Une clé dans un message, un ticket ou une capture.** Elle est publiée.
Révoque.

## En cas d'exposition

1. **Révoquer** chez le prestataire, tout de suite. Avant de comprendre.
2. **Régénérer** et redéployer.
3. **Chercher l'usage** : appels inattendus, montants, volumes.
4. **Nettoyer** le dépôt — en sachant que réécrire l'historique ne protège
   de rien : la clé a été lisible, elle est compromise.
5. **Comprendre comment elle est sortie**, et fermer ce chemin-là.

L'étape 1 avant toutes les autres. Une heure d'enquête avec une clé encore
active, c'est une heure d'accès offerte.
