# Le kit comme compétences Claude Code

Sept compétences qui font qu'un agent applique ces règles de lui-même, au
lieu de réinventer un `POST` sans CSRF à chaque route.

```bash
cp -r otopcy-softstart/skills/* mon-projet/.claude/skills/
```

Chaque `SKILL.md` est **autonome** : il contient les règles essentielles de
son domaine, sans dépendre du reste du dépôt. Si tu copies aussi les
modules, l'agent ira y chercher le détail et le code.

| Compétence | Se déclenche sur |
|---|---|
| `otopcy-softstart` | Démarrage de projet, question d'architecture générale — c'est l'aiguillage |
| `otopcy-architecture` | Structure, frontière client/serveur, observabilité, prestataires optionnels |
| `otopcy-securite` | Authentification, CSRF, rôles, en-têtes, téléversements |
| `otopcy-paiements` | Tout ce qui touche à l'argent, webhooks, devises |
| `otopcy-performance` | Lenteur, cache, ISR, tâches planifiées |
| `otopcy-admin` | Back-office, journal d'audit, capacités |
| `otopcy-audit` | Avant mise en ligne, revue de sécurité |

Rappel du [module 09](../modules/09-processus/) : une compétence ne remplace
pas la barrière `format → lint → typecheck → test → build`.
