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

## 2. L'identité des commits — déjà réglée

Les commits portent `giovannyengamba <engambagiovanny@gmail.com>`, l'adresse
du compte GitHub. Ils seront donc attribués correctement : avatar, et
comptés dans le graphe de contributions.

```bash
git log --format='%an <%ae>'   # vérifier avant de pousser
```

Le dépôt a sa propre configuration locale, indépendante de la globale :

```bash
git config user.name    # giovannyengamba
git config user.email   # engambagiovanny@gmail.com
```

> Cette adresse sera **publique** dans l'historique — c'est inévitable dès
> qu'on publie des commits. Si tu préfères la masquer, GitHub fournit un
> alias : réglages → Emails → *Keep my email addresses private*, puis
> réutilise `<id>+giovannyengamba@users.noreply.github.com` ici et réécris
> l'historique avec la commande ci-dessous. À faire **avant** la première
> poussée.
>
> ```bash
> git config user.email "<le-nouvel-email>"
> git rebase --root --exec 'git commit --amend --no-edit --reset-author'
> ```

**Ne pas confondre les deux adresses :**

| Adresse | Sert à |
|---|---|
| `engambagiovanny@gmail.com` | **Signer les commits** — technique, liée au compte GitHub |
| `hello@giovannyengamba.com` | **Être contacté** — c'est elle qui s'affiche dans le kit |

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
| Les commits n'ont ni avatar ni attribution | `engambagiovanny@gmail.com` non déclaré sur le compte GitHub | Ajoute-le dans réglages → Emails |
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
