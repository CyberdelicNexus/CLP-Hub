/**
 * Country of residence (D-153): asked on the public application form so the
 * team can tell applicants living in Spain from those who are not. Stored as an
 * ISO 3166-1 alpha-2 code, never free text; names come from the runtime's
 * `Intl.DisplayNames`, so the list needs no translation files.
 *
 * It is a fact to filter by, not a rule: nothing here or anywhere else decides
 * eligibility from it (CLAUDE.md rule 3). Staff read it and decide.
 */

export const SPAIN = "ES";

/** ISO 3166-1 alpha-2, officially assigned codes. */
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const CODE_SET = new Set(COUNTRY_CODES);

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && CODE_SET.has(value);
}

/** The country's name in `locale` ("es", "en", "gl"); the code itself if the runtime has no name. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale, "es"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Options for a country picker: Spain first, then the rest by name in `locale`. */
export function countryOptions(locale: string): { code: string; name: string }[] {
  const collator = new Intl.Collator(locale);
  const rest = COUNTRY_CODES.filter((c) => c !== SPAIN)
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name));
  return [{ code: SPAIN, name: countryName(SPAIN, locale) }, ...rest];
}

/** The staff filter: living in Spain, elsewhere, or not given yet. URL values are Spanish. */
export const RESIDENCE_FILTERS = ["espana", "fuera", "sin-indicar"] as const;
export type ResidenceFilter = (typeof RESIDENCE_FILTERS)[number];

export function isResidenceFilter(value: unknown): value is ResidenceFilter {
  return typeof value === "string" && (RESIDENCE_FILTERS as readonly string[]).includes(value);
}

export function residenceGroup(code: string | null | undefined): ResidenceFilter {
  if (!code) return "sin-indicar";
  return code === SPAIN ? "espana" : "fuera";
}
