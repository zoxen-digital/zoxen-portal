export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CAD: "CA$",
  GBP: "£",
  EUR: "€",
  PKR: "Rs",
  AED: "AED",
  SAR: "SAR",
};

export function currencySymbol(currency = "PKR") {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** e.g. $1,250.50 · Rs 67,000 · £80 · AED 500 */
export function formatMoney(value: number | undefined, currency = "PKR") {
  const v = value || 0;
  const sym = currencySymbol(currency);
  const decimals = Number.isInteger(Math.round(Math.abs(v) * 100) / 100) ? 0 : 2;
  const num = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: 2 }).format(Math.abs(v));
  const space = /[A-Za-z]$/.test(sym) ? " " : "";
  return `${v < 0 ? "-" : ""}${sym}${space}${num}`;
}

export function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function toInputDate(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Converts Mongoose lean docs (ObjectIds, Dates) into plain JSON for client components. */
export function serialize<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isOverdue(dueDate?: string | Date | null, done?: boolean) {
  if (!dueDate || done) return false;
  const d = new Date(dueDate);
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
