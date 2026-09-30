// Les taux de change du jour, pour écrire un prix dans la monnaie du
// visiteur.
//
// Règle absolue de ce projet : aucun chiffre affiché n'est inventé. Un taux
// codé en dur vieillit en silence — il est juste le jour où on l'écrit,
// faux six mois plus tard, et personne ne s'en aperçoit parce qu'un prix
// faux ressemble à un prix. On va donc les chercher, et quand on ne peut
// pas, on n'affiche pas de conversion du tout.
//
// La source est `open.er-api.com` : gratuite, sans clé, 166 monnaies, une
// mise à jour par jour. Sa qualité se vérifie sans lui faire confiance —
// voir `TAUX_VERIFIABLE` plus bas.
//
// ⚠️ Ces taux ne servent QU'À AFFICHER. Ce qui est débité reste calculé par
// `toMinorUnits()` avec les taux figés de `payments/currency.ts`, parce
// qu'un montant encaissé ne doit pas dépendre d'un service tiers joignable
// ou non au moment du clic.

import 'server-only';
import { garde, ETIQUETTES } from './cache-public';
import { log } from '@/lib/server/observability/log';

const SOURCE = 'https://open.er-api.com/v6/latest/EUR';

/** Le franc CFA est arrimé à l'euro par traité, à 655,957 exactement et
 *  depuis 1999. Ce n'est pas un taux de marché : c'est une constante. Si la
 *  réponse ne la donne pas au centième près, c'est que ce n'est pas une
 *  table de taux fiable — et on préfère ne rien convertir. */
const PEG_XAF = 655.957;

/** Une page ne doit pas attendre un service d'ornement.
 *
 *  Cet appel part depuis le gabarit racine, donc depuis TOUTES les pages.
 *  Le cache d'une heure fait qu'une seule requête par heure le paie
 *  réellement — mais celle-là ne doit pas voir sa réponse retardée d'une
 *  seconde et demie pour un chiffre qui n'est qu'un confort de lecture.
 *  Au-delà du délai, on rend la page sans conversion. */
const DELAI_MS = 1500;

export interface TauxDuJour {
  /** Unités de cette monnaie pour 1 euro. */
  parEuro: Record<string, number>;
  /** Ce que la source dit de sa propre fraîcheur. */
  publieLe: string;
}

async function chercher(): Promise<TauxDuJour | null> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const r = await fetch(SOURCE, { signal: ctrl.signal });
    if (!r.ok) {
      log.warn('taux_change.http', { status: r.status });
      return null;
    }
    const j = (await r.json()) as {
      result?: string;
      rates?: Record<string, unknown>;
      time_last_update_utc?: string;
    };
    if (j.result !== 'success' || !j.rates) {
      log.warn('taux_change.reponse_inattendue', { result: j.result });
      return null;
    }

    // On ne garde que des nombres finis et positifs : une monnaie à 0 ou
    // à `null` produirait des prix à zéro ou à l'infini.
    const parEuro: Record<string, number> = {};
    for (const [code, v] of Object.entries(j.rates)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) parEuro[code] = v;
    }

    // Le contrôle qui vaut tous les autres : si le peg du franc CFA n'y
    // est pas, la table n'est pas ce qu'elle prétend être.
    if (Math.abs((parEuro.XAF ?? 0) - PEG_XAF) > 0.01) {
      log.warn('taux_change.peg_incoherent', { xaf: parEuro.XAF });
      return null;
    }
    if (!parEuro.USD) return null;

    return { parEuro, publieLe: j.time_last_update_utc ?? '' };
  } catch (err) {
    // Réseau coupé, service en panne, délai dépassé : on n'affiche pas de
    // conversion, et le site continue en devise de débit. Jamais d'erreur
    // remontée à une page pour un ornement.
    log.warn('taux_change.injoignable', { err: err instanceof Error ? err.message : String(err) });
    return null;
  } finally {
    // Sans ça, le minuteur maintient la fonction serverless éveillée
    // jusqu'à son échéance, même quand la réponse est déjà arrivée.
    clearTimeout(minuteur);
  }
}

/**
 * Les taux, au plus une fois par heure.
 *
 * La source ne publie qu'une fois par jour ; interroger plus souvent ne
 * donnerait rien de neuf et ferait dépendre chaque page d'un tiers. Une
 * heure laisse tout de même le site rattraper une panne de la source sans
 * attendre le lendemain.
 */
export const tauxDuJour = garde(chercher, 'taux-change', [ETIQUETTES.reglages], 3600);
