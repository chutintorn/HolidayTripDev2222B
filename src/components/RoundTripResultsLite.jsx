// src/components/RoundTripResultsLite.jsx
import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectResults } from "../redux/searchSlice";
import { flattenFlights } from "../utils/flattenFlights";
import {
  fetchPriceDetail,
  selectPriceFor,
  selectPricingStatus,
} from "../redux/pricingSlice";

/* ---------- Helpers (local-safe date + formatting) ---------- */
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
const byAscDate = (a, b) =>
  (a.minDate?.getTime?.() ?? 0) - (b.minDate?.getTime?.() ?? 0);

const fmtMoney = (n, currency = "THB") => {
  if (n === "" || n === null || n === undefined) return "";
  const num = Number(n);
  if (!isFinite(num)) return "";
  return `${currency} ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/* ---------- One leg box (table + selection; no per-leg NEXT) ---------- */
function LegBox({
  title,
  rows,
  currency = "THB",
  fallbackToken = "",
  onSelect,            // (selection) => void
  showNextButton = false, // keep compatibility; default off
  onNext,             // optional internal next if showNextButton=true
}) {
  const dispatch = useDispatch();
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedFare, setSelectedFare] = useState(null);

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

  const pickFare = (row, col) => {
    let fareKey = "";
    let brand = "";
    if (col === "fareAmountIncludingTax") {
      fareKey = row.fareKey;  // LITE
      brand = "LITE";
    } else if (col === "nokXtraAmount") {
      fareKey = row.farekey1; // X-TRA
      brand = "XTRA";
    } else if (col === "nokMaxAmount") {
      fareKey = row.farekey2; // MAX
      brand = "MAX";
    }
    if (!fareKey) return;

    const selection = {
      brand,
      fareKey,
      journeyKey: row.journeyKey,
      securityToken: row.securityToken || fallbackToken,
      currency,
      row, // expose full row (origin, destination, times, etc.)
    };

    setSelectedRow(row);
    setSelectedFare(selection);
    if (typeof onSelect === "function") onSelect(selection);
  };

  // Only used if showNextButton=true (legacy behavior)
  const handleInternalNext = () => {
    if (!selectedFare) return;
    const payload = {
      offer: {
        id: selectedFare.fareKey,
        fareKey: selectedFare.fareKey,
        journeyKey: selectedFare.journeyKey,
        securityToken: selectedFare.securityToken,
      },
    };
    if (typeof onNext === "function") {
      onNext(selectedFare);
    } else {
      dispatch(fetchPriceDetail(payload));
    }
  };

  const statusKey = selectedFare?.fareKey || "";
  const selectedStatus = useSelector(selectPricingStatus(statusKey));
  const selectedDetail = useSelector(selectPriceFor(statusKey));

  // Header date chip
  const d0 = toLocalDate(rows?.[0]?.departureDate);
  const ddMMM = d0
    ? d0.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase()
    : "";
  const dow = d0 ? d0.toLocaleDateString("en-GB", { weekday: "short" }) : "";
  const dowColors = {
    Mon: "#FFD700",
    Tue: "#FF69B4",
    Wed: "#32CD32",
    Thu: "#FFA500",
    Fri: "#00BFFF",
    Sat: "#CF9FFF",
    Sun: "#FF4500",
  };

  return (
    <div className="w-full rounded-2xl border bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap">
        <span className="text-blue-600 font-semibold">{title}</span>
        <span className="text-slate-700 text-sm">
          {rows?.[0]?.origin} → {rows?.[0]?.destination}
        </span>
        {ddMMM && (
          <div className="flex items-center gap-2">
            <span className="text-slate-700 text-xs md:text-sm">{ddMMM}</span>
            <span
              className="text-[11px] md:text-xs font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: "#000", color: dowColors[dow] || "#FFF" }}
            >
              {dow}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-100 sticky top-0">
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
                  const display = selectable ? fmtMoney(val, currency) : val || "—";

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
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Optional per-leg footer (kept for backward compatibility; OFF by default) */}
      {showNextButton && (
        <div className="px-4 py-3 flex items-center justify-end gap-3">
          {selectedStatus === "loading" && (
            <div className="text-sm text-slate-600">Loading price…</div>
          )}
          {selectedStatus === "failed" && (
            <div className="text-sm text-red-600">Failed to load price.</div>
          )}
          {selectedStatus === "succeeded" && selectedDetail && (
            <div className="text-sm font-medium">
              Total: {selectedDetail.currency || selectedFare?.currency}{" "}
              {selectedDetail.total?.toLocaleString?.()}
            </div>
          )}
          <button
            onClick={handleInternalNext}
            disabled={!selectedFare || selectedStatus === "loading"}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            NEXT
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Main: split full results, capture selections, ONE NEXT ---------- */
export default function RoundTripResultsLite({ onNext }) {
  const dispatch = useDispatch();
  const raw = useSelector(selectResults);

  // Unwrap common API shapes
  const payload = raw?.data ?? raw;
  const token = raw?.securityToken || payload?.securityToken || "";
  const currency = raw?.currency || "THB";

  // Flatten once (supports days[].journey[] and itineraries[].offers[])
  const rows = useMemo(() => {
    if (!payload) return [];
    const input = Array.isArray(payload) ? payload : [payload];
    const out = flattenFlights(input, token) || [];
    // Keep only well-formed rows
    return out.filter((r) => r && r.id && (r.origin || r.destination));
  }, [payload, token]);

  if (!rows.length) {
    return (
      <div className="mt-6 rounded-xl border bg-amber-50 text-amber-900 p-4">
        No flights to display. The response may be empty or in an unexpected format.
      </div>
    );
  }

  /**
   * Group strategy:
   *  1) Prefer direction split: "DMK-CNX" vs "CNX-DMK"
   *  2) If only one direction exists, split by earliest two distinct dates
   *  3) Fallback: first half as Depart, second half as Return
   */
  const byDirMap = rows.reduce((acc, r) => {
    const dir = `${(r.origin || "").trim()}-${(r.destination || "").trim()}`;
    (acc[dir] ||= []).push(r);
    return acc;
  }, {});

  let groups = [];

  const dirEntries = Object.entries(byDirMap)
    .filter(([k]) => !!k && k !== "-")
    .map(([key, arr]) => {
      const minDate =
        arr
          .map((x) => toLocalDate(x.departureDate))
          .filter(Boolean)
          .sort((a, b) => a - b)[0] || null;
      return { key, rows: arr, minDate };
    })
    .sort(byAscDate);

  if (dirEntries.length >= 2) {
    groups = [
      { title: "Depart", rows: dirEntries[0].rows, minDate: dirEntries[0].minDate },
      { title: "Return", rows: dirEntries[1].rows, minDate: dirEntries[1].minDate },
    ];
  } else {
    // Only one direction -> split by date
    const byDateMap = rows.reduce((acc, r) => {
      const key = ymd(r.departureDate) || "unknown-date";
      (acc[key] ||= []).push(r);
      return acc;
    }, {});

    const dateEntries = Object.entries(byDateMap)
      .map(([k, arr]) => ({
        key: k,
        rows: arr,
        minDate: toLocalDate(k),
      }))
      .sort(byAscDate);

    if (dateEntries.length >= 2) {
      groups = [
        { title: "Depart", rows: dateEntries[0].rows, minDate: dateEntries[0].minDate },
        { title: "Return", rows: dateEntries[1].rows, minDate: dateEntries[1].minDate },
      ];
    } else {
      // Fallback: split list in half
      const mid = Math.ceil(rows.length / 2);
      groups = [
        { title: "Depart", rows: rows.slice(0, mid), minDate: toLocalDate(rows[0]?.departureDate) },
        { title: "Return", rows: rows.slice(mid),  minDate: toLocalDate(rows[mid]?.departureDate) },
      ].filter((g) => Array.isArray(g.rows) && g.rows.length > 0);
    }
  }

  // Ensure two groups at most
  groups = groups.slice(0, 2);

  if (!groups.length) {
    return (
      <div className="mt-6 rounded-xl border bg-amber-50 text-amber-900 p-4">
        No flights after grouping. The payload may contain only one leg.
      </div>
    );
  }

  // Track selections for each leg
  const [selectedOutbound, setSelectedOutbound] = useState(null);
  const [selectedInbound, setSelectedInbound] = useState(null);

  // Detect whether this is effectively roundtrip (2 groups)
  const isRoundTrip = groups.length >= 2;

  const canProceed = isRoundTrip
    ? !!(selectedOutbound && selectedInbound)
    : !!selectedOutbound;

  const handleUnifiedNext = async () => {
    if (!canProceed) return;

    if (typeof onNext === "function") {
      onNext(selectedOutbound, isRoundTrip ? selectedInbound : null);
      return;
    }

    // Default (backward-compatible) behavior:
    // dispatch pricing for outbound only, so nothing breaks if onNext not wired yet.
    const ob = selectedOutbound;
    if (ob?.fareKey) {
      await dispatch(
        fetchPriceDetail({
          offer: {
            id: ob.fareKey,
            fareKey: ob.fareKey,
            journeyKey: ob.journeyKey,
            securityToken: ob.securityToken,
          },
        })
      );
    }
  };

  // Full width column layout; one unified NEXT footer
  return (
    <div className="w-full flex flex-col gap-6 mt-4">
      {/* Depart */}
      <LegBox
        title={groups[0].title || "Depart"}
        rows={groups[0].rows}
        currency={currency}
        fallbackToken={token}
        onSelect={setSelectedOutbound}
        showNextButton={false}
      />

      {/* Return (if present) */}
      {isRoundTrip && (
        <LegBox
          title={groups[1].title || "Return"}
          rows={groups[1].rows}
          currency={currency}
          fallbackToken={token}
          onSelect={setSelectedInbound}
          showNextButton={false}
        />
      )}

      {/* Unified sticky footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between rounded-xl border bg-white p-3 shadow">
        <div className="text-sm text-gray-600">
          {isRoundTrip ? (
            <>
              {selectedOutbound ? "✓ Departure selected" : "• Choose a departure"}{" "}
              &nbsp;&nbsp;
              {selectedInbound ? "✓ Return selected" : "• Choose a return"}
            </>
          ) : (
            <>{selectedOutbound ? "✓ Flight selected" : "• Choose a flight"}</>
          )}
        </div>

        <button
          className={`px-4 py-2 rounded-lg font-semibold ${
            canProceed
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
          }`}
          disabled={!canProceed}
          onClick={handleUnifiedNext}
        >
          NEXT
        </button>
      </div>
    </div>
  );
}
