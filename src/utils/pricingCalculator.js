/* ===============================
   Standard Airline Pricing Utils
   =============================== */

function n(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

function upper(x) {
  return String(x || "").trim().toUpperCase();
}

function pickArray(obj, keys) {
  for (const k of keys) {
    if (Array.isArray(obj?.[k])) return obj[k];
  }
  return [];
}

function sumTaxes(taxes = []) {
  return taxes.reduce((s, t) => s + n(t.amount ?? t.value ?? t.taxAmount), 0);
}

function sumTaxByCode(taxes = [], code = "VAT") {
  const want = upper(code);
  return taxes
    .filter((t) => upper(t.taxCode ?? t.code ?? t.tax) === want)
    .reduce((s, t) => s + n(t.amount ?? t.value ?? t.taxAmount), 0);
}

function findLineForType(lines = [], paxType) {
  const want = upper(paxType);
  return (
    lines.find((x) => upper(x.paxType ?? x.passengerType ?? x.type) === want) ||
    null
  );
}

/**
 * ✅ Standard airline pricing breakdown
 * - Works with most airline APIs (Radixx / Navitaire / Amadeus-like)
 * - ADT / CHD / INF
 */
export function calcStandardAirlineTotals(priceRaw, paxCounts) {
  const lines =
    pickArray(priceRaw, [
      "fareBreakdown",
      "breakdown",
      "passengerFares",
      "paxFares",
    ]) || [];

  const counts = {
    ADT: n(paxCounts?.adult),
    CHD: n(paxCounts?.child),
    INF: n(paxCounts?.infant),
  };

  const result = {
    perType: {},
    vatTotal: 0,
    grandTotal: 0,
  };

  for (const pt of ["ADT", "CHD", "INF"]) {
    const count = counts[pt];
    if (!count) continue;

    const line = findLineForType(lines, pt) || {};

    const base =
      n(
        line.baseFareAmount ??
          line.baseFare ??
          line.fareAmount ??
          line.fare ??
          line.amount
      );

    const taxesArr = pickArray(line, [
      "taxes",
      "taxDetails",
      "tax",
      "feeDetails",
    ]);

    const taxesAll = sumTaxes(taxesArr);
    const vat = sumTaxByCode(taxesArr, "VAT");

    const unitTotalProvided = n(
      line.totalAmount ?? line.totalFare ?? line.total
    );

    const unitTotal =
      unitTotalProvided > 0 ? unitTotalProvided : base + taxesAll;

    const typeTotal = unitTotal * count;

    result.perType[pt] = {
      paxType: pt,
      count,
      unitBase: base,
      unitTaxes: taxesAll,
      unitVat: vat,
      unitTotal,
      typeTotal,
    };

    result.vatTotal += vat * count;
    result.grandTotal += typeTotal;
  }

  return result;
}
