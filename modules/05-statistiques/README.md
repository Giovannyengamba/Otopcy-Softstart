# 05 — Statistiques et consentement

> Deux besoins qu'on confond tout le temps : **savoir ce qui se passe sur
> ton produit**, et **alimenter les régies publicitaires**. Ils n'ont pas
> les mêmes outils, pas les mêmes obligations légales, et pas le même
> moment d'installation.

---

## Arbre de décision

```
Que veux-tu ?
├── Comprendre l'usage de ton produit
│   → outil orienté produit (PostHog, Plausible, Matomo)
│   → pas de consentement requis si configuré sans cookie ni identifiant personnel
│
├── Mesurer et optimiser des campagnes publicitaires
│   → Google Ads / Meta Pixel
│   → consentement OBLIGATOIRE avant chargement
│
└── Les deux
    → produit chargé d'emblée (sans cookie), publicité derrière le bandeau
```

L'ordre compte : installe la mesure produit **avant** le lancement, les
balises publicitaires **avant** la première campagne. L'inverse coûte des
semaines de données perdues.

---

## Le bandeau de consentement

Nécessaire dès qu'une balise publicitaire dépose un cookie tiers. Trois
choix, pas deux :

```
[ Tout accepter ]  [ Mesure d'audience seulement ]  [ Tout refuser ]
```

Quatre règles qui le rendent valable plutôt que décoratif :

1. **Refuser est aussi facile qu'accepter.** Même taille, même niveau
   visuel. Un « refuser » caché dans un sous-menu invalide le consentement.
2. **Rien ne se charge avant le choix.** Pas « on charge et on nettoie
   après » — la requête est déjà partie.
3. **Le choix se révise.** Un lien en pied de page qui rouvre le bandeau.
4. **Pas de mur.** Continuer sans accepter reste possible.

Techniquement : le choix en `localStorage`, et les scripts montés
conditionnellement.

```tsx
{consentement.publicite && <Script src="…" strategy="afterInteractive" />}
```

Et comme partout : **absent = inerte**. Sans identifiant de mesure dans
l'environnement, aucun script, aucun bandeau, aucune erreur.

---

## Rapatrier les chiffres dans ton administration

Un outil produit moderne expose une API de requêtes. Une route
d'administration l'interroge et alimente ta page de statistiques — plutôt
que d'envoyer l'équipe se connecter à un tableau de bord tiers.

```ts
// dégradation propre : pas de clé → 200 avec une note, pas une erreur
if (!cle || !projet) {
  return NextResponse.json({ visiteurs: null, note: 'mesure non configurée' });
}
```

### Ce qui n'est pas réaliste

Rapatrier les chiffres **de Google Analytics ou de Meta Ads** dans ta
propre administration demande un compte de service Google Cloud ou un
jeton longue durée de compte publicitaire. C'est faisable, c'est
disproportionné pour la plupart des projets, et ça se dit franchement
plutôt que de se faire en silence :

- l'outil produit sert les vraies statistiques de trafic, chez toi ;
- Google et Meta servent leur rôle principal — le suivi de conversion et le
  reciblage — consultables dans **leurs** interfaces.

Écris-le dans le code et dans l'interface, sinon quelqu'un cherchera
pendant des jours un écran qui n'existe pas.

---

## Ce qui rend une mesure inutilisable

**Les robots.** Un outil de test automatisé, un vérificateur de liens, un
moniteur de disponibilité génèrent du trafic qui n'est pas humain. Filtre
côté outil, et sache que beaucoup filtrent déjà les navigateurs sans
interface — ce qui veut dire que **tester ta mesure avec un navigateur
automatisé montrera zéro événement**, et que ce zéro ne prouve rien.

**Les événements sans convention.** `clic_bouton`, `ButtonClick`,
`btn-click` : trois noms pour la même chose, et six mois de données
inexploitables. Fixe la convention au premier événement
(`objet_verbe`, en minuscules), et écris-la quelque part.

**Les identifiants personnels dans les propriétés.** Un e-mail dans une
propriété d'événement part chez le prestataire et y reste. Envoie un
identifiant opaque.

---

## Pièges vécus

| Symptôme | Cause |
|---|---|
| Zéro événement alors que le site tourne | Test fait avec un navigateur sans interface, filtré comme robot |
| Conversions publicitaires à zéro | Le domaine injecté par le gestionnaire de balises est bloqué par la CSP → [module 01](../01-securite/#en-têtes-et-politique-de-contenu) |
| Données inexploitables après six mois | Pas de convention de nommage |
| Bandeau de consentement sans valeur juridique | « Refuser » moins accessible qu'« accepter » |
| Chiffres présents mais faux | Robots non filtrés |
