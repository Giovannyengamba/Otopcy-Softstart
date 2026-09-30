# 06 — Référencement

> Le SEO technique est vite fait et vite fini. Ce qui prend du temps,
> c'est ce qu'aucune balise ne résout — et il vaut mieux le savoir avant
> d'y passer trois mois.

---

## Ce que le technique règle, et ce qu'il ne réglera jamais

| Le technique règle | Le technique ne règle pas |
|---|---|
| Être explorable et indexable | Mériter d'être classé |
| Les bons titres dans les résultats | La concurrence sur ton propre nom |
| Un bel aperçu au partage | L'absence de contenu |
| La compréhension de ta structure | L'absence de liens entrants |

**Le cas qu'il faut connaître avant de se décourager.** Sur le produit
d'origine, le site ne sortait pas sur le nom de son propriétaire. Aucune
erreur technique : indexation correcte, balises correctes, plan de site
soumis. La cause était qu'une organisation plus ancienne et plus citée
occupait déjà ce nom. Aucune balise ne renverse ça — seuls le temps, les
citations et les liens le font.

Diagnostique la cause avant d'optimiser. Trois questions :

1. Le site est-il **indexé** ? (`site:ton-domaine.com`)
2. Sort-il sur une requête **très spécifique** tirée de son contenu ?
   Si oui, le technique va bien : c'est un problème d'autorité.
3. Sort-il sur son nom de marque ? Si non et que 1 et 2 sont bons,
   quelqu'un d'autre occupe le nom.

---

## La base, à faire une fois

```ts
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://exemple.com'),   // sans ça, les URL d'aperçu sont relatives → cassées
  title: { default: 'Nom', template: '%s — Nom' },
  description: '…',
  openGraph: { type: 'website', locale: 'fr_FR', siteName: 'Nom' },
  twitter: { card: 'summary_large_image' },
};
```

Par page, un titre **unique** et une description **écrite**. Une description
générée par troncature du premier paragraphe est presque toujours mauvaise.

### Les trois fichiers

| Fichier | Contenu |
|---|---|
| `app/sitemap.ts` | Toutes les URL publiques, avec `lastModified` réel |
| `app/robots.ts` | Autoriser le public, **bloquer** `/api/`, `/admin/`, `/portal/` |
| `app/manifest.ts` | Nécessaire pour l'installation sur mobile |

`lastModified` doit être la **vraie** date de modification. Une date du
jour sur toutes les URL apprend aux moteurs à ignorer le champ.

### Données structurées

Ce qui donne les résultats enrichis. Les types qui rapportent, par ordre :
`Organization` (une fois), `Product` avec `offers`, `Article`,
`BreadcrumbList`, `Event`, `FAQPage`.

**Jamais de données structurées qui ne correspondent pas à la page.** Un
avis annoncé dans le balisage et absent de la page est une pénalité, pas
une astuce.

Un détail qui rapporte plus qu'il n'en a l'air : `sameAs` sur
`Organization` ou `Person`, listant tous les profils sociaux. C'est ce qui
permet à un moteur de rattacher ces comptes à la même entité au lieu de les
traiter séparément.

---

## Les erreurs qui coûtent vraiment

**Bloquer l'indexation en production.** Un `noindex` de recette oublié.
Vérifie après **chaque** mise en ligne.

**Deux URL pour la même page.** Avec et sans `www`, avec et sans barre
oblique finale. Choisis, redirige en 301, déclare `canonical`.

**Changer une URL sans redirection.** Toute URL publiée est un contrat.
Elle change → 301 permanente vers la nouvelle.

**Des images sans texte alternatif.** Accessibilité d'abord, référencement
image ensuite.

**Du contenu injecté après le chargement.** Ce qui compte doit être dans le
HTML rendu par le serveur.

---

## La vitesse compte, mais pas comme on croit

Les indicateurs d'expérience sont un critère **de départage**, pas un
levier de classement. Un site lent avec le bon contenu bat un site rapide
sans contenu.

Mais un site lent perd des visiteurs avant même qu'ils lisent. C'est là
qu'est le vrai coût. → [module 04](../04-performance/)

---

## Check-list

- [ ] `metadataBase` défini
- [ ] Titre et description uniques sur chaque page publique
- [ ] `sitemap.ts` avec des `lastModified` réels
- [ ] `robots.ts` bloque les zones privées
- [ ] Un seul domaine canonique, l'autre en 301
- [ ] Données structurées cohérentes avec le contenu visible
- [ ] `sameAs` listant les profils officiels
- [ ] Aucun `noindex` résiduel en production
- [ ] Toute ancienne URL redirigée en 301
