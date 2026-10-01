/** Open Exchange Rates quotes units per USD; Foundry stores USD per unit. Bad values are dropped, never guessed. */
export function usdPerUnit(rates: Record<string, unknown>, currencies: string[]) {
  const out: Record<string, number> = {};
  for (const c of currencies) {
    const perUsd = Number(rates[c]);
    if (Number.isFinite(perUsd) && perUsd > 0) out[c] = c === "USD" ? 1 : Number((1 / perUsd).toPrecision(10));
  }
  return out;
}

export function effectiveDate(unixSeconds: unknown) {
  const t = Number(unixSeconds);
  if (!Number.isFinite(t) || t <= 0) throw new Error("FX feed returned no timestamp");
  return new Date(t * 1000).toISOString().slice(0, 10);
}
