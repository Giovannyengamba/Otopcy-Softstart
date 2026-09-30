// En-têtes de sécurité et politique de contenu.
//
// À coller dans `next.config.ts`, PAS dans le middleware : posés ici, ils
// sont servis par le réseau de diffusion sans réveiller de fonction —
// donc à coût nul par requête.
//
// ── Pourquoi une liste d'origines et pas un nonce ────────────────────────
//
// Une CSP « propre » utilise un nonce par requête. Le prix caché : générer
// un nonce oblige à faire passer CHAQUE page par une fonction, donc à
// renoncer à la mise en cache sur tout le site. Sur un public éloigné du
// serveur, ça coûte des centaines de millisecondes par page.
//
// Et le gain est plus faible qu'il n'y paraît : `'unsafe-inline'` reste
// nécessaire de toute façon (script d'amorçage du framework, balises
// publicitaires qui s'installent en ligne).
//
// Ce que cette CSP arrête réellement, et qui n'était arrêté par rien :
//   · object-src 'none'      — plus de greffon, vecteur d'injection classique
//   · base-uri 'self'        — une <base> injectée ne détourne plus les URL relatives
//   · form-action 'self'     — un formulaire injecté ne poste plus ailleurs
//   · frame-ancestors 'none' — clickjacking
//   · script-src <liste>     — un script d'un hôte non prévu est bloqué
//
// ⚠️ AVANT DE RESSERRER, ou d'ajouter une brique tierce (chat, carte,
//    lecteur vidéo, régie publicitaire) : ajoute son hôte ici, sinon elle
//    ne se chargera pas en production — et sans erreur visible.
//
// ⚠️ LE PIÈGE DU GESTIONNAIRE DE BALISES : c'est un seul script, mais il
//    en INJECTE d'autres. Une campagne branchée depuis son interface tirera
//    un domaine que rien dans ton dépôt ne mentionne. Non listé ⇒ bloqué en
//    silence ⇒ conversions à zéro, et personne ne saura pourquoi.

/** Les hôtes réellement chargés. À réduire à ce que TON site utilise. */
const HOTES_SCRIPTS = [
  // Gestionnaire de balises, plus ce qu'il injecte lui-même
  'https://*.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  // Meta
  'https://connect.facebook.net',
  'https://*.facebook.net',
  // reCAPTCHA
  'https://www.google.com',
  'https://www.gstatic.com',
  // Mesure produit
  'https://*.posthog.com',
].join(' ');

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' : exigé par le rechargement à chaud en développement et
  // par certaines balises publicitaires. 'unsafe-inline' : script
  // d'amorçage du framework.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${HOTES_SCRIPTS}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  'img-src https: data: blob:',
  'media-src https: data: blob:',
  // Volontairement large : la collecte d'erreurs et la mesure d'audience
  // parlent à des sous-domaines qui changent par région. Une CSP qui casse
  // la remontée d'erreurs le jour d'un incident coûte plus cher qu'elle ne
  // protège. C'est un ARBITRAGE, pas un oubli.
  'connect-src https: wss: data: blob:',
  'frame-src https:',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  {
    // Deux ans, sous-domaines compris. `preload` n'a d'effet qu'après
    // soumission à la liste des navigateurs — et est TRÈS difficile à
    // annuler : ne l'active que si tu es sûr de rester en HTTPS partout.
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

// Dans next.config.ts :
//
//   async headers() {
//     return [{ source: '/:path*', headers: securityHeaders }];
//   }
