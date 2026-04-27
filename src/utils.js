export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function fmtInt(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  return Math.round(Number(x)).toLocaleString("en-US");
}

export function fmtEUR(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  return Number(x).toLocaleString("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function fmtPct(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  return `${(Number(x) * 100).toFixed(1)}%`;
}

export function fmtPctFromMult(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  return `${Math.round(Number(x) * 100)}%`;
}

export function fmtIndex(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  return `${x >= 0 ? "+" : ""}${(Number(x) * 100).toFixed(1)}%`;
}
