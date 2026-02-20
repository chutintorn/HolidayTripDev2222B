// src/pages/FareSidebar.jsx
import React from "react";
import { useSelector } from "react-redux";
import { selectAllSavedSeats, selectAllDraftSeats } from "../redux/seatSelectionSlice";

// ✅ SeatMap debug selectors
import { selectSeatMapFor, selectSeatMapStatus } from "../redux/seatMapSlice";

/* ========================= Helpers: seat + key ========================= */
function normalizeKey(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function extractFlightNumberFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /_([A-Z]{2}\d{2,4})20\d{6}/.exec(s) || /_([A-Z]{2}\d{2,4})/.exec(s);
  return m ? m[1] : "";
}

function parseSeatCode(seatCode) {
  const s = String(seatCode || "").trim().toUpperCase();
  const m = /^(\d{1,2})([A-Z])$/.exec(s);
  if (!m) return { rowNumber: null, seatSelected: "" };
  return { rowNumber: Number(m[1]), seatSelected: m[2] };
}

function buildSelectedSeatObj(savedSeat, journeyKey) {
  if (!savedSeat) return null;

  let flightNumber = savedSeat.flightNumber || extractFlightNumberFromJourneyKey(journeyKey);
  let rowNumber = savedSeat.rowNumber != null ? Number(savedSeat.rowNumber) : null;
  let seatSelected = savedSeat.seat || savedSeat.seatSelected || "";

  if ((!rowNumber || !seatSelected) && savedSeat.seatCode) {
    const parsed = parseSeatCode(savedSeat.seatCode);
    if (!rowNumber) rowNumber = parsed.rowNumber;
    if (!seatSelected) seatSelected = parsed.seatSelected;
  }

  if (!flightNumber || !rowNumber || !seatSelected) return null;
  return { flightNumber, rowNumber, seatSelected };
}

/* ========================= Helpers: effective root (draft preferred) ========================= */
function buildEffectiveRoot(savedRoot, draftRoot) {
  const saved = savedRoot || {};
  const draft = draftRoot || {};
  const paxIds = new Set([...Object.keys(saved), ...Object.keys(draft)]);

  const out = {};
  for (const paxId of paxIds) {
    const savedByJ = saved?.[paxId] || {};
    const draftByJ = draft?.[paxId] || {};
    const jKeys = new Set([...Object.keys(savedByJ), ...Object.keys(draftByJ)]);

    out[paxId] = {};
    for (const jKey of jKeys) {
      const dLeg = draftByJ?.[jKey];
      const sLeg = savedByJ?.[jKey];
      out[paxId][jKey] = dLeg != null ? dLeg : sLeg;
    }
  }
  return out;
}

/* ========================= Helpers: baggage SSR only ========================= */
function isBaggageSsrCode(code) {
  const s = String(code || "").trim().toUpperCase();
  return /^BG\d{2}$/.test(s) || /^SB\d{2}$/.test(s);
}

function buildBaggageExtraServices(bagLeg, journeyKey) {
  if (!bagLeg) return [];
  const out = [];

  const pushOne = (svc) => {
    const ssr = String(svc?.ssrCode || "").trim().toUpperCase();
    if (!isBaggageSsrCode(ssr)) return;

    const flightNumber =
      String(svc?.flightNumber || "").trim().toUpperCase() || extractFlightNumberFromJourneyKey(journeyKey);

    if (!flightNumber) return;
    out.push({ flightNumber, ssrCode: ssr });
  };

  pushOne(bagLeg.bg);
  pushOne(bagLeg.sb);

  return out;
}

function dedupeExtraServices(list) {
  const base = Array.isArray(list) ? list : [];
  const seen = new Set();
  const out = [];

  for (const x of base) {
    const fn = String(x?.flightNumber || "").trim().toUpperCase();
    const ssr = String(x?.ssrCode || "").trim().toUpperCase();
    if (!fn || !ssr) continue;

    const k = `${fn}::${ssr}`;
    if (seen.has(k)) continue;
    seen.add(k);

    out.push({ flightNumber: fn, ssrCode: ssr });
  }

  return out;
}

/* ========================= Totals: Seat (use effectiveSeat) ========================= */
function seatTotalForJourney(rootSeats, journeyKey) {
  const jKey = String(journeyKey || "");
  let amount = 0;
  let vat = 0;
  let currency = "THB";
  let count = 0;

  const root = rootSeats || {};
  for (const paxId of Object.keys(root)) {
    const seat = root?.[paxId]?.[jKey];
    if (!seat?.seatCode) continue;

    amount += Number(seat?.amount || 0) || 0;
    vat += Number(seat?.vat || 0) || 0;
    currency = seat?.currency || currency;
    count += 1;
  }

  return { amount, vat, total: amount + vat, currency, count };
}

function seatsPerPaxForJourney(rootSeats, journeyKey) {
  const jKey = String(journeyKey || "");
  const root = rootSeats || {};
  const out = [];

  for (const paxId of Object.keys(root)) {
    const seat = root?.[paxId]?.[jKey];
    if (!seat?.seatCode) continue;

    const amt = Number(seat?.amount || 0) || 0;
    const vat = Number(seat?.vat || 0) || 0;

    out.push({
      paxId,
      seatCode: seat.seatCode,
      amount: amt,
      vat,
      total: amt + vat,
      currency: seat?.currency || "THB",
    });
  }

  out.sort((a, b) => Number(a.paxId) - Number(b.paxId));
  return out;
}

/* ========================= Totals: Baggage (use effectiveBaggage) ========================= */
function baggageTotalForJourney(rootBaggage, journeyKey) {
  const jKey = String(journeyKey || "");
  let amount = 0;
  let vat = 0;
  let currency = "THB";
  let count = 0;

  const root = rootBaggage || {};
  for (const paxId of Object.keys(root)) {
    const leg = root?.[paxId]?.[jKey];
    if (!leg) continue;

    const services = [];
    if (leg?.bg?.ssrCode) services.push(leg.bg);
    if (leg?.sb?.ssrCode) services.push(leg.sb);

    if (!services.length) continue;

    count += 1;
    for (const s of services) {
      amount += Number(s?.amount || 0) || 0;
      vat += Number(s?.vat || 0) || 0;
      currency = s?.currency || currency;
    }
  }

  return { amount, vat, total: amount + vat, currency, count };
}

function baggagePerPaxForJourney(rootBaggage, journeyKey) {
  const jKey = String(journeyKey || "");
  const root = rootBaggage || {};
  const out = [];

  for (const paxId of Object.keys(root)) {
    const leg = root?.[paxId]?.[jKey];
    if (!leg) continue;

    const items = [];
    if (leg?.bg?.ssrCode) items.push({ type: "BG", ...leg.bg });
    if (leg?.sb?.ssrCode) items.push({ type: "SB", ...leg.sb });
    if (!items.length) continue;

    const currency = items[0]?.currency || "THB";
    let total = 0;
    for (const it of items) total += Number(it?.amount || 0) || 0;

    out.push({
      paxId,
      items: items.map((it) => ({
        type: it.type,
        ssrCode: it.ssrCode,
        amount: Number(it.amount || 0) || 0,
        currency: it.currency || currency,
        name: it.name || it.description || "",
      })),
      total,
      currency,
    });
  }

  out.sort((a, b) => Number(a.paxId) - Number(b.paxId));
  return out;
}

/* ========================= Totals: Meal/BEV (use effectiveMeal) =========================
  effectiveMeal[paxId][journeyKey] = { meal: service|null, bev: service|null }
  service: { ssrCode, amount, currency, description/name, vat? }
*/
function mealTotalForJourney(rootMeal, journeyKey) {
  const jKey = String(journeyKey || "");
  let amount = 0;
  let vat = 0;
  let currency = "THB";
  let count = 0;

  const root = rootMeal || {};
  for (const paxId of Object.keys(root)) {
    const leg = root?.[paxId]?.[jKey];
    if (!leg) continue;

    const picks = [];
    if (leg?.meal?.ssrCode) picks.push(leg.meal);
    if (leg?.bev?.ssrCode) picks.push(leg.bev);
    if (!picks.length) continue;

    count += 1;
    for (const s of picks) {
      amount += Number(s?.amount || 0) || 0;
      vat += Number(s?.vat || 0) || 0;
      currency = s?.currency || currency;
    }
  }

  return { amount, vat, total: amount + vat, currency, count };
}

function mealPerPaxForJourney(rootMeal, journeyKey) {
  const jKey = String(journeyKey || "");
  const root = rootMeal || {};
  const out = [];

  for (const paxId of Object.keys(root)) {
    const leg = root?.[paxId]?.[jKey];
    if (!leg) continue;

    const items = [];
    if (leg?.meal?.ssrCode) items.push({ type: "MEAL", ...leg.meal });
    if (leg?.bev?.ssrCode) items.push({ type: "BEV", ...leg.bev });
    if (!items.length) continue;

    const currency = items[0]?.currency || "THB";
    let total = 0;
    for (const it of items) total += Number(it?.amount || 0) || 0;

    out.push({
      paxId,
      items: items.map((it) => ({
        type: it.type,
        ssrCode: it.ssrCode,
        amount: Number(it.amount || 0) || 0,
        currency: it.currency || currency,
        name: it.description || it.name || "",
      })),
      total,
      currency,
    });
  }

  out.sort((a, b) => Number(a.paxId) - Number(b.paxId));
  return out;
}

/* ========================= Component ========================= */
export default function FareSidebar({
  t,
  lang,
  isLGUp,
  showKeys,
  setShowKeys,
  selectedOffers,

  params,
  state,

  fareSummary,
  currency,
  fmt,
  grandTotal,

  contactValid,
  canContinue,
  setShowContactErrors,

  setPnrError,
  setPnrLoading,
  pnrLoading,
  pnrError,

  buildBookingPayload,
  travellers,
  forms,
  contact,
  submitHoldBooking,

  navigate,
  scrollToPassengerTop,

  detail,
  rawDetail,
}) {
  // ✅ Seat: read BOTH saved + draft
  const allSavedSeats = useSelector(selectAllSavedSeats);
  const allDraftSeats = useSelector(selectAllDraftSeats);

  // ✅ Baggage: safe read saved + draft
  const allSavedBaggage = useSelector((s) => {
    return (
      s?.baggageSelection?.saved ||
      s?.baggageSelectionSlice?.saved ||
      s?.baggage?.saved ||
      s?.baggageSelections?.saved ||
      {}
    );
  });

  const allDraftBaggage = useSelector((s) => {
    return (
      s?.baggageSelection?.draft ||
      s?.baggageSelectionSlice?.draft ||
      s?.baggage?.draft ||
      s?.baggageSelections?.draft ||
      {}
    );
  });

  // ✅ Meal: safe read saved + draft
  const allSavedMeal = useSelector((s) => {
    return s?.mealSelection?.saved || s?.mealSelectionSlice?.saved || s?.meals?.saved || {};
  });
  const allDraftMeal = useSelector((s) => {
    return s?.mealSelection?.draft || s?.mealSelectionSlice?.draft || s?.meals?.draft || {};
  });

  // ✅ Effective roots (draft preferred)
  const effectiveSeat = React.useMemo(() => buildEffectiveRoot(allSavedSeats, allDraftSeats), [allSavedSeats, allDraftSeats]);
  const effectiveBaggage = React.useMemo(() => buildEffectiveRoot(allSavedBaggage, allDraftBaggage), [allSavedBaggage, allDraftBaggage]);
  const effectiveMeal = React.useMemo(() => buildEffectiveRoot(allSavedMeal, allDraftMeal), [allSavedMeal, allDraftMeal]);

  const [showDetails, setShowDetails] = React.useState(false);

  // ✅ fmt fallback
  const safeFmt = React.useCallback(
    (v, cur) => {
      try {
        if (typeof fmt === "function") return fmt(v, cur);
      } catch {}
      const n = Number(v || 0) || 0;
      return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur || "THB"}`;
    },
    [fmt]
  );

  /* ============================================================
     ✅ normalizedSelectedOffers for ONE-WAY safety
     ============================================================ */
  const normalizedSelectedOffers = React.useMemo(() => {
    const list = Array.isArray(selectedOffers) ? selectedOffers.filter(Boolean) : [];
    if (list.length) return list;

    const fk = state?.fareKey || state?.selectedFareKey || "";
    const jk = state?.journeyKey || state?.selectedJourneyKey || "";
    const token = state?.securityToken || "";

    if (fk && jk) return [{ fareKey: fk, journeyKey: jk, securityToken: token }];
    return [];
  }, [selectedOffers, state]);

  const legs = React.useMemo(() => {
    const list = Array.isArray(normalizedSelectedOffers) ? normalizedSelectedOffers : [];
    return list
      .map((o, idx) => ({
        fareKey: o?.fareKey || o?.id || o?.token || "",
        journeyKey: o?.journeyKey || "",
        securityToken: o?.securityToken || "",
        label:
          list.length >= 2
            ? idx === 0
              ? (t?.depart ?? "Depart")
              : (t?.ret ?? t?.return ?? "Return")
            : (t?.depart ?? "Depart"),
      }))
      .filter((x) => x.fareKey);
  }, [normalizedSelectedOffers, t]);

  // SeatMap debug
  const [debugLegIndex, setDebugLegIndex] = React.useState(0);
  const activeLeg = legs[debugLegIndex] || legs[0] || null;
  const seatMapKey = activeLeg?.fareKey || "unknown";

  const seatMapData = useSelector(selectSeatMapFor(seatMapKey));
  const seatMapStatus = useSelector(selectSeatMapStatus(seatMapKey));
  const seatMapError = useSelector((s) => s?.seatMap?.error?.[seatMapKey] || null);

  const seatMapJson = React.useMemo(() => {
    try {
      return JSON.stringify(seatMapData ?? null, null, 2);
    } catch {
      return String(seatMapData);
    }
  }, [seatMapData]);

  const copyText = async (text) => {
    const value = String(text || "");
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      alert("Copied ✅");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        alert("Copied ✅");
      } catch {
        alert("Copy failed ❌");
      }
    }
  };

  // Totals per leg
  const seatByLeg = React.useMemo(() => {
    return legs.map((lg) => ({
      ...lg,
      seat: lg?.journeyKey ? seatTotalForJourney(effectiveSeat, lg.journeyKey) : { amount: 0, vat: 0, total: 0, currency: currency || "THB", count: 0 },
    }));
  }, [legs, effectiveSeat, currency]);

  const baggageByLeg = React.useMemo(() => {
    return legs.map((lg) => ({
      ...lg,
      baggage: lg?.journeyKey ? baggageTotalForJourney(effectiveBaggage, lg.journeyKey) : { amount: 0, vat: 0, total: 0, currency: currency || "THB", count: 0 },
    }));
  }, [legs, effectiveBaggage, currency]);

  const mealByLeg = React.useMemo(() => {
    return legs.map((lg) => ({
      ...lg,
      meal: lg?.journeyKey ? mealTotalForJourney(effectiveMeal, lg.journeyKey) : { amount: 0, vat: 0, total: 0, currency: currency || "THB", count: 0 },
    }));
  }, [legs, effectiveMeal, currency]);

  const seatGrandTotal = React.useMemo(() => seatByLeg.reduce((s, x) => s + (Number(x?.seat?.total || 0) || 0), 0), [seatByLeg]);
  const baggageGrandTotal = React.useMemo(() => baggageByLeg.reduce((s, x) => s + (Number(x?.baggage?.total || 0) || 0), 0), [baggageByLeg]);
  const mealGrandTotal = React.useMemo(() => mealByLeg.reduce((s, x) => s + (Number(x?.meal?.total || 0) || 0), 0), [mealByLeg]);

  const seatCurrency = seatByLeg?.[0]?.seat?.currency || currency || "THB";
  const baggageCurrency = baggageByLeg?.[0]?.baggage?.currency || currency || "THB";
  const mealCurrency = mealByLeg?.[0]?.meal?.currency || currency || "THB";

  const addonsTotal = seatGrandTotal + baggageGrandTotal + mealGrandTotal;
  const addonsCurrency = currency || seatCurrency || baggageCurrency || mealCurrency || "THB";

  const airTotal = Number(grandTotal || 0) || 0;
  const tripTotal = airTotal + addonsTotal;

  const safeFareSummary = fareSummary || { baseTotal: 0, taxTotalExVat: 0, vatTotal: 0 };
  const hasPriceDetail = !!fareSummary;

  const priceSummary = React.useMemo(() => {
    return {
      currency: currency || addonsCurrency || "THB",
      baseTotal: Number(safeFareSummary?.baseTotal || 0) || 0,
      taxTotalExVat: Number(safeFareSummary?.taxTotalExVat || 0) || 0,
      vatTotal: Number(safeFareSummary?.vatTotal || 0) || 0,
      airTotal,
      seatTotal: seatGrandTotal,
      baggageTotal: baggageGrandTotal,
      mealTotal: mealGrandTotal,
      addonsTotal,
      tripTotal,
    };
  }, [currency, addonsCurrency, safeFareSummary, airTotal, seatGrandTotal, baggageGrandTotal, mealGrandTotal, addonsTotal, tripTotal]);

  const L = {
    tripTotal: t?.tripTotal ?? "Trip total",
    airFare: t?.airFare ?? "Air fare",
    addons: t?.addons ?? "Add-ons",
    details: t?.details ?? "Details",
    hide: t?.hide ?? "Hide",
    none: t?.none ?? "None",
    baggage: t?.baggage ?? "Baggage",
    seat: t?.seat ?? "Seat",
    meal: t?.meal ?? "Meal",
    seatsPerPassenger: t?.seatsPerPassenger ?? "Seats per passenger",
    baggagePerPassenger: t?.baggagePerPassenger ?? "Baggage per passenger",
    mealPerPassenger: t?.mealPerPassenger ?? "Meal per passenger",
    continueBtn: t?.continue ?? "Continue",
    backBtn: t?.back ?? "Back",
    noDetail: t?.noDetail ?? "No price detail found. Please select an offer again.",
  };

  // ✅ Continue visible always; disabled if incomplete
  const canSubmit = !!canContinue && !!contactValid && !!normalizedSelectedOffers.length && hasPriceDetail;

  return (
    <aside className={"bg-white border border-slate-200 rounded-2xl p-4 h-fit " + (isLGUp ? "sticky top-20" : "")}>
      <h3 className="text-lg font-semibold mb-3">{t?.priceSummary || "Fare summary"}</h3>

      {/* Selected fare keys */}
      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-extrabold text-slate-900">{t?.selectedKeysTitle || "Selected fare keys"}</div>
          <button
            type="button"
            onClick={() => setShowKeys((v) => !v)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-extrabold hover:border-blue-400 hover:text-blue-700"
          >
            {showKeys ? (t?.hideKeys || "Hide keys") : (t?.viewKeys || "View keys")}
          </button>
        </div>

        <div className="text-xs text-slate-600 mt-1">{t?.selectedKeysHelp || "Use these keys for submit-hold-booking payload."}</div>

        {!showKeys ? null : normalizedSelectedOffers.length ? (
          <div className="mt-3 space-y-2">
            {normalizedSelectedOffers.map((o, idx) => {
              const label = normalizedSelectedOffers.length >= 2 ? (idx === 0 ? (t?.depart || "Depart") : (t?.ret || "Return")) : (t?.depart || "Depart");
              return (
                <div key={`${o.fareKey || "fk"}-${o.journeyKey || "jk"}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-extrabold text-slate-800 mb-1">
                    {label} #{idx + 1}
                  </div>
                  <div className="text-[11px] text-slate-700">
                    <div><span className="font-semibold">fareKey:</span> <span className="break-all">{o.fareKey || "-"}</span></div>
                    <div className="mt-1"><span className="font-semibold">journeyKey:</span> <span className="break-all">{o.journeyKey || "-"}</span></div>
                    {o.securityToken ? (
                      <div className="mt-1"><span className="font-semibold">securityToken:</span> <span className="break-all">{o.securityToken}</span></div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 text-xs text-rose-600 font-semibold">
            {t?.noSelectedOffers || "No selected offers. Please select an offer again."}
          </div>
        )}
      </div>

      {!hasPriceDetail ? (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-sm">
          {L.noDetail}
        </div>
      ) : null}

      {/* Trip total */}
      <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="text-xs font-bold text-slate-500">{L.tripTotal}</div>

        <div className="mt-1 flex items-baseline justify-between gap-2">
          <div className="text-sm font-extrabold text-slate-900">
            {t?.total || "Total amount"}
            <span className="ml-2 text-[11px] text-slate-500">{legs.length ? `• ${legs.length} leg${legs.length > 1 ? "s" : ""}` : ""}</span>
          </div>
          <div className="text-xl text-sky-700 font-extrabold">{safeFmt(tripTotal, currency)}</div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div className="text-[11px] font-bold text-slate-600">{L.airFare}</div>
            <div className="text-sm font-extrabold text-slate-900">{safeFmt(airTotal, currency)}</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div className="text-[11px] font-bold text-slate-600">{L.addons}</div>
            <div className="text-sm font-extrabold text-slate-900">{safeFmt(addonsTotal, addonsCurrency)}</div>
          </div>
        </div>
      </div>

      {/* Details toggle */}
      <div className="mb-3 rounded-2xl border border-slate-200 bg-white">
        <div className="p-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className={[
              "px-3 py-1.5 rounded-lg border text-sm font-extrabold bg-white",
              showDetails ? "border-slate-300 text-slate-700 hover:border-slate-400" : "border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-700",
            ].join(" ")}
          >
            {showDetails ? L.hide : L.details}
          </button>
        </div>

        {!showDetails ? null : (
          <div className="px-3 pb-3 space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
              <div className="text-slate-600">{t?.baseFare || "Base fare"}</div>
              <div className="font-semibold">{safeFmt(safeFareSummary.baseTotal, currency)}</div>

              <div className="text-slate-600">{t?.tax || "Tax"}</div>
              <div className="font-semibold">{safeFmt(safeFareSummary.taxTotalExVat, currency)}</div>

              <div className="text-slate-600">{t?.vat || "VAT"}</div>
              <div className="font-semibold">{safeFmt(safeFareSummary.vatTotal, currency)}</div>

              <div className="text-slate-600">{L.seat}</div>
              <div className="font-semibold">{safeFmt(seatGrandTotal, seatCurrency)}</div>

              <div className="text-slate-600">{L.baggage}</div>
              <div className="font-semibold">{safeFmt(baggageGrandTotal, baggageCurrency)}</div>

              <div className="text-slate-600">{L.meal}</div>
              <div className="font-semibold">{safeFmt(mealGrandTotal, mealCurrency)}</div>

              <div className="text-slate-600">{t?.addons || "Add-ons"}</div>
              <div className="font-semibold">{safeFmt(addonsTotal, addonsCurrency)}</div>
            </div>

            {/* per pax details per leg */}
            {legs.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-extrabold text-slate-800 mb-2">
                  {t?.addons || "Add-ons"} • {legs.length >= 2 ? "2 legs" : "1 leg"}
                </div>

                <div className="space-y-2">
                  {legs.map((lg, idx) => {
                    const legLabel =
                      legs.length >= 2 ? (idx === 0 ? (t?.depart ?? "Depart") : (t?.ret ?? t?.return ?? "Return")) : (t?.depart ?? "Depart");

                    const legSeatTotal = Number(seatByLeg?.[idx]?.seat?.total || 0) || 0;
                    const legBagTotal = Number(baggageByLeg?.[idx]?.baggage?.total || 0) || 0;
                    const legMealTotal = Number(mealByLeg?.[idx]?.meal?.total || 0) || 0;

                    return (
                      <div key={`${normalizeKey(lg.fareKey)}-${normalizeKey(lg.journeyKey)}-${idx}`} className="rounded-lg border border-slate-200 bg-white p-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-extrabold text-slate-800">{legLabel}</div>
                          <div className="text-[11px] font-extrabold text-slate-900">
                            {safeFmt(legSeatTotal + legBagTotal + legMealTotal, addonsCurrency)}
                          </div>
                        </div>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-extrabold text-sky-700">{L.seatsPerPassenger}</summary>
                          <div className="mt-2 space-y-1">
                            {seatsPerPaxForJourney(effectiveSeat, lg.journeyKey).length === 0 ? (
                              <div className="text-[11px] text-slate-500">{L.none}</div>
                            ) : (
                              seatsPerPaxForJourney(effectiveSeat, lg.journeyKey).map((x) => (
                                <div key={`${lg.journeyKey}-${x.paxId}-${x.seatCode}`} className="flex items-center justify-between text-[11px]">
                                  <div className="text-slate-700">
                                    Pax {x.paxId}: <span className="font-extrabold">{x.seatCode}</span>
                                  </div>
                                  <div className="font-extrabold text-slate-900">{safeFmt(x.total, x.currency || seatCurrency)}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </details>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-extrabold text-sky-700">{L.baggagePerPassenger}</summary>
                          <div className="mt-2 space-y-2">
                            {baggagePerPaxForJourney(effectiveBaggage, lg.journeyKey).length === 0 ? (
                              <div className="text-[11px] text-slate-500">{L.none}</div>
                            ) : (
                              baggagePerPaxForJourney(effectiveBaggage, lg.journeyKey).map((p) => (
                                <div key={`${lg.journeyKey}-bag-${p.paxId}`} className="rounded-lg border border-slate-200 bg-white p-2">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <div className="text-slate-700 font-extrabold">Pax {p.paxId}</div>
                                    <div className="font-extrabold text-slate-900">{safeFmt(p.total, p.currency)}</div>
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    {p.items.map((it, idx2) => (
                                      <div key={`${lg.journeyKey}-bag-${p.paxId}-${it.ssrCode}-${idx2}`} className="flex items-center justify-between text-[11px]">
                                        <div className="text-slate-700">
                                          <span className="font-extrabold">{it.ssrCode}</span>
                                          {it.name ? <span className="text-slate-500"> • {it.name}</span> : null}
                                        </div>
                                        <div className="font-extrabold text-slate-900">{safeFmt(it.amount, it.currency)}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </details>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-extrabold text-sky-700">{L.mealPerPassenger}</summary>
                          <div className="mt-2 space-y-2">
                            {mealPerPaxForJourney(effectiveMeal, lg.journeyKey).length === 0 ? (
                              <div className="text-[11px] text-slate-500">{L.none}</div>
                            ) : (
                              mealPerPaxForJourney(effectiveMeal, lg.journeyKey).map((p) => (
                                <div key={`${lg.journeyKey}-meal-${p.paxId}`} className="rounded-lg border border-slate-200 bg-white p-2">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <div className="text-slate-700 font-extrabold">Pax {p.paxId}</div>
                                    <div className="font-extrabold text-slate-900">{safeFmt(p.total, p.currency)}</div>
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    {p.items.map((it, idx2) => (
                                      <div key={`${lg.journeyKey}-meal-${p.paxId}-${it.ssrCode}-${idx2}`} className="flex items-center justify-between text-[11px]">
                                        <div className="text-slate-700">
                                          <span className="font-extrabold">{it.ssrCode}</span>
                                          {it.name ? <span className="text-slate-500"> • {it.name}</span> : null}
                                        </div>
                                        <div className="font-extrabold text-slate-900">{safeFmt(it.amount, it.currency)}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Continue */}
      <button
        className={[
          "mt-4 w-full px-4 py-3 rounded-full font-bold text-white",
          canSubmit && !pnrLoading ? "bg-sky-500 hover:bg-sky-600" : "bg-slate-300 cursor-not-allowed",
        ].join(" ")}
        disabled={!canSubmit || !!pnrLoading}
        onClick={async () => {
          if (!contactValid) setShowContactErrors?.(true);
          if (!canSubmit) return;

          setPnrError?.("");
          setPnrLoading?.(true);

          try {
            const fareKey = state?.fareKey || state?.selectedFareKey || "";
            const journeyKey = state?.journeyKey || state?.selectedJourneyKey || "";

            const payload = buildBookingPayload({
              agencyCode: state?.agencyCode || "OTATEST",
              travellers,
              forms,
              contact,
              selectedOffers: normalizedSelectedOffers,
              fareKey,
              journeyKey,
            });

            // ✅ keep payload patch as you had (Seat + BG/SB). (Meal payload can be added next step.)
            const patched = {
              ...payload,
              passengerInfos: (payload.passengerInfos || []).map((paxInfo, paxIdx) => {
                const paxId = travellers?.[paxIdx]?.id;

                const effSeatsByJourney = paxId ? effectiveSeat?.[String(paxId)] : null;
                const effBagsByJourney = paxId ? effectiveBaggage?.[String(paxId)] : null;

                const newFlightFareKey = (paxInfo.flightFareKey || []).map((ffk) => {
                  const jKey = ffk?.journeyKey || "";

                  const savedSeatObj = effSeatsByJourney?.[String(jKey)] || null;
                  const selectedSeatObj = buildSelectedSeatObj(savedSeatObj, jKey);

                  const bagLeg = effBagsByJourney?.[String(jKey)] || null;
                  const bagExtras = dedupeExtraServices(buildBaggageExtraServices(bagLeg, jKey));

                  return {
                    ...ffk,
                    extraService: bagExtras,
                    selectedSeat: selectedSeatObj ? [selectedSeatObj] : [],
                  };
                });

                return { ...paxInfo, flightFareKey: newFlightFareKey };
              }),
              priceSummary,
            };

            const resp = await submitHoldBooking(patched);
            const r = resp?.data || resp?.detail?.data || resp;

            navigate("/confirmation", {
              state: {
                ok: true,
                lang: lang || state?.lang || "en",
                holdResponse: r,
                passengerInfos: patched?.passengerInfos || [],
                priceSummary,
                selectedOffers: normalizedSelectedOffers,
                isRoundTripSelected: normalizedSelectedOffers.length >= 2,
              },
            });

            requestAnimationFrame(() => scrollToPassengerTop?.());
          } catch (e) {
            setPnrError?.(e?.message || "Hold booking failed");

            navigate("/confirmation", {
              state: {
                ok: false,
                lang: lang || state?.lang || "en",
                holdResponse: e?.response || { message: e?.message || String(e) },
                priceSummary,
                selectedOffers: normalizedSelectedOffers,
                isRoundTripSelected: normalizedSelectedOffers.length >= 2,
              },
            });

            requestAnimationFrame(() => scrollToPassengerTop?.());
          } finally {
            setPnrLoading?.(false);
          }
        }}
      >
        {pnrLoading ? (t?.loading || "Submitting...") : L.continueBtn}
      </button>

      {!hasPriceDetail ? (
        <div className="mt-2 text-xs text-slate-600">Continue disabled: missing price detail.</div>
      ) : !normalizedSelectedOffers.length ? (
        <div className="mt-2 text-xs text-slate-600">Continue disabled: missing selected fare keys.</div>
      ) : !contactValid ? (
        <div className="mt-2 text-xs text-slate-600">Continue disabled: contact information incomplete.</div>
      ) : !canContinue ? (
        <div className="mt-2 text-xs text-slate-600">Continue disabled: passenger details incomplete.</div>
      ) : null}

      {pnrError ? (
        <div className="mt-2 p-2 text-sm bg-rose-50 border border-rose-200 rounded text-rose-800">{pnrError}</div>
      ) : null}

      {/* Back */}
      <div className="mt-2">
        <button
          onClick={() => {
            navigate?.(-1);
            requestAnimationFrame(() => scrollToPassengerTop?.());
          }}
          className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-300 bg-white"
        >
          {L.backBtn}
        </button>
      </div>

      {/* Raw */}
      <details className="mt-3">
        <summary className="cursor-pointer text-slate-600">{t?.raw || "Show raw response"}</summary>
        <pre className="bg-slate-100 border border-slate-200 rounded p-2 overflow-x-auto text-xs mt-2 max-h-[320px]">
          {JSON.stringify(detail?.raw ?? rawDetail, null, 2)}
        </pre>
      </details>

      {/* Seat map debug */}
      <details className="mt-3">
        <summary className="cursor-pointer text-slate-600">
          Seat map API response
          <span className="ml-2 text-[11px] text-slate-500">
            ({seatMapStatus || "idle"})
            {seatMapError ? " • error" : ""}
          </span>
        </summary>

        {!legs.length ? (
          <div className="mt-2 text-sm text-rose-700">No selectedOffers / fareKey found → cannot locate seat map response in store.</div>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-2">
              <div className="text-[11px] text-slate-600 font-semibold">Leg</div>
              <select
                value={String(debugLegIndex)}
                onChange={(e) => setDebugLegIndex(Number(e.target.value))}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1 bg-white"
              >
                {legs.map((lg, idx) => (
                  <option key={`${lg.fareKey}-${idx}`} value={idx}>
                    {lg.label} — {String(lg.fareKey).slice(0, 18)}…
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyText(seatMapJson)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-extrabold hover:border-blue-400 hover:text-blue-700 disabled:opacity-50"
                disabled={!seatMapData}
              >
                Copy all response
              </button>

              <button
                type="button"
                onClick={() => copyText(String(seatMapKey))}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              >
                Copy key
              </button>

              <div className="text-[11px] text-slate-500 break-all">key: {String(seatMapKey)}</div>
            </div>

            {seatMapError ? (
              <div className="mt-2 p-2 text-sm bg-rose-50 border border-rose-200 rounded text-rose-800">{String(seatMapError)}</div>
            ) : null}

            <pre className="bg-slate-100 border border-slate-200 rounded p-2 overflow-x-auto text-xs mt-2 max-h-[420px]">{seatMapJson}</pre>
          </>
        )}
      </details>

      {normalizedSelectedOffers.length >= 2 ? (
        <div className="mt-3 text-[11px] text-slate-600">✅ Round-trip selectedOffers detected (2 legs).</div>
      ) : (
        <div className="mt-3 text-[11px] text-slate-600">✅ One-way selectedOffers detected (1 leg).</div>
      )}
    </aside>
  );
}
