// src/components/RoundTripResultsLite.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { selectResults, selectSearch } from "../redux/searchSlice";
import { flattenFlights } from "../utils/flattenFlights";
import PaxChips from "./PaxChips";
import { derivePax } from "../utils/pax";

// Tabs
import RoundTripTabs from "./RoundTripTabs";

// Pricing
import {
  fetchPriceDetail,
  selectPriceFor,
  selectPricingStatus,
} from "../redux/pricingSlice";

// Seat map
import { fetchSeatMap } from "../redux/seatMapSlice";

// Offer selection redux
import {
  setSelectedOfferLegs,
  clearSelectedOfferLegs,
} from "../redux/offerSelectionSlice";

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
    ? depDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase()
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

/* ---------- Debug packet builder ---------- */
function buildDebugPackets(offers, secToken) {
  const API_BASE =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
    "http://localhost:3100";
  const priceUrl = `${API_BASE}/pricedetails`;
  const seatUrl = `${API_BASE}/seat-map`;
  const commonHeaders = { "Content-Type": "application/json" };
  const headersWithToken = secToken
    ? { ...commonHeaders, securitytoken: secToken }
    : commonHeaders;

  const bodyPreview = { offers };

  return {
    priceUrl,
    seatUrl,
    priceHeaders: headersWithToken,
    seatHeaders: headersWithToken,
    bodyPreview,
  };
}

/* ============================================================
 * LiteCard
 * ============================================================ */
function LiteCard({
  row,
  currency = "THB",
  selected,
  open,
  onSelect,
  onToggle,
  accent = "#00BFFF",
  paxCounts,
  readonly = false,
  hideActions = false,
}) {
  const a = paxCounts?.adult || 0;
  const c = paxCounts?.child || 0;
  const i = paxCounts?.infant || 0;
  const totalPax = a + c + i;

  return (
    <article
      style={{ "--dow": accent }}
      className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center transition-colors hover:border-[var(--dow)]"
    >
      {/* LEFT */}
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

          <div className="flex items-center gap-3 mt-0.5">
            <div className="text-[18px] font-extrabold">{row.departureTime}</div>
            <div className="flex-1 h-[1px] bg-slate-200 relative rounded">
              <span className="absolute left-0 right-0 mx-auto -top-[7px] block h-[1px] w-[80px] bg-slate-300 rounded" />
            </div>
            <div className="text-[18px] font-extrabold">{row.arrivalTime}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
            <span>
              {row.aircraftDescription ? `${row.aircraftDescription} • ${row.duration}` : row.duration}
            </span>
            <span>•</span>
            <span>Nonstop</span>
            <span>•</span>
            <span>7 kg per person</span>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex flex-col items-end gap-1.5">
        <div className="text-right">
          <span
            className="font-bold text-[20px] leading-none px-2 py-1 rounded"
            style={{
              color: selected ? "#4927F5" : "#0b4f8a",
              backgroundColor: selected ? hexToRgba(accent, 0.18) : "transparent",
            }}
          >
            {fmtMoney(row.fareAmountIncludingTax, currency)}
          </span>
          <div className="text-[10px] text-slate-500">
            <span className="mr-2">ADT {paxCounts?.adult || 0}</span>
            {(paxCounts?.child || 0) > 0 && <span className="mr-2">CHD {paxCounts?.child}</span>}
            {(paxCounts?.infant || 0) > 0 && <span className="mr-2">INF {paxCounts?.infant}</span>}
            / {totalPax} pax*
          </div>
        </div>

        {!hideActions && (
          <button
            onClick={onSelect}
            disabled={readonly}
            className={
              "rounded-lg text-white font-bold px-3 py-1.5 shadow min-w-[100px] text-sm transition-colors " +
              (selected ? "bg-[#0a65a0] hover:bg-[var(--dow)]" : "bg-[#0B73B1] hover:bg-[var(--dow)]") +
              (readonly ? " opacity-70 cursor-not-allowed" : "")
            }
          >
            {selected ? "Selected" : "Select"}
          </button>
        )}

        <button
          onClick={onToggle}
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

      <div
        className={`grid transition-[grid-template-rows,border-color] duration-200 overflow-hidden border-t border-dashed col-span-full mt-1.5 ${
          open ? "grid-rows-[1fr] border-slate-200" : "grid-rows-[0fr] border-transparent"
        }`}
        aria-hidden={!open}
      >
        <div
          className="min-h-0 pt-3 pb-3 px-3 rounded-lg"
          style={{ backgroundColor: hexToRgba(accent, 0.12) }}
        >
          <div className="text-[12px] font-medium text-blue-700">
            ✅ Free fare inclusions — Carry-on allowance 7 kg × 1
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------- LegBox (controlled selection) ---------- */
function LegBox({
  title,
  rows,
  currency = "THB",
  fallbackToken = "",
  selectedValue,
  onSelectValue,
  paxCounts,
}) {
  const [openId, setOpenId] = useState(null);

  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="w-full rounded-2xl border bg-white overflow-hidden shadow-sm p-4 text-sm text-slate-600">
        No flights for this leg.
      </div>
    );
  }

  const hdr = getHeaderParts(rows);

  const pickLite = (row) => {
    const fareKey = row?.fareKey;
    const journeyKey = row?.journeyKey;
    if (!fareKey || !journeyKey) return;

    if (selectedValue?.fareKey === fareKey && selectedValue?.journeyKey === journeyKey) {
      onSelectValue?.(null);
      return;
    }

    onSelectValue?.({
      brand: "LITE",
      fareKey,
      journeyKey,
      securityToken: row.securityToken || fallbackToken,
      currency,
      row,
    });
  };

  return (
    <div
      className="w-full rounded-2xl border bg-white overflow-hidden shadow-sm"
      style={{ "--dow": hdr.chipColor }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap text-[200%] leading-tight">
        {title && <div className="text-slate-700 font-semibold text-[0.5em]">{title}</div>}
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
        <PaxChips source={paxCounts} className="ml-auto" />
      </div>

      <div className="flex flex-col gap-3 px-3 pb-3">
        {rows.map((row, idx) => {
          const cardId = row.id || `${row.flightNumber}-${idx}`;
          const open = openId === cardId;
          const isSel =
            selectedValue?.fareKey === row.fareKey &&
            selectedValue?.journeyKey === row.journeyKey;

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
              paxCounts={paxCounts}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------- View Selection (read-only) ---------- */
function ViewSelectionPanel({ outSel, inSel, currency, paxCounts }) {
  const [openId, setOpenId] = useState(null);
  const items = [
    outSel ? { label: "Depart", sel: outSel } : null,
    inSel ? { label: "Return", sel: inSel } : null,
  ].filter(Boolean);

  if (!items.length) {
    return (
      <div className="w-full rounded-2xl border bg-white shadow-sm p-4 text-sm text-slate-600">
        No selection yet.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {items.map(({ label, sel }, idx) => {
        const row = sel?.row || {};
        const hdr = getHeaderParts([row]);
        const cardId = `${label}-${idx}`;
        const open = openId === cardId;

        return (
          <div key={cardId} className="w-full rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap">
              <div className="text-slate-700 font-semibold text-sm">{label}</div>
              <div className="text-blue-600 font-semibold text-sm">
                {(row.origin || "").toUpperCase()} → {(row.destination || "").toUpperCase()}
              </div>
              {hdr.ddMMM && <span className="text-slate-700 text-xs">{hdr.ddMMM}</span>}
              {hdr.dow && (
                <span
                  className="font-semibold rounded px-2 py-0.5 text-xs"
                  style={{ backgroundColor: "#000", color: hdr.chipColor }}
                >
                  {hdr.dow}
                </span>
              )}
              <div className="ml-auto">
                <PaxChips source={paxCounts} />
              </div>
            </div>

            <div className="px-3 pb-3">
              <LiteCard
                row={row}
                currency={currency}
                selected={true}
                open={open}
                onSelect={() => {}}
                onToggle={() => setOpenId(open ? null : cardId)}
                accent={hdr.chipColor}
                paxCounts={paxCounts}
                readonly={true}
                hideActions={true}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Main ---------- */
export default function RoundTripResultsLite() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const raw = useSelector(selectResults);
  const search = useSelector(selectSearch);

  const payload = raw?.data ?? raw;
  const token = raw?.securityToken || payload?.securityToken || "";
  const currency = raw?.currency || "THB";

  const pax = useMemo(
    () => derivePax(search?.params || search?.results || payload || raw || {}),
    [search, payload, raw]
  );

  const rows = useMemo(() => {
    if (!payload) return [];
    const input = Array.isArray(payload) ? payload : [payload];
    const out = flattenFlights(input, token) || [];
    return out
      .map((r) => ({
        ...r,
        origin: (r.origin || "").trim().toUpperCase(),
        destination: (r.destination || "").trim().toUpperCase(),
      }))
      .filter((r) => r && (r.id || r.flightNumber) && (r.origin || r.destination));
  }, [payload, token]);

  if (!rows.length) {
    return (
      <div className="mt-6 rounded-xl border bg-amber-50 text-amber-900 p-4">
        No flights to display.
      </div>
    );
  }

  const byDirMap = rows.reduce((acc, r) => {
    const o = (r.origin || "").trim().toUpperCase();
    const d = (r.destination || "").trim().toUpperCase();
    const dir = `${o}-${d}`;
    (acc[dir] ||= []).push(r);
    return acc;
  }, {});

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

  let groups = [];
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

  const isRoundTrip = groups.length === 2;

  const [selectedOutbound, setSelectedOutbound] = useState(null);
  const [selectedInbound, setSelectedInbound] = useState(null);
  const [tab, setTab] = useState("depart");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isRoundTrip) return;

    const legs = [
      selectedOutbound
        ? {
            direction: "OUT",
            fareKey: selectedOutbound.fareKey,
            journeyKey: selectedOutbound.journeyKey,
            securityToken: selectedOutbound.securityToken,
            currency: selectedOutbound.currency || currency,
          }
        : null,
      selectedInbound
        ? {
            direction: "IN",
            fareKey: selectedInbound.fareKey,
            journeyKey: selectedInbound.journeyKey,
            securityToken: selectedInbound.securityToken,
            currency: selectedInbound.currency || currency,
          }
        : null,
    ].filter(Boolean);

    dispatch(setSelectedOfferLegs(legs));
  }, [dispatch, isRoundTrip, selectedOutbound, selectedInbound, currency]);

  const onReset = () => {
    setSelectedOutbound(null);
    setSelectedInbound(null);
    dispatch(clearSelectedOfferLegs());
    setTab("depart");
  };

  /* ===================== ONE-WAY (unchanged behavior) ===================== */
  if (!isRoundTrip) {
    const requestKey = selectedOutbound?.fareKey || "";
    const inlineStatus = useSelector(selectPricingStatus(requestKey));

    const doInlineNext = async () => {
      const sel = selectedOutbound;
      if (!sel?.fareKey || !sel?.journeyKey) return;

      const offers = [
        { journeyKey: sel.journeyKey, fareKey: sel.fareKey, securityToken: sel.securityToken },
      ];
      const secToken = sel?.securityToken || token || "";
      const dbg = buildDebugPackets(offers, secToken);

      try {
        const priceP = dispatch(fetchPriceDetail({ offers, currency, includeSeats: false })).unwrap();
        const seatP = dispatch(fetchSeatMap({ offers })).unwrap();

        const [priceRes, seatRes] = await Promise.allSettled([priceP, seatP]);
        if (priceRes.status !== "fulfilled") return;

        const priceDetail = priceRes.value;
        const seatOk = seatRes.status === "fulfilled";
        const seatError = seatOk ? null : (seatRes.reason?.message || "Seat map failed.");
        const seatRaw = seatOk ? seatRes.value : null;

        navigate(`/skyblue-price-detail?adt=${pax.adult}&chd=${pax.child}&inf=${pax.infant}`, {
          state: {
            requestKey,
            priceDetail,
            pax,
            selectedOffers: offers,
            fareKey: offers[0].fareKey,
            journeyKey: offers[0].journeyKey,
            debug: {
              pricingRequest: { url: dbg.priceUrl, method: "POST", headers: dbg.priceHeaders, body: dbg.bodyPreview },
              seatRequest: { url: dbg.seatUrl, method: "POST", headers: dbg.seatHeaders, body: dbg.bodyPreview },
              seatResponse: seatRaw,
              seatOk,
              seatError,
            },
          },
        });
      } catch (e) {
        console.error("Unexpected NEXT error (one-way):", e);
      }
    };

    return (
      <div className="w-full flex flex-col gap-6 mt-4 pb-24">
        <LegBox
          title="Depart"
          rows={groups[0].rows}
          currency={currency}
          fallbackToken={token}
          selectedValue={selectedOutbound}
          onSelectValue={setSelectedOutbound}
          paxCounts={pax}
        />

        <div className="sticky bottom-0 z-40 rounded-2xl border bg-white/95 backdrop-blur shadow p-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="text-xs text-gray-700">
              {selectedOutbound ? "✓ Departure selected" : "• Choose a departure"}
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-md bg-white text-slate-700 text-xs font-semibold border border-slate-200"
                onClick={onReset}
              >
                Clear selection
              </button>
              <button
                type="button"
                className={`px-3 py-2 rounded-md font-semibold text-xs ${
                  selectedOutbound && inlineStatus !== "loading"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-600"
                }`}
                disabled={!selectedOutbound || inlineStatus === "loading"}
                onClick={doInlineNext}
              >
                {inlineStatus === "loading" ? "Please wait…" : "NEXT"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ===================== ROUND-TRIP ===================== */
  const requestKey = useMemo(() => {
    const a = selectedOutbound?.fareKey || "";
    const b = selectedInbound?.fareKey || "";
    return [a, b].filter(Boolean).join("+") || "";
  }, [selectedOutbound, selectedInbound]);

  const canProceed = !!(selectedOutbound && selectedInbound);
  const pricingStatus = useSelector(selectPricingStatus(requestKey));
  const priceDetail = useSelector(selectPriceFor(requestKey));

  const handleUnifiedNext = async () => {
    if (!canProceed || submitting) return;
    setSubmitting(true);

    const offers = [selectedOutbound, selectedInbound].map((sel) => ({
      journeyKey: sel.journeyKey,
      fareKey: sel.fareKey,
      securityToken: sel.securityToken,
    }));

    const secToken =
      selectedOutbound?.securityToken ||
      selectedInbound?.securityToken ||
      token ||
      "";

    const dbgBoth = buildDebugPackets(offers, secToken);
    const seatReqOutbound = buildDebugPackets([offers[0]], secToken);
    const seatReqInbound = buildDebugPackets([offers[1]], secToken);

    try {
      const priceP = dispatch(fetchPriceDetail({ offers, currency, includeSeats: false })).unwrap();
      const seatOutP = dispatch(fetchSeatMap({ offers: [offers[0]] })).unwrap();
      const seatInP = dispatch(fetchSeatMap({ offers: [offers[1]] })).unwrap();

      const [priceRes, seatOutRes, seatInRes] = await Promise.allSettled([priceP, seatOutP, seatInP]);
      if (priceRes.status !== "fulfilled") return;

      const pricedPayload = priceRes.value;

      const seatOkOutbound = seatOutRes.status === "fulfilled";
      const seatOkInbound = seatInRes.status === "fulfilled";
      const seatErrors = [];
      if (!seatOkOutbound) seatErrors.push(seatOutRes.reason?.message || "Seat map (outbound) failed.");
      if (!seatOkInbound) seatErrors.push(seatInRes.reason?.message || "Seat map (inbound) failed.");

      const seatResponses = [
        seatOkOutbound ? seatOutRes.value : null,
        seatOkInbound ? seatInRes.value : null,
      ];

      navigate(`/skyblue-price-detail?adt=${pax.adult}&chd=${pax.child}&inf=${pax.infant}`, {
        state: {
          requestKey,
          priceDetail: pricedPayload,
          pax,
          selectedOffers: offers,
          fareKey: offers[0]?.fareKey || "",
          journeyKey: offers[0]?.journeyKey || "",
          debug: {
            pricingRequest: { url: dbgBoth.priceUrl, method: "POST", headers: dbgBoth.priceHeaders, body: dbgBoth.bodyPreview },
            seatRequest: [
              { url: seatReqOutbound.seatUrl, method: "POST", headers: seatReqOutbound.seatHeaders, body: seatReqOutbound.bodyPreview },
              { url: seatReqInbound.seatUrl, method: "POST", headers: seatReqInbound.seatHeaders, body: seatReqInbound.bodyPreview },
            ],
            seatResponse: seatResponses,
            seatOk: seatOkOutbound && seatOkInbound,
            seatError: seatErrors.length ? seatErrors.join(" | ") : null,
          },
        },
      });
    } catch (e) {
      console.error("Unexpected NEXT error (round-trip):", e);
    } finally {
      setSubmitting(false);
    }
  };

  const outboundHdr = getHeaderParts(groups[0]?.rows || []);
  const nextHoverColor = outboundHdr.chipColor || "#00BFFF";

  return (
    <div className="w-full flex flex-col gap-4 mt-4 pb-28" style={{ "--dow": nextHoverColor }}>
      {/* TOP MENU (single menu only) */}
      <RoundTripTabs
        tab={tab}
        setTab={setTab}
        hasOutbound={!!selectedOutbound}
        hasInbound={!!selectedInbound}
        onReset={onReset}
      />

      {tab === "depart" && (
        <LegBox
          title="Depart"
          rows={groups[0].rows}
          currency={currency}
          fallbackToken={token}
          selectedValue={selectedOutbound}
          onSelectValue={setSelectedOutbound}
          paxCounts={pax}
        />
      )}

      {tab === "return" && (
        <LegBox
          title="Return"
          rows={groups[1].rows}
          currency={currency}
          fallbackToken={token}
          selectedValue={selectedInbound}
          onSelectValue={setSelectedInbound}
          paxCounts={pax}
        />
      )}

      {tab === "view" && (
        <ViewSelectionPanel
          outSel={selectedOutbound}
          inSel={selectedInbound}
          currency={currency}
          paxCounts={pax}
        />
      )}

      {/* STICKY BOTTOM BAR (NO second menu) */}
      <div className="sticky bottom-0 z-40 rounded-2xl border bg-white/95 backdrop-blur shadow p-3">
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-700">
            <span className={selectedOutbound ? "text-emerald-700 font-semibold" : "text-gray-500"}>
              {selectedOutbound ? "✓ Depart selected" : "• Depart not selected"}
            </span>
            <span className="mx-2 text-gray-300">|</span>
            <span className={selectedInbound ? "text-emerald-700 font-semibold" : "text-gray-500"}>
              {selectedInbound ? "✓ Return selected" : "• Return not selected"}
            </span>
            {pricingStatus === "loading" && (
              <span className="ml-3 text-blue-600">Getting offers…</span>
            )}
          </div>

          {/* Buttons move to next line on mobile automatically */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end">
            <button
              type="button"
              className="w-full sm:w-auto px-3 py-2 rounded-md bg-white text-slate-700 text-xs font-semibold border border-slate-200"
              onClick={onReset}
            >
              Clear selection
            </button>

            <button
              type="button"
              className="w-full sm:w-auto px-3 py-2 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100"
              onClick={() => setTab("view")}
              disabled={!selectedOutbound && !selectedInbound}
            >
              View Selection
            </button>

            <button
              className={`w-full sm:w-auto px-3 py-2 rounded-md font-semibold text-xs transition-colors ${
                canProceed && pricingStatus !== "loading" && !submitting
                  ? "bg-blue-600 text-white hover:bg-[var(--dow)]"
                  : "bg-gray-300 text-gray-600"
              }`}
              disabled={!canProceed || pricingStatus === "loading" || submitting}
              onClick={handleUnifiedNext}
            >
              {submitting || pricingStatus === "loading" ? "Please wait…" : "NEXT"}
            </button>
          </div>

          {pricingStatus === "succeeded" && priceDetail && (
            <div className="rounded-xl border bg-slate-50 p-3 text-xs">
              <div className="font-semibold mb-1">Offer loaded</div>
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
      </div>
    </div>
  );
}
