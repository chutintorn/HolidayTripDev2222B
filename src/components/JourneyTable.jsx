// src/components/JourneyTable.jsx
import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
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
  const m = Number(dstr.slice(5, 7)) - 1;
  const d = Number(dstr.slice(8, 10));
  const date = new Date(y, m, d);
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

export default function JourneyTable({
  resultsOverride = null,
  currencyOverride,
  securityTokenOverride,
  titleOverride,
  hideHeader = false,
  showNextButton = false,
  onSelectRow,
  onNext,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const globalResults = useSelector(selectResults);
  const raw = resultsOverride ?? globalResults;

  const currency =
    currencyOverride || raw?.currency || globalResults?.currency || "THB";
  const securityToken =
    securityTokenOverride ||
    raw?.securityToken ||
    globalResults?.securityToken ||
    "";

  const payload = raw?.data ?? raw;

  const rows = useMemo(() => {
    if (!payload) return [];
    const input = Array.isArray(payload) ? payload : [payload];
    const out = flattenFlights(input, securityToken) || [];
    return out.filter((r) => r && (r.id || r.flightNumber) && (r.origin || r.destination));
  }, [payload, securityToken]);

  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedFare, setSelectedFare] = useState(null);
  const [openId, setOpenId] = useState(null);

  if (!rows.length) {
    return (
      <div className="mt-6 rounded-xl border bg-amber-50 text-amber-900 p-4">
        No flights to display. The response may be empty or in an unexpected format.
      </div>
    );
  }

  const selectLite = (row) => {
    const fareKey = row.fareKey;
    if (!fareKey) return;

    const selection = {
      brand: "LITE",
      fareKey,
      journeyKey: row.journeyKey,
      securityToken: row.securityToken || securityToken,
      currency,
      row,
    };

    setSelectedRow(row);
    setSelectedFare(selection);

    if (typeof onSelectRow === "function") {
      onSelectRow(selection);
    }
  };

  const handleInternalNext = async () => {
    if (!selectedFare?.journeyKey || !selectedFare?.fareKey) return;

    if (typeof onNext === "function") {
      onNext({
        journeyKey: selectedFare.journeyKey,
        fareKey: selectedFare.fareKey,
      });
      return;
    }

    try {
      await dispatch(
        fetchPriceDetail({
          offers: [
            {
              journeyKey: selectedFare.journeyKey,
              fareKey: selectedFare.fareKey,
              securityToken: selectedFare.securityToken,
            },
          ],
          currency,
        })
      ).unwrap();

      const requestKey = selectedFare.fareKey;
      navigate("/skyblue-price-detail", { state: { requestKey } });
    } catch (e) {
      console.error("Pricing failed", e);
    }
  };

  // ===== Day color (same theme as header) =====
  const depDate = toLocalDate(rows[0]?.departureDate);
  const ddMMM = depDate
    ? depDate
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        .toUpperCase()
    : "";
  const dow = depDate ? depDate.toLocaleDateString("en-GB", { weekday: "short" }) : "";
  const dowColors = {
    Mon: "#FFD700",
    Tue: "#FF69B4",
    Wed: "#32CD32",
    Thu: "#FFA500",
    Fri: "#00BFFF",
    Sat: "#CF9FFF",
    Sun: "#FF4500",
  };
  const accent = dowColors[dow] || "#00BFFF"; // fallback color
  // Expose the accent as a CSS variable on the container so we can use Tailwind arbitrary values
  const containerStyle = { "--dow": accent };

  const statusKey = selectedFare?.fareKey || "";
  const selectedStatus = useSelector(selectPricingStatus(statusKey));
  const selectedDetail = useSelector(selectPriceFor(statusKey));

  const canNext =
    !!(selectedFare?.journeyKey && selectedFare?.fareKey) &&
    selectedStatus !== "loading";

  return (
    <div className="w-full" style={containerStyle}>
      {!hideHeader && (
        <h2 className="ml-1 mb-2 text-blue-700 flex items-center gap-2 flex-wrap text-[200%] leading-tight">
          {titleOverride && (
            <span className="text-slate-700 font-semibold text-[0.6em]">
              {titleOverride}
            </span>
          )}
          <span className="font-semibold text-[0.9em]">
            {rows[0]?.origin} → {rows[0]?.destination}
          </span>
          {ddMMM && (
            <>
              <span className="text-slate-700 text-[0.65em]">{ddMMM}</span>
              <span
                className="font-semibold px-3 py-1 rounded text-[0.6em]"
                style={{ backgroundColor: "#000", color: accent }}
              >
                {dow}
              </span>
            </>
          )}
        </h2>
      )}

      {/* RESULT CARDS */}
      <div className="flex flex-col gap-3">
        {rows.map((row, idx) => {
          const open = openId === (row.id || `${row.flightNumber}-${idx}`);
          const selected = selectedRow?.fareKey === row.fareKey;

          return (
            <article
              key={row.id || `${row.flightNumber}-${row.departureTime}-${idx}`}
              // Use the same accent var at row level (lets us tweak per-row later if needed)
              style={{ "--dow": accent }}
              className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center
                         transition-colors hover:border-[var(--dow)]"
            >
              {/* LEFT META */}
              <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                <div className="w-7 h-7 rounded-md bg-white border border-amber-200 grid place-items-center overflow-hidden">
                  <img
                    className="w-full h-full object-cover"
                    alt="Nok Air"
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHBKoufNO6L_f1AvGmnvXR7b5TfMiDQGjH6w&s"
                  />
                </div>
                <div>
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#e9f2ff] border border-[#c8defa] text-[#0b4f8a] mb-0.5">
                    Economy
                  </span>

                  <div className="font-bold text-[15px] text-[#0b4f8a] leading-tight">
                    {row.flightNumber || row.id}&nbsp;&nbsp;{row.origin} → {row.destination}
                  </div>

                  {/* Timeline */}
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="text-[18px] font-extrabold">{row.departureTime}</div>
                    <div className="flex-1 h-[1px] bg-slate-200 relative rounded">
                      <span className="absolute left-0 right-0 mx-auto -top-[7px] block h-[1px] w-[80px] bg-slate-300 rounded" />
                    </div>
                    <div className="text-[18px] font-extrabold">{row.arrivalTime}</div>
                  </div>

                  {/* Foot meta */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
                    <span>
                      {row.aircraftDescription
                        ? `${row.aircraftDescription} • ${row.duration}`
                        : row.duration}
                    </span>
                    <span>•</span>
                    <span>Nonstop</span>
                    <span>•</span>
                    <span>7 kg per person</span>
                    {row.co2 && (
                      <>
                        <span>•</span>
                        <span>{row.co2}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — price */}
              <div className="flex flex-col items-end gap-1.5">
                <div className="text-right">
                  <span
                    className="font-bold text-[20px] leading-none px-2 py-1 rounded transition-colors"
                    style={{
                      color: selected ? "#4927F5" : "#0b4f8a",
                      backgroundColor: selected ? "rgba(230,248,255,0.9)" : "transparent",
                    }}
                  >
                    {fmtMoney(row.fareAmountIncludingTax, currency)}
                  </span>
                  <div className="text-[10px] text-slate-500">/5 pax*</div>
                </div>

                {/* Select button: hover color comes from --dow */}
                <button
                  onClick={() => selectLite(row)}
                  className={
                    "rounded-lg text-white font-bold px-3 py-1.5 shadow min-w-[100px] text-sm transition-colors " +
                    (selected
                      ? "bg-[#0a65a0] hover:bg-[var(--dow)]"
                      : "bg-[#0B73B1] hover:bg-[var(--dow)]")
                  }
                >
                  {selectedStatus === "loading" && selectedRow?.fareKey === row.fareKey
                    ? "Loading…"
                    : "Select"}
                </button>

                {/* Details link: underline/border uses accent on hover */}
                <button
                  onClick={() =>
                    setOpenId(open ? null : (row.id || `${row.flightNumber}-${idx}`))
                  }
                  className="text-[11px] text-slate-700 border-b border-dashed border-slate-400 hover:text-[var(--dow)] hover:border-[var(--dow)] transition-colors"
                >
                  {open ? "Hide details ▴" : "Details ▾"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-end gap-2">
        {selectedStatus === "loading" && (
          <div className="text-xs text-slate-600">Loading price…</div>
        )}
        {selectedStatus === "failed" && (
          <div className="text-xs text-red-600">Failed to load price.</div>
        )}
        {selectedStatus === "succeeded" && selectedDetail && (
          <div className="text-xs font-medium">
            {typeof selectedDetail.total !== "undefined"
              ? `Total: ${fmtMoney(
                  selectedDetail.total,
                  selectedDetail.currency || selectedFare?.currency || currency
                )}`
              : "Pricing available."}
          </div>
        )}

        {showNextButton && (
          <button
            onClick={handleInternalNext}
            disabled={!canNext}
            className={
              "px-3 py-1.5 rounded-md text-white text-xs transition-colors " +
              (canNext
                ? "bg-blue-600 hover:bg-[var(--dow)]"
                : "bg-gray-300 cursor-not-allowed")
            }
          >
            {selectedStatus === "loading" ? "Loading..." : "NEXT"}
          </button>
        )}
      </div>
    </div>
  );
}
