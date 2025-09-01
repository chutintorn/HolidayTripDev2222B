// src/components/JourneyTable.jsx
import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectResults } from "../redux/searchSlice";
import {
  fetchPriceDetail,
  selectPriceFor,
  selectPricingStatus,
} from "../redux/pricingSlice";
import { flattenFlights } from "../utils/flattenFlights";

/** ---- Local-safe date helpers ---- */
const ymd = (s) => (typeof s === "string" && s.length >= 10 ? s.slice(0, 10) : "");
const toLocalDate = (s) => {
  const dstr = ymd(s);
  if (!dstr) return null;
  const y = Number(dstr.slice(0, 4));
  const m = Number(dstr.slice(5, 7)) - 1; // 0-based
  const d = Number(dstr.slice(8, 10));
  const date = new Date(y, m, d); // local midnight
  return isNaN(date) ? null : date;
};

/** ---- Currency helper ---- */
const fmtMoney = (n, currency = "THB") => {
  if (n === "" || n === null || n === undefined) return "";
  const num = Number(n);
  if (!isFinite(num)) return "";
  return `${currency} ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * JourneyTable
 *
 * Props:
 * - resultsOverride?: object | array
 *     When provided (e.g., one leg/day from a round-trip response),
 *     the table renders rows based on this object instead of the global store.
 *
 * - currencyOverride?: string
 * - securityTokenOverride?: string
 * - titleOverride?: string    // optional text shown left of the route header
 * - hideHeader?: boolean      // hide the top header line with route+date
 */
export default function JourneyTable({
  resultsOverride = null,
  currencyOverride,
  securityTokenOverride,
  titleOverride,
  hideHeader = false,
}) {
  const dispatch = useDispatch();

  // Global results from Redux (fallbacks for token/currency)
  const globalResults = useSelector(selectResults);

  // Choose which results to render: per-leg override or global
  const raw = resultsOverride ?? globalResults;

  // Common top-level fields most backends include
  const currency =
    currencyOverride || raw?.currency || globalResults?.currency || "THB";

  const securityToken =
    securityTokenOverride ||
    raw?.securityToken ||
    globalResults?.securityToken ||
    "";

  // Many APIs wrap arrays under `data`. If not, use the object/array directly.
  // We'll normalize to an array for the A-branch of flattenFlights.
  const payload = raw?.data ?? raw;

  // Build display rows from the raw payload and keep only well-formed rows.
  const rows = useMemo(() => {
    if (!payload) return [];
    const input = Array.isArray(payload) ? payload : [payload];
    const out = flattenFlights(input, securityToken) || [];
    return out.filter((r) => r && r.id && (r.origin || r.destination));
  }, [payload, securityToken]);

  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedFare, setSelectedFare] = useState(null);

  // If empty, show a helpful hint (keeps layout stable)
  if (!rows.length) {
    return (
      <div className="mt-6 rounded-xl border bg-amber-50 text-amber-900 p-4">
        No flights to display. The response may be empty or in an unexpected format.
      </div>
    );
  }

  /** Columns to render */
  const cols = [
    "departureTime",
    "arrivalTime",
    "duration",
    "flightNumber",
    "aircraftDescription",
    "fareAmountIncludingTax",
    "nokXtraAmount",
    "nokMaxAmount",
  ];

  const label = (col) => {
    if (col === "fareAmountIncludingTax") return "Nok Lite";
    if (col === "nokXtraAmount") return "Nok X-TRA";
    if (col === "nokMaxAmount") return "Nok MAX";
    if (col === "departureTime") return "Departure";
    if (col === "arrivalTime") return "Arrival";
    if (col === "flightNumber") return "Flight";
    if (col === "aircraftDescription") return "Aircraft";
    return col;
  };

  /** Fare selection */
  const pickFare = (row, col) => {
    let fareKey = "";
    if (col === "fareAmountIncludingTax") fareKey = row.fareKey; // LITE
    else if (col === "nokXtraAmount") fareKey = row.farekey1; // X-TRA
    else if (col === "nokMaxAmount") fareKey = row.farekey2; // MAX
    if (!fareKey) return;

    setSelectedRow(row);
    setSelectedFare({
      fareKey,
      journeyKey: row.journeyKey,
      securityToken: row.securityToken || securityToken,
      currency,
    });
  };

  /** Go to pricing */
  const onNext = () => {
    if (!selectedFare) return;
    dispatch(
      fetchPriceDetail({
        offer: {
          id: selectedFare.fareKey,
          fareKey: selectedFare.fareKey,
          journeyKey: selectedFare.journeyKey,
          securityToken: selectedFare.securityToken,
        },
      })
    );
  };

  /** Header date (local-safe) */
  const depDate = toLocalDate(rows[0]?.departureDate);
  const ddMMM = depDate
    ? depDate
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        .toUpperCase()
    : "";
  const dow = depDate
    ? depDate.toLocaleDateString("en-GB", { weekday: "short" })
    : "";
  const dowColors = {
    Mon: "#FFD700",
    Tue: "#FF69B4",
    Wed: "#32CD32",
    Thu: "#FFA500",
    Fri: "#00BFFF",
    Sat: "#CF9FFF",
    Sun: "#FF4500",
  };

  const statusKey = selectedFare?.fareKey || "";
  const selectedStatus = useSelector(selectPricingStatus(statusKey));
  const selectedDetail = useSelector(selectPriceFor(statusKey));

  return (
    <div className="journey-table-wrapper w-full">
      {!hideHeader && (
        <h2 className="ml-3 mb-2 text-blue-600 flex items-center gap-2 flex-wrap">
          {titleOverride && (
            <span className="text-slate-700 text-sm font-semibold">
              {titleOverride}
            </span>
          )}
          <span>
            {rows[0]?.origin} → {rows[0]?.destination}
          </span>
          {ddMMM && (
            <>
              <span className="text-slate-700 text-sm">{ddMMM}</span>
              <span
                className="text-sm font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: "#000",
                  color: dowColors[dow] || "#FFF",
                }}
              >
                {dow}
              </span>
            </>
          )}
        </h2>
      )}

      {/* Full-width table with horizontal scroll when needed */}
      <div className="w-full overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-100">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-semibold">
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t last:border-b-0">
                {cols.map((col) => {
                  const selectable = [
                    "fareAmountIncludingTax",
                    "nokXtraAmount",
                    "nokMaxAmount",
                  ].includes(col);

                  const isSelected =
                    selectedRow?.id === row.id &&
                    selectedFare?.fareKey ===
                      (col === "fareAmountIncludingTax"
                        ? row.fareKey
                        : col === "nokXtraAmount"
                        ? row.farekey1
                        : row.farekey2);

                  const val = row[col];
                  const priceText = selectable ? fmtMoney(val, currency) : "";

                  return (
                    <td
                      key={col}
                      onClick={() => selectable && pickFare(row, col)}
                      className={[
                        "px-3 py-2",
                        selectable ? "font-semibold cursor-pointer" : "",
                        isSelected ? "bg-yellow-200" : "",
                      ].join(" ")}
                    >
                      {priceText || val || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-end gap-3">
        {selectedStatus === "loading" && (
          <div className="text-sm text-slate-600">Loading price…</div>
        )}
        {selectedStatus === "failed" && (
          <div className="text-sm text-red-600">Failed to load price.</div>
        )}
        {selectedStatus === "succeeded" && selectedDetail && (
          <div className="text-sm font-medium">
            Total: {selectedDetail.currency || selectedFare.currency}{" "}
            {selectedDetail.total?.toLocaleString?.()}
          </div>
        )}
        <button
          onClick={onNext}
          disabled={!selectedFare || selectedStatus === "loading"}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          NEXT
        </button>
      </div>
    </div>
  );
}
