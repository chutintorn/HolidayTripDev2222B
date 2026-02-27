// src/components/MinPriceSummary.jsx
import React from "react";

const fmt = (n, currency = "THB") => {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return `${currency} ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * A small UI block to show "Minimum price" like the HTML mock.
 *
 * Props:
 * - currency
 * - minTotal
 * - minDepart (optional)
 * - minReturn (optional)
 */
export default function MinPriceSummary({
  currency = "THB",
  minTotal = null,
  minDepart = null,
  minReturn = null,
  className = "",
}) {
  const hasSplit = minDepart !== null || minReturn !== null;

  return (
    <div className={"text-center " + className}>
      <div className="text-[11px] text-slate-600">Minimum price</div>
      <div className="flex items-center justify-center gap-2 mt-0.5">
        <div className="text-[18px] font-extrabold text-[#0b4f8a]">{fmt(minTotal, currency) || "—"}</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e9f2ff] border border-[#c8defa] text-[#0b4f8a]">
          {currency}
        </span>
      </div>

      {hasSplit && (
        <div className="mt-1 text-[10px] text-slate-600 flex items-center justify-center gap-3">
          <span>Depart: {fmt(minDepart, currency) || "—"}</span>
          <span className="text-slate-300">|</span>
          <span>Return: {fmt(minReturn, currency) || "—"}</span>
        </div>
      )}
    </div>
  );
}