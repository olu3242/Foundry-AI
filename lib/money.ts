/** Amounts are stored as integers in the currency's minor unit (kobo, pesewas; XOF/RWF have none). */
const exponentCache = new Map<string, number>();

export function currencyExponent(currency: string) {
  let exp = exponentCache.get(currency);
  if (exp === undefined) {
    exp = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    exponentCache.set(currency, exp);
  }
  return exp;
}

export function toMinor(amount: number, currency: string) {
  return Math.round(amount * 10 ** currencyExponent(currency));
}

export function fromMinor(minor: number, currency: string) {
  return minor / 10 ** currencyExponent(currency);
}

export function formatMoney(minor: number, currency: string, locale = "en") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(
    fromMinor(minor, currency),
  );
}
