#!/usr/bin/env bash
# Otopcy SoftStart — repérage rapide des signaux d'alerte.
#
# Ce script ne CONCLUT rien : il produit des signaux à vérifier à la main.
# Les contrôles 4, 5, 9, 10 et 16 lui échappent complètement — ils se
# vérifient dans la console du fournisseur ou dans le navigateur.
#
#   ./scan.sh /chemin/du/projet

set -uo pipefail
RACINE="${1:-.}"
cd "$RACINE" || exit 1
EXCL="--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=dist"
titre() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
rien()  { printf '   aucun signal\n'; }

titre "1 · Secrets qui ressemblent à de vraies clés"
grep -rEn $EXCL "(sk_live_|rk_live_|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36})" . 2>/dev/null | head -20 || rien

titre "2 · Fichiers .env suivis par Git"
git ls-files 2>/dev/null | grep -E '^\.env|/\.env' | grep -v '\.example$' | head -10 || rien
printf '   .gitignore couvre .env : '
grep -qE '^\.?env|\.env' .gitignore 2>/dev/null && echo "oui" || echo "NON — 🔴"

titre "3 · Secret potentiellement exposé au navigateur"
grep -rEn $EXCL "(NEXT_PUBLIC|VITE|REACT_APP)_[A-Z_]*(SECRET|PRIVATE|SERVICE_ROLE|PASSWORD)" . 2>/dev/null | head -20 || rien

titre "6+18 · Routes d'écriture sans contrôle d'accès ni CSRF"
for f in $(find . -path ./node_modules -prune -o -name 'route.ts' -print 2>/dev/null); do
  grep -qE '\b(POST|PUT|PATCH|DELETE)\b *\(' "$f" || continue
  manque=""
  grep -q 'requireAuth\|requireAdmin\|requireSuperadmin\|requireOrgRole' "$f" || manque="$manque auth"
  grep -q 'verifyCsrf' "$f" || manque="$manque csrf"
  [ -n "$manque" ] && echo "   $f →$manque"
done | head -30

titre "Runtime nodejs manquant"
for f in $(find . -path ./node_modules -prune -o -name 'route.ts' -print 2>/dev/null); do
  grep -q "runtime *= *'nodejs'" "$f" || echo "   $f"
done | head -20

titre "8 · SQL potentiellement concaténé"
grep -rEn $EXCL '\$queryRawUnsafe|\$executeRawUnsafe' . 2>/dev/null | head -10 || rien

titre "13 · Insertion de HTML brut"
grep -rEn $EXCL 'dangerouslySetInnerHTML|v-html|innerHTML *=' . 2>/dev/null | head -15 || rien

titre "14 · Routes de débogage"
find . -path ./node_modules -prune -o -type d \( -name debug -o -name test -o -name _internal \) -print 2>/dev/null | head -10 || rien

titre "19 · Webhooks : corps parsé avant vérification de signature"
for f in $(grep -rl $EXCL 'webhook' --include='route.ts' . 2>/dev/null); do
  grep -q 'req.json()' "$f" && ! grep -q 'arrayBuffer' "$f" && echo "   $f → 🔴 req.json() sans corps brut"
done | head -10

titre "17 · Dépendances"
echo "   lancer : pnpm audit --prod"

printf '\n\033[1mRappel — ceci ne conclut rien.\033[0m Vérifier chaque signal dans le fichier,\n'
printf 'et traiter à la main les contrôles 4, 5, 9, 10 et 16.\n\n'
