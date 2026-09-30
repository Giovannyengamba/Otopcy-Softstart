# Publier ce dépôt sur GitHub

Tout est prêt. Il reste trois décisions et une poignée de commandes.

---

## 1. Se connecter au bon compte

`gh` gère **plusieurs comptes en parallèle** et bascule de l'un à l'autre.
Rien n'est à déconnecter.

### Voir où tu en es

```bash
gh auth status
```

### Ajouter le compte

```bash
gh auth login
```

Réponds dans cet ordre :

| Question | Réponse |
|---|---|
| What account do you want to log into? | **GitHub.com** |
| What is your preferred protocol? | **HTTPS** |
| Authenticate Git with your GitHub credentials? | **Yes** |
| How would you like to authenticate? | **Login with a web browser** |

Un code à huit caractères s'affiche. Entrée ouvre le navigateur, tu colles
le code, tu approuves.

> ⚠️ **Le navigateur s'ouvre sur le compte déjà connecté.** Si tu en as
> plusieurs, ouvre d'abord <https://github.com> en navigation privée et
> connecte-toi au bon — sinon tu autoriseras le mauvais sans le voir.

### Basculer entre comptes

```bash
gh auth switch                    # menu interactif
gh auth switch --user <compte>    # direct
gh auth status                    # vérifier : « Active account: true »
```

### La portée `workflow`

Ce dépôt contient `.github/workflows/`. **Pousser un fichier de workflow
exige la portée `workflow`**, que le flux par défaut n'accorde pas
toujours. Sans elle, la poussée est refusée avec
`refusing to allow an OAuth App to create or update workflow`.

```bash
gh auth refresh -h github.com -s workflow
```

À faire **avant** la première poussée, sur le compte qui publie.

---

## 2. Choisir l'identité des commits

Les trois commits actuels portent `otopcycorp <g.engamba@cedcameroun.org>`.
Si tu publies sous un autre compte, **GitHub ne les attribuera pas** : ils
apparaîtront sans ton avatar, en dehors de ton graphe de contributions.

### Vérifier

```bash
git log --format='%an <%ae>'
```

### Réécrire (le dépôt n'est pas encore poussé — c'est sans risque)

```bash
cd "/Users/apple/Documents/OTOPCY SAAS/Otopcy SoftStart"

# 1. l'identité de CE dépôt, pour les commits futurs
git config user.name  "ton-pseudo-github"
git config user.email "ton-email@exemple.com"

# 2. réécrire les commits déjà faits
git -c user.name="ton-pseudo-github" -c user.email="ton-email@exemple.com" \
    rebase --root --exec 'git commit --amend --no-edit --reset-author'

git log --format='%an <%ae>'   # vérifier
```

> L'e-mail doit être **celui déclaré sur le compte GitHub**, sinon
> l'attribution échoue silencieusement. Si tu ne veux pas le publier,
> active l'adresse privée dans les réglages GitHub et utilise la forme
> `<id>+<pseudo>@users.noreply.github.com`.

---

## 3. Créer le dépôt et pousser

```bash
cd "/Users/apple/Documents/OTOPCY SAAS/Otopcy SoftStart"

gh repo create otopcy-softstart \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "Le socle technique d'un SaaS qui encaisse de l'argent réel : architecture, sécurité, paiements, administration, performance. Sans design."
```

Pour un dépôt d'organisation : `gh repo create <org>/otopcy-softstart …`.
Privé : remplace `--public` par `--private`.

### Après la création

```bash
gh repo edit --add-topic starter-kit,nextjs,prisma,payments,security,audit,playbook,claude-code,french
gh repo edit --enable-issues --enable-discussions --disable-wiki
gh repo view --web
```

---

## 4. Vérifier que tout est propre

```bash
npm install
npm run verifier     # liens · secrets · syntaxe
gh run list --limit 3   # l'intégration continue, après la poussée
```

Les trois contrôles doivent passer **avant** de pousser. Celui des secrets
n'est pas décoratif : il fait échouer la construction.

---

## Si ça coince

| Message | Cause | Remède |
|---|---|---|
| `refusing to allow an OAuth App to create or update workflow` | Portée `workflow` absente | `gh auth refresh -h github.com -s workflow` |
| `Permission denied` / `403` à la poussée | Mauvais compte actif | `gh auth switch --user <compte>` |
| Les commits n'ont ni avatar ni attribution | E-mail non déclaré sur le compte | Ajoute-le dans les réglages GitHub, ou réécris (§2) |
| `repository already exists` | Nom déjà pris | Change le nom, ou `gh repo delete <nom>` |
| Git redemande le mot de passe | `credential.helper` non posé | `gh auth setup-git` |
| L'intégration continue échoue sur les secrets | Un vrai secret est entré | **Révoquer**, puis retirer. Voir [SECURITY.md](SECURITY.md) |

---

## Après la mise en ligne

- [ ] Le README s'affiche correctement, les tableaux et les liens tiennent
- [ ] L'onglet Actions montre les vérifications au vert
- [ ] La licence est reconnue (« MIT » apparaît en haut à droite)
- [ ] Les sujets sont posés — c'est par eux qu'on trouve le dépôt
- [ ] Une release `v1.0.0` : `gh release create v1.0.0 --notes-file CHANGELOG.md`
- [ ] Le lien ajouté sur [giovannyengamba.com](https://www.giovannyengamba.com) et [otopcy.com](https://www.otopcy.com)
