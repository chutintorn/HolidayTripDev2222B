import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { selectResults, selectSearch } from "../redux/searchSlice";
import { fetchPriceDetail, selectPricingStatus } from "../redux/pricingSlice";
import { fetchSeatMap, selectSeatMapStatus } from "../redux/seatMapSlice";
import { setSelectedOfferLegs } from "../redux/offerSelectionSlice";
import { flattenFlights } from "../utils/flattenFlights";
import PaxChips from "./PaxChips";
import { derivePax } from "../utils/pax";

// ✅ flight selection summary
import FlightSelectionSummary from "./FlightSelectionSummary";

/** ------ Local-safe date helpers ---- */
const ymd = (s) =>
  typeof s === "string" && s.length >= 10 ? s.slice(0, 10) : "";
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

/** ---- Hex → rgba for soft accent backgrounds ---- */
const hexToRgba = (hex, alpha = 0.18) => {
  const m = hex?.trim().match(/^#?([a-f\d]{3}|[a-f\d]{6})$/i);
  if (!m) return `rgba(0,0,0,${alpha})`;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** ---- Inline details (presentational only) ---- */
function InlineDetails({ row, accent }) {
  return (
    <div
      className="min-h-0 pt-3 pb-3 px-3 rounded-lg"
      style={{ backgroundColor: hexToRgba(accent, 0.12) }}
    >
      <div className="relative pl-5">
        <span className="absolute left-2 top-0 bottom-0 w-[1px] bg-slate-300 rounded" />

        {/* Depart */}
        <div className="relative my-3">
          <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
          <div className="inline-block text-[13px] px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-blue-700">
            {(row?.departureTime || "").toString()} • Depart
          </div>
          <div className="text-slate-600 text-[12px] mt-0.5">
            {row?.originName || row?.origin}
          </div>
        </div>

        {/* Note */}
        <div className="relative my-3">
          <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
          <div className="bg-white border border-slate-200 rounded p-3 text-[12px] text-slate-700 shadow-sm">
            <div className="font-bold text-blue-700 text-[14px]">
              {row?.marketingCarrier || "Nok Air"}, {row?.flightNumber || ""}
            </div>
            <div className="text-slate-500">Short-haul</div>
            <div className="text-[11px] mt-1">
              {row?.perPaxCo2 || "48kg CO₂e"} • est. emissions
            </div>
          </div>
        </div>

        {/* Arrive */}
        <div className="relative my-3">
          <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
          <div className="inline-block text-[13px] px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-blue-700">
            {(row?.arrivalTime || "").toString()} • Arrive
          </div>
          <div className="text-slate-600 text-[12px] mt-0.5">
            {row?.destinationName || row?.destination}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-dashed text-[12px] font-medium text-blue-700">
        ✅ Free fare inclusions — Carry-on allowance 7 kg × 1
      </div>
    </div>
  );
}

export default function JourneyTable({
  resultsOverride = null,
  currencyOverride,
  securityTokenOverride,
  titleOverride,
  hideHeader = false,
  showNextButton = false, // keep original footer NEXT behavior
  onSelectRow,
  onNext,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Pull data from redux
  const globalResults = useSelector(selectResults);
  const search = useSelector(selectSearch);

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
    return out.filter(
      (r) => r && (r.id || r.flightNumber) && (r.origin || r.destination)
    );
  }, [payload, securityToken]);

  // derive pax (for chips and "/N pax" label)
  const pax = useMemo(
    () => derivePax(search?.params || search?.results || payload || raw || {}),
    [search, payload, raw]
  );
  const totalPax = (pax.adult || 0) + (pax.child || 0) + (pax.infant || 0);

  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedFare, setSelectedFare] = useState(null);
  const [openId, setOpenId] = useState(null);

  // ✅ Tabs: depart | return(disabled here) | view
  const [tab, setTab] = useState("depart"); // "depart" | "return" | "view"
  const [viewHover, setViewHover] = useState(false);

  // Local loading only for NEXT footer
  const [nextLoading, setNextLoading] = useState(false);

  // ✅ hooks before early return
  const requestKey = selectedFare?.fareKey || "";
  const pricingStatus = useSelector(selectPricingStatus(requestKey));
  const seatStatus = useSelector(selectSeatMapStatus(requestKey));

  const canNext =
    !!(selectedFare?.journeyKey && selectedFare?.fareKey) && !nextLoading;

  if (!rows.length) {
    return (
      <div className="mt-6 rounded-xl border bg-amber-50 text-amber-900 p-4">
        No flights to display. The response may be empty or in an unexpected
        format.
      </div>
    );
  }

  // --- Select (NO API here)
  const selectLite = (row) => {
    const fareKey = row?.fareKey;
    if (!fareKey) return;

    const selection = {
      brand: "LITE",
      fareKey,
      journeyKey: row.journeyKey,
      securityToken: row.securityToken || securityToken,
      currency,
      row,
      // help summary show route + price
      origin: row.origin,
      destination: row.destination,
      fareAmountIncludingTax: row.fareAmountIncludingTax,
    };

    setSelectedRow(row);
    setSelectedFare(selection);

    dispatch(
      setSelectedOfferLegs([
        {
          direction: "OUT",
          journeyKey: selection.journeyKey ?? null,
          fareKey: selection.fareKey ?? null,
          securityToken: selection.securityToken ?? null,
          currency: selection.currency ?? currency ?? null,
          row: selection.row ?? row ?? null,
          origin: selection.origin ?? row?.origin ?? null,
          destination: selection.destination ?? row?.destination ?? null,
          fareAmountIncludingTax:
            selection.fareAmountIncludingTax ??
            row?.fareAmountIncludingTax ??
            null,
        },
      ])
    );

    if (typeof onSelectRow === "function") onSelectRow(selection);
  };

  // --- NEXT footer: /pricedetails + /seat-map (seat best-effort)
  const handleInternalNext = async () => {
    if (!selectedFare?.journeyKey || !selectedFare?.fareKey) return;

    dispatch(
      setSelectedOfferLegs([
        {
          direction: "OUT",
          journeyKey: selectedFare.journeyKey ?? null,
          fareKey: selectedFare.fareKey ?? null,
          securityToken: selectedFare.securityToken ?? null,
          currency: selectedFare.currency ?? currency ?? null,
          row: selectedFare.row ?? selectedRow ?? null,
          origin: selectedFare.origin ?? selectedRow?.origin ?? null,
          destination: selectedFare.destination ?? selectedRow?.destination ?? null,
          fareAmountIncludingTax:
            selectedFare.fareAmountIncludingTax ??
            selectedRow?.fareAmountIncludingTax ??
            null,
        },
      ])
    );

    if (typeof onNext === "function") {
      onNext({ journeyKey: selectedFare.journeyKey, fareKey: selectedFare.fareKey });
      return;
    }

    const offers = [
      {
        journeyKey: selectedFare.journeyKey,
        fareKey: selectedFare.fareKey,
        securityToken: selectedFare.securityToken,
      },
    ];

    const API_BASE =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
      "http://localhost:3100";
    const priceUrl = `${API_BASE}/pricedetails`;
    const seatUrl = `${API_BASE}/seat-map`;
    const commonHeaders = { "Content-Type": "application/json" };
    const priceHeaders = {
      ...commonHeaders,
      ...(selectedFare.securityToken ? { securitytoken: selectedFare.securityToken } : {}),
    };
    const seatHeaders = {
      ...commonHeaders,
      ...(selectedFare.securityToken ? { securitytoken: selectedFare.securityToken } : {}),
    };

    setNextLoading(true);
    try {
      const priceP = dispatch(
        fetchPriceDetail({ offers, currency, includeSeats: false })
      ).unwrap();

      const seatP = dispatch(fetchSeatMap({ offers, agencyCode: "" })).unwrap();

      const [priceRes, seatRes] = await Promise.allSettled([priceP, seatP]);

      if (priceRes.status !== "fulfilled") {
        console.error("Pricing failed:", priceRes.reason);
        return;
      }

      const seatOk = seatRes.status === "fulfilled";
      const seatError = seatOk ? null : seatRes.reason?.message || "Seat map failed.";
      const seatRaw = seatOk ? seatRes.value : null;

      navigate("/skyblue-price-detail", {
        state: {
          requestKey: selectedFare.fareKey,
          seatOk,
          seatError,
          seatRaw,
          debug: {
            pricingRequest: {
              url: priceUrl,
              method: "POST",
              headers: priceHeaders,
              body: { offers, currency, includeSeats: false },
            },
            seatMapRequest: {
              url: seatUrl,
              method: "POST",
              headers: seatHeaders,
              body: { offers, agencyCode: "" },
            },
            seatResponse: seatRaw,
            seatOk,
            seatError,
          },
        },
      });
    } catch (e) {
      console.error("Unexpected NEXT error:", e);
    } finally {
      setNextLoading(false);
    }
  };

  // ===== Day color =====
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
  const accent = dowColors[dow] || "#00BFFF";
  const containerStyle = { "--dow": accent };

  // selection array for summary (one-way = 1 leg)
  const selectedOffersForSummary = useMemo(() => {
    if (!selectedFare) return [];
    return [
      {
        origin: selectedFare.origin || selectedFare.row?.origin,
        destination: selectedFare.destination || selectedFare.row?.destination,
        journeyKey: selectedFare.journeyKey,
        fareKey: selectedFare.fareKey,
        securityToken: selectedFare.securityToken,
        currency: selectedFare.currency || currency,
        fareAmountIncludingTax:
          selectedFare.fareAmountIncludingTax ??
          selectedFare.row?.fareAmountIncludingTax ??
          null,
      },
    ];
  }, [selectedFare, currency]);

  // View Selection idle (lighter ~60%) -> hover (stronger)
  const viewIdleBg = hexToRgba(accent, 0.22);
  const viewHoverBg = hexToRgba(accent, 0.35);
  const viewIdleBorder = hexToRgba(accent, 0.55);

  const TabButton = ({ id, label, disabled }) => {
    const active = tab === id;
    const isView = id === "view";

    const style =
      isView && !active && !disabled
        ? {
            backgroundColor: viewHover ? viewHoverBg : viewIdleBg,
            borderColor: viewHover ? accent : viewIdleBorder,
            color: "#111827",
          }
        : undefined;

    return (
      <button
        type="button"
        disabled={!!disabled}
        onClick={() => !disabled && setTab(id)}
        onMouseEnter={() => isView && setViewHover(true)}
        onMouseLeave={() => isView && setViewHover(false)}
        className={[
          "rounded-md text-[12px] font-bold border transition-colors",
          "px-4 py-2",
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : active
            ? "bg-blue-600 text-white border-blue-600"
            : !isView
            ? "bg-white text-slate-700 border-slate-200 hover:border-[var(--dow)]"
            : "",
        ].join(" ")}
        style={style}
      >
        {label}
      </button>
    );
  };

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
            {rows[0]?.origin} {rows[0]?.destination}
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

          <PaxChips source={search?.params || search?.results || payload || raw} />
        </h2>
      )}

      {/* ✅ Responsive tabs:
          - Mobile: Depart/Return row, then View Selection full-width row
          - Desktop: everything in one line
      */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 w-full">
        {/* left group */}
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
          <TabButton id="depart" label="Depart" />
          <TabButton id="return" label="Return" disabled />
        </div>

        {/* right button */}
        <div className="w-full sm:ml-auto sm:w-auto">
          <button
            type="button"
            disabled={selectedOffersForSummary.length < 1}
            onClick={() => setTab("view")}
            onMouseEnter={() => setViewHover(true)}
            onMouseLeave={() => setViewHover(false)}
            className={[
              "w-full sm:w-auto",
              "rounded-md text-[12px] font-bold border transition-colors px-4 py-2",
              tab === "view"
                ? "bg-blue-600 text-white border-blue-600"
                : selectedOffersForSummary.length < 1
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "",
            ].join(" ")}
            style={
              tab !== "view" && selectedOffersForSummary.length >= 1
                ? {
                    backgroundColor: viewHover ? viewHoverBg : viewIdleBg,
                    borderColor: viewHover ? accent : viewIdleBorder,
                    color: "#111827",
                  }
                : undefined
            }
          >
            View Selection
          </button>
        </div>
      </div>

      {/* View Selection panel */}
      {tab === "view" && (
        <div className="mb-3">
          <FlightSelectionSummary
            lang="en"
            selectedOffers={selectedOffersForSummary}
            requireTwoLegs={false}
            showDetails={false}
            paxCount={totalPax}
            currency={currency}
          />
        </div>
      )}

      {/* RESULT CARDS */}
      {tab !== "view" && (
        <div className="flex flex-col gap-3">
          {rows.map((row, idx) => {
            const cardId = row.id || `${row.flightNumber}-${idx}`;
            const open = openId === cardId;
            const selected = selectedRow?.fareKey === row.fareKey;

            return (
              <article
                key={row.id || `${row.flightNumber}-${row.departureTime}-${idx}`}
                style={{ "--dow": accent }}
                className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center transition-colors hover:border-[var(--dow)]"
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
                      {row.flightNumber || row.id}&nbsp;&nbsp;{row.origin} →{" "}
                      {row.destination}
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="text-[18px] font-extrabold">
                        {row.departureTime}
                      </div>
                      <div className="flex-1 h-[1px] bg-slate-200 relative rounded">
                        <span className="absolute left-0 right-0 mx-auto -top-[7px] block h-[1px] w-[80px] bg-slate-300 rounded" />
                      </div>
                      <div className="text-[18px] font-extrabold">
                        {row.arrivalTime}
                      </div>
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

                {/* RIGHT — price / actions */}
                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-right">
                    <span
                      className="font-bold text-[20px] leading-none px-2 py-1 rounded transition-colors"
                      style={{
                        color: selected ? "#4927F5" : "#0b4f8a",
                        backgroundColor: selected
                          ? hexToRgba(accent, 0.18)
                          : "transparent",
                      }}
                    >
                      {fmtMoney(row.fareAmountIncludingTax, currency)}
                    </span>

                    <div className="text-[10px] text-slate-500">
                      <span className="mr-2">ADT {pax.adult || 0}</span>
                      {(pax.child || 0) > 0 && (
                        <span className="mr-2">CHD {pax.child}</span>
                      )}
                      / {totalPax} pax*
                    </div>
                  </div>

                  <button
                    onClick={() => selectLite(row)}
                    className={
                      "rounded-lg text-white font-bold px-3 py-1.5 shadow min-w-[100px] text-sm transition-colors " +
                      (selected
                        ? "bg-[#0a65a0] hover:bg-[var(--dow)]"
                        : "bg-[#0B73B1] hover:bg-[var(--dow)]")
                    }
                  >
                    {selected ? "Selected" : "Select"}
                  </button>

                  <button
                    onClick={() => setOpenId(open ? null : cardId)}
                    className={
                      "text-[11px] border-b border-dashed transition-colors " +
                      (open
                        ? "text-blue-700 border-blue-300"
                        : "text-slate-700 border-slate-400 hover:text-[var(--dow)] hover:border-[var(--dow)]")
                    }
                  >
                    {open ? "Hide details ▴" : "Details ▾"}
                  </button>
                </div>

                {/* INLINE DETAILS */}
                <div
                  className={`grid transition-[grid-template-rows,border-color] duration-200 overflow-hidden border-t border-dashed col-span-full mt-1.5 ${
                    open
                      ? "grid-rows-[1fr] border-slate-200"
                      : "grid-rows-[0fr] border-transparent"
                  }`}
                  aria-hidden={!open}
                >
                  <InlineDetails row={row} accent={accent} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Footer (Original NEXT stays) */}
      <div className="mt-2 flex items-center justify-end gap-2">
        {nextLoading && (
          <div className="text-xs text-slate-600">Loading price & seat map…</div>
        )}
        {!nextLoading && pricingStatus === "failed" && (
          <div className="text-xs text-red-600">Failed to load price.</div>
        )}
        {!nextLoading && seatStatus === "failed" && (
          <div className="text-xs text-red-600">Failed to load seat map.</div>
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
            {nextLoading ? "Loading..." : "NEXT"}
          </button>
        )}
      </div>
    </div>
  );
}
