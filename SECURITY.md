# Sécurité

## Ce dépôt ne contient aucun secret

Les fichiers `.env.example` ne portent que des valeurs factices, et
[`scripts/verifier-secrets.sh`](scripts/verifier-secrets.sh) le vérifie à
chaque poussée — un secret détecté fait échouer l'intégration continue.

**Si tu trouves quoi que ce soit qui ressemble à une vraie clé dans ce
dépôt, c'est un bug.** Écris à [hello@otopcy.com](mailto:hello@otopcy.com)
sans ouvrir de ticket public.

## Signaler une règle dangereuse

Ce dépôt donne des conseils de sécurité. Une règle **fausse** y est plus
grave qu'une règle absente : elle sera appliquée telle quelle dans de vraies
applications.

Si tu penses qu'un conseil de ce kit ouvre une faille au lieu de la fermer,
écris à [hello@otopcy.com](mailto:hello@otopcy.com). Décris le scénario
d'attaque concret plutôt que la théorie — c'est ce qui permet de trancher
vite.

Réponse sous quelques jours. Pas de programme de récompense : c'est un
dépôt de documentation, maintenu par une personne.

## Ce que ce kit ne garantit pas

Suivre ce playbook **ne rend pas une application sûre.** Il ferme les
classes de failles les plus fréquentes et les plus coûteuses, il ne
remplace ni un audit sérieux, ni un test d'intrusion, ni la connaissance de
ton propre domaine.

L'audit en 20 contrôles ([`audit/`](audit/)) est un point de départ honnête,
pas un certificat.

## Si une de tes clés a fuité

L'ordre compte, et la première étape passe avant de comprendre :

1. **Révoquer** chez le prestataire, tout de suite
2. Régénérer et redéployer
3. Chercher l'usage : appels inattendus, montants, volumes
4. Fermer le chemin par lequel elle est sortie

Une heure d'enquête avec une clé encore active, c'est une heure d'accès
offerte. Détail dans [`cles/`](cles/#en-cas-dexposition).
