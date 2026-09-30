#!/usr/bin/env bash
# Aucune vraie clé ne doit entrer dans ce dépôt.
#
# Un kit de sécurité qui publierait un secret serait une contradiction
# vivante. Ce script tourne en intégration continue sur chaque poussée, et
# il fait échouer la construction — pas un avertissement qu'on ignore.
#
# Les exceptions sont explicites et limitées : le script d'audit contient
# les motifs qu'il cherche, et la documentation cite des préfixes.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

# On n'exempte JAMAIS un fichier en bloc — un vrai secret collé dans
# `.env.example` par mégarde doit encore déclencher. On exempte donc les
# chaînes factices PRÉCISES, et les deux scripts qui citent les motifs.
EXCEPTIONS='(^|\./)(audit/scan\.sh|scripts/verifier-secrets\.sh):'
FACTICES='utilisateur:motdepasse@hote|remplacer-par-la-sortie-de-openssl|`sk_(test|live)_`|sk_test_ / |motdepasse@|user:password@'
TROUVE=0

verifier() {
  local nom="$1" motif="$2"
  local r
  r=$(grep -rEn --exclude-dir=.git --exclude-dir=node_modules "$motif" . 2>/dev/null \
      | grep -vE "$EXCEPTIONS" | grep -vE "$FACTICES" || true)
  if [ -n "$r" ]; then
    printf '✗ %s\n%s\n\n' "$nom" "$r"
    TROUVE=1
  fi
}

verifier "Clés de prestataires"   '(sk_live_|sk_test_[A-Za-z0-9]{10,}|pk_live_|rk_live_|re_[A-Za-z0-9]{20,}|phc_[A-Za-z0-9]{20,})'
verifier "Identifiants cloud"     '(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,})'
verifier "Jetons JWT"             'eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}'
verifier "Clés privées"           '-----BEGIN [A-Z ]*PRIVATE KEY-----'
verifier "URL avec identifiants"  '(postgres(ql)?|mysql|redis|mongodb)(\+srv)?://[^:/@"'"'"' ]+:[^@"'"'"' ]+@' 
verifier "Secret affecté"         '(SECRET|TOKEN|PASSWORD|API_KEY)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9/+_-]{24,}["'"'"']'

# Un .env réel ne doit jamais être suivi
if git ls-files 2>/dev/null | grep -E '(^|/)\.env' | grep -v '\.example$' | grep -q .; then
  echo "✗ Un fichier .env est suivi par Git"
  TROUVE=1
fi

if [ "$TROUVE" -eq 0 ]; then
  echo "✓ Aucun secret détecté"
else
  echo "Un secret trouvé ici est à RÉVOQUER, pas seulement à retirer."
  exit 1
fi
