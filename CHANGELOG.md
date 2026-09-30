# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnage sémantique — sur un dépôt de documentation, une **majeure**
signifie qu'une règle a changé de sens, pas qu'une API a bougé.

## [1.0.0] — 2026-09-30

Première publication. Extraction d'une application Next.js en production
(boutique, adhésions, billetterie, portail d'administration, paiements
mobile money et PayPal, ~1 900 tests unitaires).

### Ajouté

- **11 modules** : architecture, sécurité, paiements, administration,
  performance, statistiques, SEO, e-mails, tâches planifiées, processus,
  comptes et outils
- **8 compétences Claude Code** dans [`skills/`](skills/)
- **Audit en 20 contrôles** + script de repérage ([`audit/`](audit/))
- **Référence des clés** et modèle `.env` ([`cles/`](cles/))
- **~2 900 lignes de code réutilisable** sous `modules/*/code/`
- Vérifications automatiques : liens internes, absence de secrets, syntaxe

### Les dix règles fondatrices

Montants entiers · HMAC sur corps brut · boîte d'envoi transactionnelle ·
aucune clé côté client · autorisation côté serveur · écritures
d'administration auditées · prestataire absent = inerte · réconciliation
des paiements · pas de `headers()` dans le gabarit racine · aucune donnée
inventée.
