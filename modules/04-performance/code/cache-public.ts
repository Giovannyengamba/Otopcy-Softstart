// Les lectures que fait une page publique, gardées quelques secondes.
//
// Le problème mesuré (2026-09-28, production, visiteur africain) : la page
// d'accueil demandait à la base, à CHAQUE visite, la totalité des articles
// publiés, tout le catalogue, la vedette du Club, les prochaines séances,
// les vidéos, les réglages et la galerie du portfolio — soit huit requêtes
// en quatre vagues successives. Le serveur répondait en ~1 040 ms là où une
// route qui ne fait rien répond en ~550 ms : près d'une demi-seconde
// passée à redemander ce qui n'avait pas bougé depuis la visite d'avant.
//
// Ce module ne change rien à CE qui est affiché. Il change seulement le
// nombre de fois qu'on va le chercher.
//
// Deux garde-fous, parce qu'un cache qui garde trop longtemps est un bug
// qu'on ne voit pas :
//
//   · une durée courte (60 s). Même si l'on oublie d'invalider quelque
//     part, une modification faite dans l'admin apparaît au plus tard une
//     minute après. Jamais « plus jamais » ;
//   · une étiquette par sujet, que les routes d'écriture font tomber
//     (`oublier`) dès qu'elles ont écrit — l'effet est alors immédiat.
//
// **Ce qui n'est PAS ici, et ne doit pas y venir** : tout ce qui décide
// d'argent ou de droits. Les webhooks de paiement, `/api/orders`, les
// téléchargements payants et les routes d'administration continuent de
// lire la base directement. Un produit dont le prix vient d'un cache est
// un produit qu'on peut vendre à l'ancien prix.

import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';

/** Les sujets, tels que les routes d'écriture les nomment. */
export const ETIQUETTES = {
  produits: 'public:produits',
  projets: 'public:projets',
  articles: 'public:articles',
  reglages: 'public:reglages',
  videos: 'public:videos',
  evenements: 'public:evenements',
} as const;

export type Etiquette = (typeof ETIQUETTES)[keyof typeof ETIQUETTES];

/** Assez long pour effacer la rafale de requêtes d'une même minute, assez
 *  court pour qu'un oubli d'invalidation ne se voie pas. */
const DUREE = 60;

/**
 * La même fonction, mais qui ne redescend en base qu'une fois par minute.
 *
 * @param fn        la lecture à garder — elle ne doit lire ni `cookies()`
 *                  ni `headers()` : le résultat est partagé entre tous les
 *                  visiteurs, donc il ne peut rien contenir de personnel.
 * @param cle       identifie l'entrée ; deux lectures différentes ne
 *                  doivent jamais partager la même clé.
 * @param etiquettes ce qui, en changeant, rend cette entrée fausse.
 * @param duree      en secondes, pour ce qui change encore moins souvent
 *                   que le contenu du site — les taux de change ne sont
 *                   publiés qu'une fois par jour.
 */
export function garde<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  cle: string,
  etiquettes: Etiquette[],
  duree: number = DUREE,
): (...args: A) => Promise<R> {
  return unstable_cache(fn, [cle], { revalidate: duree, tags: etiquettes });
}

/**
 * Faire tomber ce qui vient de changer.
 *
 * À appeler à la fin d'une route d'écriture, après le succès — jamais
 * avant : invalider puis échouer remettrait en cache la valeur d'avant.
 *
 * Ne lève pas. En dehors du rendu d'une requête (un cron, un script),
 * `revalidateTag` n'a pas de contexte et proteste ; ce n'est pas une
 * raison de faire échouer une écriture qui, elle, a réussi. La durée de
 * 60 s rattrape le cas.
 */
export function oublier(...etiquettes: Etiquette[]): void {
  for (const e of etiquettes) {
    try {
      // Next 16 exige un profil de durée. `{ expire: 0 }` veut dire
      // « périmée maintenant » : la prochaine lecture redescend en base.
      revalidateTag(e, { expire: 0 });
    } catch {
      /* hors contexte de requête — la durée courte fait le rattrapage */
    }
  }
}
