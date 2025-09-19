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

function getHeaderParts(rows) {
  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first) {
    return { origin: "", destination: "", ddMMM: "", dow: "", chipColor: "#00BFFF" };
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
    chipColor: dowColors[dow] || "#00BFFF",
  };
}

/* ============================================================
 * LiteCard (70% sizing)
 * ============================================================ */
function LiteCard({
  row,
  currency = "THB",
  selected,
  open,
  onSelect,
  onToggle,
  accent = "#00BFFF",
}) {
  return (
    <article
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

      {/* RIGHT — price, Select, Details toggle */}
      <div className="flex flex-col items-end gap-1.5">
        <div className="text-right">
          <span
            className="font-bold text-[20px] leading-none px-2 py-1 rounded"
            style={{
              color: selected ? "#4927F5" : "#0b4f8a",
              backgroundColor: selected ? "#e6f8ff" : "transparent",
            }}
          >
            {fmtMoney(row.fareAmountIncludingTax, currency)}
          </span>
          <div className="text-[10px] text-slate-500">/5 pax*</div>
        </div>

        <button
          onClick={onSelect}
          className={
            "rounded-lg text-white font-bold px-3 py-1.5 shadow min-w-[100px] text-sm transition-colors " +
            (selected
              ? "bg-[#0a65a0] hover:bg-[var(--dow)]"
              : "bg-[#0B73B1] hover:bg-[var(--dow)]")
          }
        >
          Select
        </button>

        <button
          onClick={onToggle}
          className="text-[11px] text-slate-700 border-b border-dashed border-slate-400 hover:text-[var(--dow)] hover:border-[var(--dow)] transition-colors"
        >
          {open ? "Hide details ▴" : "Details ▾"}
        </button>
      </div>

      {/* INLINE DETAILS */}
      <div
        className={`grid transition-[grid-template-rows,border-color] duration-200 overflow-hidden border-t border-dashed col-span-full mt-1.5 ${
          open ? "grid-rows-[1fr] border-slate-200" : "grid-rows-[0fr] border-transparent"
        }`}
        aria-hidden={!open}
      >
        <div className="min-h-0 pt-2">
          <div className="relative pl-5">
            <span className="absolute left-2 top-0 bottom-0 w-[1px] bg-slate-200 rounded" />
            {/* Depart */}
            <div className="relative my-2">
              <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
              <div className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-slate-200">
                {row.departureTime} • Depart
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                {row.originName || row.origin}
              </div>
            </div>
            {/* Note */}
            <div className="relative my-2">
              <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[10px] text-slate-700">
                <div className="font-semibold">
                  {row.marketingCarrier || "Nok Air"},{" "}
                  {row.flightNumber || ""}
                </div>
                <div className="text-slate-500">Short-haul</div>
                <div className="text-[10px] mt-0.5">
                  {row.perPaxCo2 || "48kg CO₂e"} • est. emissions
                </div>
              </div>
            </div>
            {/* Arrive */}
            <div className="relative my-2">
              <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
              <div className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-slate-200">
                {row.arrivalTime} • Arrive
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                {row.destinationName || row.destination}
              </div>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-dashed text-[10px]">
            ✅ Free fare inclusions — Carry-on allowance 7 kg × 1
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------- One leg box: header + list of Lite cards, optional inline NEXT (one-way) ---------- */
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
  const [openId, setOpenId] = useState(null);
  const [selected, setSelected] = useState(null); // selection object

  const inlineStatus = useSelector(selectPricingStatus(inlinePriceKey));
  const inlineDetail = useSelector(selectPriceFor(inlinePriceKey));

  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="w-full rounded-2xl border bg-white overflow-hidden shadow-sm p-4 text-sm text-slate-600">
        No flights for this leg.
      </div>
    );
  }

  const hdr = getHeaderParts(rows);

  const pickLite = (row) => {
    const fareKey = row?.fareKey; // LITE key
    if (!fareKey) return;

    // Toggle off if same card clicked again
    if (selected?.fareKey === fareKey && selected?.journeyKey === row.journeyKey) {
      setSelected(null);
      onSelect?.(null);
      return;
    }

    const selection = {
      brand: "LITE",
      fareKey,
      journeyKey: row.journeyKey,
      securityToken: row.securityToken || fallbackToken,
      currency,
      row,
    };
    setSelected(selection);
    onSelect?.(selection);
  };

  return (
    <div
      className="w-full rounded-2xl border bg-white overflow-hidden shadow-sm"
      style={{ "--dow": hdr.chipColor }}
    >
      {/* Title + header line — scaled to 200% */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap text-[200%] leading-tight">
        {title && (
          <div className="text-slate-700 font-semibold text-[0.5em]">{title}</div>
        )}
        {(hdr.origin || hdr.destination) && (
          <div className="text-blue-600 font-semibold text-[0.9em]">
            {hdr.origin} → {hdr.destination}
          </div>
        )}
        {hdr.ddMMM && <span className="text-slate-700 text-[0.6em]">{hdr.ddMMM}</span>}
        {hdr.dow && (
          <span
            className="font-semibold rounded px-3 py-1 text-[0.6em]"
            style={{ backgroundColor: "#000", color: hdr.chipColor }}
          >
            {hdr.dow}
          </span>
        )}
      </div>

      {/* List of Lite cards */}
      <div className="flex flex-col gap-3 px-3 pb-3">
        {rows.map((row, idx) => {
          const cardId = row.id || `${row.flightNumber}-${idx}`;
          const open = openId === cardId;
          const isSel =
            selected?.fareKey === row.fareKey && selected?.journeyKey === row.journeyKey;

          return (
            <LiteCard
              key={row.id || `${row.flightNumber}-${row.departureTime}-${idx}`}
              row={row}
              currency={currency}
              selected={isSel}
              open={open}
              onSelect={() => pickLite(row)}
              onToggle={() => setOpenId(open ? null : cardId)}
              accent={hdr.chipColor}
            />
          );
        })}
      </div>

      {/* Inline NEXT for one-way */}
      {showInlineNext && (
        <div className="px-4 py-3 flex items-center justify-end gap-3 border-t">
          {inlineStatus === "loading" && (
            <div className="text-xs text-slate-600">Getting offers…</div>
          )}
          {inlineStatus === "failed" && (
            <div className="text-xs text-red-600">Failed to load price.</div>
          )}
          {inlineStatus === "succeeded" && inlineDetail && (
            <div className="text-xs font-medium">
              {typeof inlineDetail.total !== "undefined"
                ? `Total: ${fmtMoney(inlineDetail.total, inlineDetail.currency || currency)}`
                : "Pricing available."}
            </div>
          )}
          <button
            onClick={onInlineNext}
            disabled={!selected?.fareKey || inlineStatus === "loading"}
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-[var(--dow)] disabled:opacity-60 text-xs transition-colors"
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
        navigate("/skyblue-price-detail", { state: { requestKey } });
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
        fetchPriceDetail({
          offers: [selectedOutbound, selectedInbound],
          currency,
        })
      ).unwrap();

      navigate("/skyblue-price-detail", { state: { requestKey } });
    } catch (e) {
      console.error("Pricing failed", e);
    }
  };

  // Use the outbound group's day color for unified NEXT hover
  const outboundHdr = getHeaderParts(groups[0]?.rows || []);
  const nextHoverColor = outboundHdr.chipColor || "#00BFFF";

  return (
    <div className="w-full flex flex-col gap-6 mt-4" style={{ "--dow": nextHoverColor }}>
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
        <div className="text-xs text-gray-600">
          {selectedOutbound ? "✓ Departure selected" : "• Choose a departure"}{" "}
          &nbsp;&nbsp;
          {selectedInbound ? "✓ Return selected" : "• Choose a return"}
          {pricingStatus === "loading" && (
            <span className="ml-3 text-blue-600">Getting offers…</span>
          )}
        </div>

        <button
          className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors ${
            canProceed && pricingStatus !== "loading"
              ? "bg-blue-600 text-white hover:bg-[var(--dow)]"
              : "bg-gray-300 text-gray-600"
          }`}
          disabled={!canProceed || pricingStatus === "loading"}
          onClick={handleUnifiedNext}
        >
          {pricingStatus === "loading" ? "Please wait…" : "NEXT"}
        </button>
      </div>

      {pricingStatus === "succeeded" && priceDetail && (
        <div className="rounded-xl border bg-slate-50 p-3 text-xs">
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
