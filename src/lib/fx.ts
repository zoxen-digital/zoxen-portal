/**
 * Exchange rates for totals that mix currencies (e.g. a PKR invoice on a USD dashboard).
 * Live rates from open.er-api.com (free, no key, updated daily), cached for 12 hours.
 * If the service is down, rough fallback rates keep totals sensible instead of adding PKR as dollars.
 */

type Rates = Record<string, number>; // units of each currency per 1 USD

const FALLBACK: Rates = { USD: 1, PKR: 280, CAD: 1.37, GBP: 0.78, AED: 3.67, EUR: 0.92, SAR: 3.75 };
const TTL = 12 * 60 * 60 * 1000;
const g = globalThis as unknown as { _zxFx?: { rates: Rates; at: number; live: boolean } };

export async function getRates(): Promise<{ rates: Rates; live: boolean }> {
  if (g._zxFx && Date.now() - g._zxFx.at < TTL) return g._zxFx;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000), next: { revalidate: 43200 } });
    const data = (await res.json()) as { result?: string; rates?: Rates };
    if (data.result === "success" && data.rates?.PKR) {
      g._zxFx = { rates: { ...FALLBACK, ...data.rates }, at: Date.now(), live: true };
      return g._zxFx;
    }
  } catch {
    // fall through to fallback
  }
  // Retry the live source in 30 minutes, not 12 hours.
  g._zxFx = { rates: FALLBACK, at: Date.now() - TTL + 30 * 60 * 1000, live: false };
  return g._zxFx;
}

/** A converter into `to`, e.g. const toUsd = await converter("USD"); toUsd(8000, "PKR") ~ 28.6 */
export async function converter(to: string) {
  const { rates, live } = await getRates();
  const fn = (amount: number, from?: string) => {
    const f = rates[from || to];
    const t = rates[to];
    if (!amount || !f || !t || (from || to) === to) return amount || 0;
    return (amount / f) * t;
  };
  return Object.assign(fn, { live, rate: (from: string) => (rates[to] && rates[from] ? rates[from]! / rates[to]! : null) });
}
