// Devise affichée ≠ devise débitée.
//
// C'est LA distinction qui structure tout le domaine monétaire, et celle
// qu'on ne voit pas venir :
//
//   · la devise DÉBITÉE est ce que le prestataire encaisse réellement.
//     L'ensemble est petit et FERMÉ — ce que tes contrats couvrent ;
//   · la devise AFFICHÉE est ce que le visiteur lit. L'ensemble est
//     OUVERT : naira, rouble, roupie… déduit de son pays.
//
// Un visiteur nigérian lit « ≈ ₦8 400 » et est débité de 5,20 $. Les deux
// chiffres apparaissent ensemble, et l'affiché se calcule À PARTIR du
// débité — jamais en parallèle, sinon les deux dérivent et l'acheteur
// voit deux prix qui ne collent pas.
//
// ⚠️ INVARIANT — `versUniteMineure()` est appelée par le navigateur pour
// afficher, et par le serveur pour vérifier la commande. Les deux DOIVENT
// trouver le même entier. Donc : fonction pure, et tout ce qu'elle
// consomme est une CONSTANTE DE CE FICHIER. Jamais un taux appelé en
// direct : un rafraîchissement entre les deux calculs ferait rejeter des
// commandes valides.
//
// Le taux vivant sert à AFFICHER une estimation, jamais à facturer.

import { deviseDuPays, decimalesDe, symboleDe } from './devises';

// ───────────────────────────────────────────────────────── configuration

/** Les devises réellement encaissées. À adapter à tes contrats. */
export type DeviseDebit = 'XAF' | 'XOF' | 'EUR' | 'USD';

/** La devise de saisie des prix en base — celle dans laquelle tu penses. */
export const DEVISE_DE_BASE = 'XAF' as const;

/**
 * Taux de conversion depuis la devise de base, FIGÉS DANS LE CODE.
 *
 * Deux natures très différentes, à ne pas confondre :
 *   · une parité fixée par traité (ici le franc CFA contre l'euro) ne
 *     bouge jamais — on peut s'y fier indéfiniment ;
 *   · un taux de marché DÉRIVE. Celui-ci se relit au calendrier, pas au
 *     hasard. Note la date du relevé, sinon personne ne saura s'il est
 *     vieux de trois jours ou de trois ans.
 */
export const TAUX: Record<Exclude<DeviseDebit, 'XAF' | 'XOF'>, number> = {
  EUR: 655.957, // parité fixée par traité — ne change pas
  USD: 576, // taux de marché — relevé le AAAA-MM-JJ, à revérifier
};

/**
 * Ce qu'on ajoute à toute conversion, pour être à ses frais.
 *
 * Vendre 30 000 à l'étranger ne rapporte pas 30 000 : le prestataire prend
 * sa commission, et le taux interbancaire n'est pas celui auquel tu seras
 * payé. Cette majoration couvre les deux, et absorbe au passage la dérive
 * du taux entre deux relevés.
 */
export const MAJORATION = 1.1;

/** Devises sans sous-unité : 1 000 XAF s'envoie comme 1000, pas 100000. */
const SANS_DECIMALE = new Set<DeviseDebit>(['XAF', 'XOF']);

// ─────────────────────────────────────────────────────────────── le type

/** Ce que le visiteur LIT. Ouvert, déduit de son pays. */
export interface DeviseAffichee {
  /** Code ISO : 'NGN', 'RUB', 'EUR'… */
  code: string;
  /** Ce qui sera réellement encaissé. */
  debit: DeviseDebit;
  /** Combien d'unités affichées pour une unité débitée (1 si identiques). */
  parUniteDebit: number;
  decimales: 0 | 2;
}

export interface RegionVisiteur {
  /** Code pays ISO 3166-1 alpha-2, '' si inconnu. */
  pays: string;
  debit: DeviseDebit;
  affichee: DeviseAffichee;
}

// ──────────────────────────────────────────────────────────── conversion

function taux(devise: DeviseDebit): number {
  if (devise === 'EUR') return TAUX.EUR;
  if (devise === 'USD') return TAUX.USD;
  return 1; // XAF / XOF : c'est déjà la devise de base
}

/** Montant de base → montant dans la devise débitée, majoration comprise. */
export function montantConverti(base: number, devise: DeviseDebit): number {
  if (SANS_DECIMALE.has(devise)) return base;
  return (base / taux(devise)) * MAJORATION;
}

/** L'inverse — pour retrouver un montant de base depuis un encaissement. */
export function versBase(montant: number, devise: DeviseDebit): number {
  if (SANS_DECIMALE.has(devise)) return montant;
  return (montant * taux(devise)) / MAJORATION;
}

/**
 * Le montant EXACT envoyé au prestataire, en plus petite unité.
 *
 * ⚠️ Pure et déterministe. Le navigateur et le serveur l'appellent tous
 * les deux et DOIVENT trouver le même entier, sinon la commande est
 * rejetée. Ne jamais y introduire d'horloge, d'aléa ni d'appel réseau.
 */
export function versUniteMineure(base: number, devise: DeviseDebit): number {
  if (SANS_DECIMALE.has(devise)) return Math.round(base);
  // Plancher à 1,00 : la plupart des prestataires refusent en dessous.
  return Math.max(100, Math.round(montantConverti(base, devise) * 100));
}

// ───────────────────────────────────────────────────────────── affichage

/** Ce que lit un visiteur dont on ne sait rien. */
export function deviseDuDebit(debit: DeviseDebit): DeviseAffichee {
  return {
    code: debit,
    debit,
    parUniteDebit: 1,
    decimales: SANS_DECIMALE.has(debit) ? 0 : 2,
  };
}

/**
 * La devise à afficher pour ce pays.
 *
 * `tauxParEuro` vient d'une API de taux et peut être `null` (hors ligne,
 * API en panne). Dans ce cas on retombe sur la devise débitée : mieux
 * vaut un prix en dollars qu'un prix inventé.
 */
export function deviseVisiteur(
  pays: string,
  debit: DeviseDebit,
  tauxParEuro: Record<string, number> | null,
): DeviseAffichee {
  const code = deviseDuPays(pays);
  if (!code || code === debit || !tauxParEuro) return deviseDuDebit(debit);

  const cible = tauxParEuro[code];
  const source = debit === 'EUR' ? 1 : tauxParEuro[debit];
  if (!cible || !source || !Number.isFinite(cible) || !Number.isFinite(source)) {
    return deviseDuDebit(debit);
  }

  return { code, debit, parUniteDebit: cible / source, decimales: decimalesDe(code) };
}

/**
 * Le prix à afficher.
 *
 * On calcule d'abord le montant DÉBITÉ, puis on convertit CELUI-LÀ vers la
 * devise lue. Les deux chiffres montrés côte à côte concordent donc
 * toujours — ce qui n'est pas le cas si on les calcule en parallèle.
 */
export function formaterPrix(base: number, devise: DeviseAffichee | DeviseDebit): string {
  const d = typeof devise === 'string' ? deviseDuDebit(devise) : devise;
  const debite = montantConverti(base, d.debit);
  const affiche = debite * d.parUniteDebit;

  const corps = affiche.toLocaleString('fr-FR', {
    minimumFractionDigits: d.decimales,
    maximumFractionDigits: d.decimales,
  });
  const sym = symboleDe(d.code);
  const prefixe = d.parUniteDebit === 1 ? '' : '≈ ';
  return sym ? `${prefixe}${sym}${corps}` : `${prefixe}${corps} ${d.code}`;
}

/**
 * La mention « tu seras débité de X » sous un prix converti.
 * `null` quand affiché et débité coïncident : pas de bruit inutile.
 */
export function mentionDebit(base: number, devise: DeviseAffichee): string | null {
  if (devise.parUniteDebit === 1) return null;
  return `débité ${formaterPrix(base, deviseDuDebit(devise.debit))}`;
}
