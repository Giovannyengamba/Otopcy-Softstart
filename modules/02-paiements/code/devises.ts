// Pays → monnaie, et ce qu'il faut pour l'afficher.
//
// Pures données de référence : aucune logique métier ici, et rien de
// spécifique à un produit. Se copie tel quel.
//
// La liste des pays n'est pas exhaustive et n'a pas à l'être : un pays
// absent retombe sur la devise débitée, ce qui est un repli correct.
// Ajoute au fur et à mesure que tu vois passer du trafic.

const SANS_CENTIMES = new Set([
  'XAF',
  'XOF',
  'JPY',
  'KRW',
  'VND',
  'CLP',
  'ISK',
  'UGX',
  'RWF',
  'GNF',
  'MGA',
  'KMF',
  'DJF',
  'BIF',
  'PYG',
  'NGN',
  'IDR',
  'TZS',
  'KES',
  'XPF',
  'LAK',
  'MMK',
  'CVE',
  'IQD',
]);

/**
 * Pays → monnaie du pays.
 *
 * Volontairement large : c'est la carte des monnaies que les gens
 * emploient, pas celle des monnaies que nous encaissons. Un code absent de
 * la table des taux du jour est simplement ignoré à l'affichage (cf.
 * `deviseVisiteur`), donc une entrée de trop ne casse rien.
 *
 * Les pays de la zone euro ne sont pas listés : ils tombent sur le repli
 * EUR de leur devise de débit.
 */
export const MONNAIE_DU_PAYS: Record<string, string> = {
  // Afrique
  NG: 'NGN',
  GH: 'GHS',
  KE: 'KES',
  ZA: 'ZAR',
  TZ: 'TZS',
  UG: 'UGX',
  RW: 'RWF',
  ET: 'ETB',
  MA: 'MAD',
  DZ: 'DZD',
  TN: 'TND',
  EG: 'EGP',
  CD: 'CDF',
  AO: 'AOA',
  MZ: 'MZN',
  ZM: 'ZMW',
  ZW: 'ZWL',
  BW: 'BWP',
  NA: 'NAD',
  MU: 'MUR',
  MG: 'MGA',
  GM: 'GMD',
  SL: 'SLL',
  LR: 'LRD',
  GN: 'GNF',
  CV: 'CVE',
  SC: 'SCR',
  SD: 'SDG',
  LY: 'LYD',
  MW: 'MWK',
  BI: 'BIF',
  DJ: 'DJF',
  SO: 'SOS',
  // Zone franc CFA — Afrique centrale (XAF) et de l'Ouest (XOF)
  CM: 'XAF',
  GA: 'XAF',
  TD: 'XAF',
  CF: 'XAF',
  CG: 'XAF',
  GQ: 'XAF',
  BJ: 'XOF',
  BF: 'XOF',
  CI: 'XOF',
  GW: 'XOF',
  ML: 'XOF',
  NE: 'XOF',
  SN: 'XOF',
  TG: 'XOF',
  // Amériques
  US: 'USD',
  CA: 'CAD',
  MX: 'MXN',
  BR: 'BRL',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  PE: 'PEN',
  UY: 'UYU',
  BO: 'BOB',
  PY: 'PYG',
  VE: 'VES',
  CR: 'CRC',
  GT: 'GTQ',
  DO: 'DOP',
  JM: 'JMD',
  TT: 'TTD',
  HT: 'HTG',
  // Europe hors zone euro
  GB: 'GBP',
  CH: 'CHF',
  NO: 'NOK',
  SE: 'SEK',
  DK: 'DKK',
  IS: 'ISK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  BG: 'BGN',
  RS: 'RSD',
  UA: 'UAH',
  RU: 'RUB',
  BY: 'BYN',
  TR: 'TRY',
  MD: 'MDL',
  AL: 'ALL',
  MK: 'MKD',
  BA: 'BAM',
  GE: 'GEL',
  AM: 'AMD',
  AZ: 'AZN',
  KZ: 'KZT',
  // Asie, Moyen-Orient, Océanie
  CN: 'CNY',
  JP: 'JPY',
  KR: 'KRW',
  IN: 'INR',
  PK: 'PKR',
  BD: 'BDT',
  LK: 'LKR',
  NP: 'NPR',
  ID: 'IDR',
  MY: 'MYR',
  SG: 'SGD',
  TH: 'THB',
  VN: 'VND',
  PH: 'PHP',
  HK: 'HKD',
  TW: 'TWD',
  AU: 'AUD',
  NZ: 'NZD',
  AE: 'AED',
  SA: 'SAR',
  QA: 'QAR',
  KW: 'KWD',
  BH: 'BHD',
  OM: 'OMR',
  JO: 'JOD',
  LB: 'LBP',
  IL: 'ILS',
  IR: 'IRR',
  IQ: 'IQD',
};

/**
 * Le symbole d'une monnaie, quand il en existe un reconnaissable.
 *
 * Une monnaie sans entrée ici s'affiche avec son code ISO derrière le
 * montant (« 1 200 MAD »), ce qui est correct et sans ambiguïté. Mieux
 * vaut un code qu'un symbole que personne ne reconnaît.
 */
const SYMBOLES: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  KRW: '₩',
  NGN: '₦',
  RUB: '₽',
  TRY: '₺',
  ILS: '₪',
  PHP: '₱',
  VND: '₫',
  THB: '฿',
  GHS: '₵',
  KZT: '₸',
  PYG: '₲',
  LAK: '₭',
  MNT: '₮',
  CRC: '₡',
  UAH: '₴',
};

/** La monnaie lue dans ce pays, ou `null` si on ne sait pas. */
export function deviseDuPays(pays: string): string | null {
  return MONNAIE_DU_PAYS[pays.toUpperCase()] ?? null;
}

/** 0 pour les monnaies sans sous-unité, 2 sinon. */
export function decimalesDe(code: string): 0 | 2 {
  return SANS_CENTIMES.has(code) ? 0 : 2;
}

/** Le symbole, ou `''` — dans ce cas, afficher le code ISO. */
export function symboleDe(code: string): string {
  return SYMBOLES[code] ?? '';
}
