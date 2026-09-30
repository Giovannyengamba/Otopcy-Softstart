---
name: otopcy-softstart
description: Use when starting a new web project, or when making a structural decision on an existing one — folder layout, where server code lives, which provider to add, what to check before shipping. This is the router for the Otopcy SoftStart playbook; it carries the ten non-negotiable rules and points to the specialised skills (otopcy-architecture, otopcy-securite, otopcy-paiements, otopcy-performance, otopcy-admin, otopcy-outils, otopcy-audit). Reference stack is Next.js App Router + Prisma + PostgreSQL + Redis on Vercel, but the rules are stack-agnostic.
---

# Otopcy SoftStart — socle

Par Giovanny Engamba (giovannyengamba.com) · Otopcy (otopcy.com) · MIT.

Extrait d'une application en production : boutique, adhésions, billetterie,
portail d'administration, paiements mobile money et PayPal.

## Les dix règles non négociables

1. **Montants = entiers en plus petite unité.** Jamais de flottant.
2. **Webhook : vérifier la signature sur le corps brut, avant `JSON.parse`.**
3. **Effets de bord d'une transaction → boîte d'envoi**, jamais un `then()`
   après le commit.
4. **Aucune clé secrète côté client.** Une clé exposée se **révoque**, ne
   se retire pas.
5. **Un contrôle d'accès dans le navigateur n'en est pas un.**
6. **Toute écriture d'administration est journalisée** (qui, quoi, avant,
   après).
7. **Prestataire sans clé = inerte, pas fatal.**
8. **Le webhook peut ne jamais arriver** → tâche de réconciliation
   obligatoire.
9. **`headers()` dans le gabarit racine rend TOUTE l'application
   dynamique.**
10. **Aucune donnée affichée n'est inventée.** Pas de chiffre → état vide
    avec explication.

## Aiguillage

| La demande porte sur | Compétence |
|---|---|
| Structure, client/serveur, journaux, prestataires optionnels | `otopcy-architecture` |
| Connexion, CSRF, rôles, CSP, téléversements | `otopcy-securite` |
| Argent, webhooks, devises, retraits | `otopcy-paiements` |
| Lenteur, cache, ISR, crons | `otopcy-performance` |
| Back-office, audit, capacités | `otopcy-admin` |
| Choisir un service, comptes Google, DNS | `otopcy-outils` |
| Avant mise en ligne | `otopcy-audit` |

## Le motif d'une route, à reproduire tel quel

```ts
export const runtime = 'nodejs';                      // 1. sinon casse en prod

export async function POST(req: NextRequest) {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrf = verifyCsrf(req);                     // 2. avant toute écriture
    if (csrf) return csrf;
    const auth = await requireAuth(req);              // 3. avant toute donnée privée
    if (auth instanceof NextResponse) return auth;
    const corps = Schema.safeParse(await req.json()); // 4. valider
    if (!corps.success) return erreur(400, 'INVALID_BODY');
    // 5. le travail
  });
}
```

## Quand une règle compte, écris le test

Une règle dans un document est une règle qu'on enfreindra dans six mois.
Les garde-fous qui rapportent le plus (10 à 30 lignes chacun) :

- chaque route exporte `runtime = 'nodejs'` ;
- crons déclarés ⟺ routes existantes ;
- variables utilisées ⊆ `.env.example` ;
- aucun `NEXT_PUBLIC_*` contenant `SECRET`/`KEY`/`TOKEN` ;
- toute route `/api/admin/*` qui écrit appelle `logAdminAction`.

## Barrière avant commit

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
pnpm build      # avant de pousser : frontière client/serveur, préenregistrement
```

## Ne fais jamais

- écrire, afficher ou commiter une clé ; concevoir un écran qui en accepte une ;
- inventer une donnée manquante ;
- affirmer « corrigé » sans montrer la commande et sa sortie ;
- étendre le rejeu automatique aux verbes qui écrivent.
