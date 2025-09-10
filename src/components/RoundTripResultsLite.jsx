// src/components/RoundTripResultsLite.jsx
import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { selectResults } from "../redux/searchSlice";
import { flattenFlights } from "../utils/flattenFlights";
import {
  fetchPriceDetail,
  selectPriceFor,
  selectPricingStatus,
} from "../redux/pricingSlice";

/* ---------- Helpers ---------- */
const ymd = (s) => (typeof s === "string" && s.length >= 10 ? s.slice(0, 10) : "");
const toLocalDate = (s) => {
  const d = ymd(s);
  if (!d) return null;
  const date = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
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

const dowColors = {
  Mon: "#FFD700",
  Tue: "#FF69B4",
  Wed: "#32CD32",
  Thu: "#FFA500",
  Fri: "#00BFFF",
  Sat: "#CF9FFF",
  Sun: "#FF4500",
};

/** Build header display bits from the first row of a leg */
function getHeaderParts(rows) {
  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first) {
    return { origin: "", destination: "", ddMMM: "", dow: "", chipColor: "#FFF" };
  }
  const depDate = toLocalDate(first?.departureDate);
  const ddMMM = depDate
    ? depDate
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        .toUpperCase()
    : "";
  const dow = depDate ? depDate.toLocaleDateString("en-GB", { weekday: "short" }) : "";
  return {
    origin: first?.origin || "",
    destination: first?.destination || "",
    ddMMM,
    dow,
    chipColor: dowColors[dow] || "#FFF",
  };
}

/* ---------- One leg box (table + optional inline NEXT) ---------- */
function LegBox({
  title,
  rows,
  currency = "THB",
  fallbackToken = "",
  onSelect,            // (selection|null) => void
  showInlineNext = false,
  onInlineNext,        // () => void
  inlinePriceKey = "", // request key for pricing state when inline button is shown
}) {
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedFareKey, setSelectedFareKey] = useState(null);

  const inlineStatus = useSelector(selectPricingStatus(inlinePriceKey));
  const inlineDetail = useSelector(selectPriceFor(inlinePriceKey));

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
    if (col === "fareAmountIncludingTax") fareKey = row.fareKey;   // LITE
    else if (col === "nokXtraAmount")     fareKey = row.farekey1;  // X-TRA
    else if (col === "nokMaxAmount")      fareKey = row.farekey2;  // MAX
    if (!fareKey) return;

    // toggle off if clicked again
    if (selectedRow?.id === row.id && selectedFareKey === fareKey) {
      setSelectedRow(null);
      setSelectedFareKey(null);
      onSelect?.(null);
      return;
    }

    const selection = {
      fareKey,
      journeyKey: row.journeyKey,
      securityToken: row.securityToken || fallbackToken,
      currency,
      row,
    };

    setSelectedRow(row);
    setSelectedFareKey(fareKey);
    onSelect?.(selection);
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="w-full rounded-2xl border bg-white overflow-hidden shadow-sm p-4 text-sm text-slate-600">
        No flights for this leg.
      </div>
    );
  }

  // Build header parts (origin → dest, date, DOW chip)
  const hdr = getHeaderParts(rows);

  return (
    <div className="w-full rounded-2xl border bg-white overflow-hidden shadow-sm">
      {/* Title + header line */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap">
        {title && <div className="text-slate-700 font-semibold">{title}</div>}
        {(hdr.origin || hdr.destination) && (
          <div className="text-blue-600 font-semibold">
            {hdr.origin} → {hdr.destination}
          </div>
        )}
        {hdr.ddMMM && <span className="text-slate-700 text-sm">{hdr.ddMMM}</span>}
        {hdr.dow && (
          <span
            className="text-sm font-semibold px-2 py-0.5 rounded"
            style={{ backgroundColor: "#000", color: hdr.chipColor }}
          >
            {hdr.dow}
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
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
            {rows.map((row, idx) => (
              <tr
                key={row.id || `${row.flightNumber}-${row.departureTime}-${idx}`}
                className="border-t last:border-b-0"
              >
                {cols.map((col) => {
                  const selectable = [
                    "fareAmountIncludingTax",
                    "nokXtraAmount",
                    "nokMaxAmount",
                  ].includes(col);

                  const isSelected =
                    selectedRow?.id === row.id &&
                    selectedFareKey ===
                      (col === "fareAmountIncludingTax"
                        ? row.fareKey
                        : col === "nokXtraAmount"
                        ? row.farekey1
                        : row.farekey2);

                  const val = row[col];
                  const display = selectable ? fmtMoney(val, currency) : (val ?? "—");

                  return (
                    <td
                      key={col}
                      onClick={() => selectable && pickFare(row, col)}
                      className={[
                        "px-3 py-2 align-top",
                        selectable ? "font-semibold cursor-pointer" : "",
                        isSelected ? "bg-yellow-200" : "",
                      ].join(" ")}
                      title={selectable ? "Click to select fare" : undefined}
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

      {/* Inline NEXT for one-way */}
      {showInlineNext && (
        <div className="px-4 py-3 flex items-center justify-end gap-3 border-t">
          {inlineStatus === "loading" && (
            <div className="text-sm text-slate-600">Getting offers…</div>
          )}
          {inlineStatus === "failed" && (
            <div className="text-sm text-red-600">Failed to load price.</div>
          )}
          {inlineStatus === "succeeded" && inlineDetail && (
            <div className="text-sm font-medium">
              {typeof inlineDetail.total !== "undefined"
                ? `Total: ${fmtMoney(inlineDetail.total, inlineDetail.currency || currency)}`
                : "Pricing available."}
            </div>
          )}
          <button
            onClick={onInlineNext}
            disabled={!selectedFareKey || inlineStatus === "loading"}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {inlineStatus === "loading" ? "Please wait…" : "NEXT"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Main (one-way = inline NEXT; roundtrip = unified NEXT) ---------- */
export default function RoundTripResultsLite() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const raw = useSelector(selectResults);

  // Unwrap common API shapes
  const payload = raw?.data ?? raw;
  const token = raw?.securityToken || payload?.securityToken || "";
  const currency = raw?.currency || "THB";

  // Flatten once
  const rows = useMemo(() => {
    if (!payload) return [];
    const input = Array.isArray(payload) ? payload : [payload];
    const out = flattenFlights(input, token) || [];
    return out.filter((r) => r && (r.id || r.flightNumber) && (r.origin || r.destination));
  }, [payload, token]);

  if (!rows.length) {
    return (
      <div className="mt-6 rounded-xl border bg-amber-50 text-amber-900 p-4">
        No flights to display.
      </div>
    );
  }

  /* Group by direction first */
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
      { title: "Depart", rows: dirEntries[0].rows },
      { title: "Return", rows: dirEntries[1].rows },
    ];
  } else if (dirEntries.length === 1) {
    groups = [{ title: "Depart", rows: dirEntries[0].rows }];
  } else {
    groups = [{ title: "Depart", rows }];
  }

  // Track selections
  const [selectedOutbound, setSelectedOutbound] = useState(null);
  const [selectedInbound, setSelectedInbound] = useState(null);

  const isRoundTrip = groups.length === 2;

  /* ---------- ONE-WAY: inline NEXT inside the leg box ---------- */
  if (!isRoundTrip) {
    // requestKey convention (one-way): fareKey
    const requestKey = selectedOutbound?.fareKey || "";

    const doInlineNext = async () => {
      if (!selectedOutbound) return;
      try {
        await dispatch(fetchPriceDetail({ offers: [selectedOutbound] })).unwrap();
        // Navigate to detail page with requestKey so page can read from Redux
        navigate("/skyblue-price-detail", { state: { requestKey } });
        // Or: navigate(`/skyblue-price-detail?key=${encodeURIComponent(requestKey)}`);
      } catch (e) {
        console.error("Pricing failed", e);
      }
    };

    return (
      <div className="w-full flex flex-col gap-6 mt-4">
        <LegBox
          title="Depart"
          rows={groups[0].rows}
          currency={currency}
          fallbackToken={token}
          onSelect={setSelectedOutbound}
          showInlineNext={true}
          onInlineNext={doInlineNext}
          inlinePriceKey={requestKey}
        />
      </div>
    );
  }

  /* ---------- ROUNDTRIP: unified NEXT below both boxes ---------- */
  const canProceed = !!(selectedOutbound && selectedInbound);

  // requestKey convention (roundtrip): fareKeyA+fareKeyB
  const requestKey = useMemo(() => {
    const a = selectedOutbound?.fareKey || "";
    const b = selectedInbound?.fareKey || "";
    return [a, b].filter(Boolean).join("+") || "";
  }, [selectedOutbound, selectedInbound]);

  const pricingStatus = useSelector(selectPricingStatus(requestKey));
  const priceDetail   = useSelector(selectPriceFor(requestKey));

  const handleUnifiedNext = async () => {
    if (!canProceed || pricingStatus === "loading") return;
    try {
      await dispatch(
        fetchPriceDetail({ offers: [selectedOutbound, selectedInbound] })
      ).unwrap();

      // Navigate to detail page with requestKey so page can read from Redux
      navigate("/skyblue-price-detail", { state: { requestKey } });
      // Or: navigate(`/skyblue-price-detail?key=${encodeURIComponent(requestKey)}`);
    } catch (e) {
      console.error("Pricing failed", e);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 mt-4">
      <LegBox
        title="Depart"
        rows={groups[0].rows}
        currency={currency}
        fallbackToken={token}
        onSelect={setSelectedOutbound}
      />

      <LegBox
        title="Return"
        rows={groups[1].rows}
        currency={currency}
        fallbackToken={token}
        onSelect={setSelectedInbound}
      />

      <div className="mt-2 flex items-center justify-between rounded-xl border bg-white p-3 shadow">
        <div className="text-sm text-gray-600">
          {selectedOutbound ? "✓ Departure selected" : "• Choose a departure"}{" "}
          &nbsp;&nbsp;
          {selectedInbound ? "✓ Return selected" : "• Choose a return"}
          {pricingStatus === "loading" && (
            <span className="ml-3 text-blue-600">Getting offers…</span>
          )}
        </div>

        <button
          className={`px-4 py-2 rounded-lg font-semibold ${
            canProceed && pricingStatus !== "loading"
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-300 text-gray-600"
          }`}
          disabled={!canProceed || pricingStatus === "loading"}
          onClick={handleUnifiedNext}
        >
          {pricingStatus === "loading" ? "Please wait…" : "NEXT"}
        </button>
      </div>

      {pricingStatus === "succeeded" && priceDetail && (
        <div className="rounded-xl border bg-slate-50 p-3 text-sm">
          <div className="font-semibold mb-2">Offer loaded</div>
          {typeof priceDetail.total !== "undefined" ? (
            <div>
              Total: {fmtMoney(priceDetail.total, priceDetail.currency || currency)}
            </div>
          ) : (
            <div>Pricing available.</div>
          )}
        </div>
      )}
    </div>
  );
}
