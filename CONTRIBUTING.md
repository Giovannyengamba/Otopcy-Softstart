# Contribuer

Merci d'y regarder. Ce dépôt a une ligne éditoriale assez stricte : la lire
avant de proposer quelque chose évite des allers-retours.

## Ce qui a sa place ici

**Ce qui a coûté quelque chose.** Un piège rencontré en production, un
invariant dont la violation ne se voit pas en développement, une décision
d'architecture prise après s'être trompé une première fois.

La question à se poser : *est-ce que quelqu'un peut lire ça, et éviter une
journée perdue ou un incident ?* Si oui, ça a sa place.

## Ce qui n'en a pas

- **Du design.** Aucun composant, aucune palette, aucune police. C'est le
  seul choix non négociable du kit.
- **Ce que la documentation officielle dit déjà mieux.** Si la réponse est
  dans le premier résultat de recherche, elle n'a pas besoin d'être ici.
- **Une préférence sans motif.** « Utilise X plutôt que Y » a besoin du
  scénario où Y fait mal.
- **Du code non éprouvé.** Ce dépôt ne publie pas d'exemple écrit pour
  l'occasion. Si ça n'a pas tourné en production, ça se dit.

## La forme

**Le commentaire explique le *pourquoi*, pas le *quoi*.**

```ts
// ✅ « On ne met pas de nonce dans la CSP : ça forcerait chaque page à
//    passer par une fonction, et le site entier perdrait sa mise en cache. »
// ❌ « Définit la politique de sécurité du contenu. »
```

**Chaque piège se décrit par son symptôme.** C'est par le symptôme qu'on le
rencontre, jamais par sa cause. Les tableaux « symptôme → cause » de chaque
module sont la partie la plus consultée.

**En français**, tutoiement. Les noms de fichiers, de fonctions et de
variables restent en anglais quand c'est l'usage de l'écosystème.

**Pas de chiffre inventé.** Si tu annonces un gain, dis comment tu l'as
mesuré et depuis où. « 902 → 812 Ko » vaut mieux que « bien plus léger ».

## Avant d'ouvrir une proposition

```bash
npm install
npm run verifier      # liens, secrets, syntaxe
```

Les trois doivent passer. Le contrôle de secrets fait échouer l'intégration
continue, ce n'est pas un avertissement.

## Signaler une erreur

Une règle fausse dans ce dépôt est plus grave qu'une règle absente : elle
sera appliquée. Si tu en vois une, ouvre un ticket même sans avoir la
correction — dis ce que tu as observé, et où.

## Ce qui n'est pas garanti

Personne ne te doit de réponse, et une proposition peut être refusée sans
autre motif que « ça ne rentre pas dans la ligne ». Ça n'enlève rien à
l'utilité de l'avoir proposée.
