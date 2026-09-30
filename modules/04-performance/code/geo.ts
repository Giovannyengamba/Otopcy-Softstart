// D'où vient le visiteur, ce qu'il lira, et ce qui lui sera débité.
//
// L'en-tête de pays est posé gratuitement par l'hébergeur sur chaque
// requête en production — aucune clé, aucun service tiers. Le nom exact
// dépend du fournisseur (`x-vercel-ip-country` chez Vercel,
// `cf-ipcountry` derrière Cloudflare) : adapte la constante ci-dessous.
//
// ⚠️ Appeler cette fonction rend la branche DYNAMIQUE : elle lit un
// en-tête. Ne l'appelle donc PAS depuis le gabarit racine — ce seul
// appel rendrait toute l'application non cachable. Pose-la dans un
// gabarit de section, autour des pages qui montrent réellement des prix.
// Voir le module 04.
//
// Le repli est le dollar : c'est ce que lit un visiteur dont on ne sait
// rien, et c'est la monnaie la plus largement comprise. Choisis le tien
// en connaissance de cause — un repli sur une monnaie locale est un pari
// sur l'origine de ton trafic.
//
// En développement, l'en-tête n'existe pas : `DEV_PAYS=CM` dans
// `.env.local` permet de rejouer un pays donné.

import 'server-only';
import { headers } from 'next/headers';
import { deviseVisiteur, deviseDuDebit, type DeviseDebit, type RegionVisiteur } from './currency';
import { tauxDuJour } from './taux-change';

const ENTETE_PAYS = 'x-vercel-ip-country';

/** La devise réellement encaissée pour ce pays. À adapter à tes contrats. */
const DEBIT_PAR_DEFAUT: DeviseDebit = 'USD';

function debitDuPays(pays: string): DeviseDebit {
  if (pays === 'CM' || pays === 'GA' || pays === 'CG' || pays === 'TD') return 'XAF';
  if (pays === 'SN' || pays === 'CI' || pays === 'ML' || pays === 'BF') return 'XOF';
  if (ZONE_EURO.has(pays)) return 'EUR';
  return DEBIT_PAR_DEFAUT;
}

const ZONE_EURO = new Set([
  'FR', 'BE', 'DE', 'ES', 'IT', 'PT', 'NL', 'LU', 'AT', 'IE',
  'FI', 'GR', 'SK', 'SI', 'EE', 'LV', 'LT', 'CY', 'MT', 'HR',
]);

export async function getRegion(): Promise<RegionVisiteur> {
  // Les deux en parallèle : les taux sont mis en cache en amont, mais
  // rien ne justifie d'attendre l'un pour demander l'autre.
  const [h, taux] = await Promise.all([headers(), tauxDuJour()]);
  const pays = h.get(ENTETE_PAYS) ?? process.env.DEV_PAYS ?? '';
  const debit = debitDuPays(pays);
  return {
    pays,
    debit,
    affichee: taux ? deviseVisiteur(pays, debit, taux.parEuro) : deviseDuDebit(debit),
  };
}
