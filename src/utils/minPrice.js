// src/utils/minPrice.js
import { flattenFlights } from "./flattenFlights";

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return NaN;

  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;

  if (typeof v === "object") {
    const maybe =
      v.amount ?? v.value ?? v.total ?? v.price ?? v.fare ?? v.includingTax;
    return toNum(maybe);
  }

  if (typeof v === "string") {
    const cleaned = v
      .trim()
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }

  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const getRowPrice = (r) => {
  const candidates = [
    // your usual keys
    r?.fareAmountIncludingTax,
    r?.totalAmount,
    r?.totalFare,
    r?.amount,
    r?.price,
    r?.fare,
    r?.grandTotal,
    r?.total,

    // common nested keys
    r?.pricing,
    r?.pricing?.total,
    r?.pricing?.amount,
    r?.pricing?.grandTotal,
    r?.pricing?.fareAmountIncludingTax,

    // fallback: sometimes called "display" or "summary"
    r?.summary?.total,
    r?.summary?.amount,
  ];

  for (const c of candidates) {
    const n = toNum(c);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
};

const minOfRows = (rows) => {
  let min = Infinity;
  for (const r of rows || []) {
    const n = getRowPrice(r);
    if (Number.isFinite(n) && n < min) min = n;
  }
  return min === Infinity ? null : min;
};

const pickCurrency = (results) =>
  results?.currency || results?.data?.currency || results?.data?.[0]?.currency || "THB";

const pickToken = (results) =>
  results?.securityToken || results?.data?.securityToken || results?.data?.[0]?.securityToken || "";

/**
 * Robust row extraction:
 * - Round-trip: flattenFlights(results) works
 * - One-way: sometimes API returns results.data[0] as the actual payload
 */
const getAllRows = (results) => {
  const token = pickToken(results);

  // try common containers in order
  const containers = [
    results,
    results?.data,
    Array.isArray(results?.data) ? results.data[0] : null, // ✅ key for one-way mismatch
  ].filter(Boolean);

  for (const c of containers) {
    try {
      const rows = flattenFlights(c, token);
      if (Array.isArray(rows) && rows.length) return rows;
    } catch {
      // continue
    }
  }

  return [];
};

export function getMinPriceSummary(results, opts = {}) {
  const tripType = String(opts.tripType || "oneway").toLowerCase();
  const currency = pickCurrency(results);

  const rows = getAllRows(results);

  if (tripType !== "roundtrip") {
    return { currency, minTotal: minOfRows(rows) };
  }

  const o = String(opts.origin || "").trim().toUpperCase();
  const d = String(opts.destination || "").trim().toUpperCase();

  if (!o || !d) {
    const minTotal = minOfRows(rows);
    return { currency, minDepart: null, minReturn: null, minTotal };
  }

  const departRows = rows.filter(
    (r) =>
      String(r?.origin || "").toUpperCase() === o &&
      String(r?.destination || "").toUpperCase() === d
  );
  const returnRows = rows.filter(
    (r) =>
      String(r?.origin || "").toUpperCase() === d &&
      String(r?.destination || "").toUpperCase() === o
  );

  const minDepart = minOfRows(departRows);
  const minReturn = minOfRows(returnRows);

  const minTotal =
    Number.isFinite(minDepart) && Number.isFinite(minReturn)
      ? minDepart + minReturn
      : minOfRows(rows);

  return { currency, minDepart, minReturn, minTotal };
}