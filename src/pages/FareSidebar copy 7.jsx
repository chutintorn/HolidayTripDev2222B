// src/pages/FareSidebar.jsx
import React from "react";
import { useSelector } from "react-redux";
import { selectAllSavedSeats } from "../redux/seatSelectionSlice";

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

/* ========================= Helpers: baggage SSR only ========================= */
function isBaggageSsrCode(code) {
  const s = String(code || "").trim().toUpperCase();
  // ✅ accept only BGdd or SBdd (2 digits)
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

  // expected: { bg:{...}, sb:{...} }
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

/* ========================= Helpers: meal/drink SSR only ========================= */
function isMealSsrCode(code) {
  const s = String(code || "").trim().toUpperCase();
  // ✅ accept MHdd or MSdd (2 digits)
  return /^(MH|MS)\d{2}$/.test(s);
}

function isBeverageSsrCode(code) {
  const s = String(code || "").trim().toUpperCase();
  // ✅ accept BEV + digits (e.g. BEV1, BEV2, BEV10)
  return /^BEV\d+$/.test(s);
}

function buildMealDrinkExtraServices(mealLeg, journeyKey) {
  if (!mealLeg) return [];
  const out = [];

  const pushOne = (svc) => {
    const ssr = String(svc?.ssrCode || "").trim().toUpperCase();
    if (!isMealSsrCode(ssr) && !isBeverageSsrCode(ssr)) return;

    const flightNumber =
      String(svc?.flightNumber || "").trim().toUpperCase() || extractFlightNumberFromJourneyKey(journeyKey);

    if (!flightNumber) return;
    out.push({ flightNumber, ssrCode: ssr });
  };

  // expected: { meal: {...} , bev: {...} }
  pushOne(mealLeg.meal);
  pushOne(mealLeg.bev);

  return out;
}

/* ========================= Helpers: seat totals ========================= */
function seatTotalForJourney(allSavedSeats, journeyKey) {
  const jKey = String(journeyKey || "");
  let amount = 0;
  let vat = 0;
  let currency = "THB";
  let count = 0;

  const root = allSavedSeats || {};
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

function seatsPerPaxForJourney(allSavedSeats, journeyKey) {
  const jKey = String(journeyKey || "");
  const root = allSavedSeats || {};
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

/* ========================= Helpers: baggage totals (effective) ========================= */
/**
 * baggage expected:
 *  root[paxId][journeyKey] = { bg:{ssrCode,amount,currency,vat?,name?,flightNumber?}, sb:{...} }
 */
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

/**
 * ✅ Effective baggage root:
 * if draft exists for paxId+journeyKey -> use draft
 * else -> use saved
 */
function buildEffectiveBaggageRoot(savedRoot, draftRoot) {
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

/* ========================= Helpers: meal/drink totals (effective) ========================= */
/**
 * meal expected:
 *  root[paxId][journeyKey] = { meal:{ssrCode,amount,currency,vat?,name?,flightNumber?} , bev:{...} }
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

    const services = [];
    if (leg?.meal?.ssrCode) services.push(leg.meal);
    if (leg?.bev?.ssrCode) services.push(leg.bev);

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
        ssrCode: String(it.ssrCode || "").trim().toUpperCase(),
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

/**
 * ✅ Effective meal root:
 * if draft exists for paxId+journeyKey -> use draft
 * else -> use saved
 */
function buildEffectiveMealRoot(savedRoot, draftRoot) {
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

  isRoundTripSelected,
}) {
  const allSavedSeats = useSelector(selectAllSavedSeats);

  // ✅ Safe read baggage saved + draft (no selector import)
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

  // ✅ Safe read meal saved + draft (no selector import)
  const allSavedMeal = useSelector((s) => {
    return (
      s?.mealSelection?.saved ||
      s?.mealSelectionSlice?.saved ||
      s?.meals?.saved ||
      s?.mealSelections?.saved ||
      {}
    );
  });

  const allDraftMeal = useSelector((s) => {
    return (
      s?.mealSelection?.draft ||
      s?.mealSelectionSlice?.draft ||
      s?.meals?.draft ||
      s?.mealSelections?.draft ||
      {}
    );
  });

  // ✅ effective meal (draft preferred if exists)
  const effectiveMeal = React.useMemo(() => {
    return buildEffectiveMealRoot(allSavedMeal, allDraftMeal);
  }, [allSavedMeal, allDraftMeal]);

  // ✅ effective baggage (draft preferred if exists)
  const effectiveBaggage = React.useMemo(() => {
    return buildEffectiveBaggageRoot(allSavedBaggage, allDraftBaggage);
  }, [allSavedBaggage, allDraftBaggage]);

  const [showDetails, setShowDetails] = React.useState(false);

  /* ============================================================
     ✅ KEY FIX: normalizedSelectedOffers for ONE-WAY safety
     - STRICTLY require BOTH fareKey and journeyKey
     - prevents ghost leg (fareKey exists but journeyKey empty)
     ============================================================ */
  const normalizedSelectedOffers = React.useMemo(() => {
    const listRaw = Array.isArray(selectedOffers) ? selectedOffers : [];

    const list = listRaw
      .filter(Boolean)
      .map((o) => ({
        fareKey: o?.fareKey || "",
        journeyKey: o?.journeyKey || "",
        securityToken: o?.securityToken || "",
      }))
      .filter((o) => o.fareKey && o.journeyKey);

    if (list.length) return list;

    const fk = state?.fareKey || state?.selectedFareKey || "";
    const jk = state?.journeyKey || state?.selectedJourneyKey || "";
    const token = state?.securityToken || "";

    if (fk && jk) return [{ fareKey: fk, journeyKey: jk, securityToken: token }];

    return [];
  }, [selectedOffers, state]);

  // SeatMap debug + legs (use normalizedSelectedOffers)
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
      // ✅ KEY FIX: require BOTH fareKey & journeyKey
      .filter((x) => x.fareKey && x.journeyKey);
  }, [normalizedSelectedOffers, t]);

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

  // Seat totals
  const seatByLeg = React.useMemo(() => {
    const out = [];
    for (const lg of legs) {
      const jKey = lg?.journeyKey || "";
      const seat = jKey
        ? seatTotalForJourney(allSavedSeats, jKey)
        : { amount: 0, vat: 0, total: 0, currency: currency || "THB", count: 0 };
      out.push({ ...lg, seat });
    }
    return out;
  }, [legs, allSavedSeats, currency]);

  const seatGrandTotal = React.useMemo(() => {
    return seatByLeg.reduce((sum, x) => sum + (Number(x?.seat?.total || 0) || 0), 0);
  }, [seatByLeg]);

  const seatCurrency = React.useMemo(() => {
    const c = seatByLeg?.[0]?.seat?.currency;
    return c || currency || "THB";
  }, [seatByLeg, currency]);

  // ✅ Baggage totals (use effective baggage)
  const baggageByLeg = React.useMemo(() => {
    const out = [];
    for (const lg of legs) {
      const jKey = lg?.journeyKey || "";
      const baggage = jKey
        ? baggageTotalForJourney(effectiveBaggage, jKey)
        : { amount: 0, vat: 0, total: 0, currency: currency || "THB", count: 0 };
      out.push({ ...lg, baggage });
    }
    return out;
  }, [legs, effectiveBaggage, currency]);

  const baggageGrandTotal = React.useMemo(() => {
    return baggageByLeg.reduce((sum, x) => sum + (Number(x?.baggage?.total || 0) || 0), 0);
  }, [baggageByLeg]);

  const baggageCurrency = React.useMemo(() => {
    const c = baggageByLeg?.[0]?.baggage?.currency;
    return c || currency || "THB";
  }, [baggageByLeg, currency]);

  // ✅ Meal/Drink totals (use effective meal)
  const mealByLeg = React.useMemo(() => {
    const out = [];
    for (const lg of legs) {
      const jKey = lg?.journeyKey || "";
      const meal = jKey
        ? mealTotalForJourney(effectiveMeal, jKey)
        : { amount: 0, vat: 0, total: 0, currency: currency || "THB", count: 0 };
      out.push({ ...lg, meal });
    }
    return out;
  }, [legs, effectiveMeal, currency]);

  const mealGrandTotal = React.useMemo(() => {
    return mealByLeg.reduce((sum, x) => sum + (Number(x?.meal?.total || 0) || 0), 0);
  }, [mealByLeg]);

  const mealCurrency = React.useMemo(() => {
    const c = mealByLeg?.[0]?.meal?.currency;
    return c || currency || "THB";
  }, [mealByLeg, currency]);

  const addonsTotal = seatGrandTotal + baggageGrandTotal + mealGrandTotal;
  const addonsCurrency = currency || seatCurrency || baggageCurrency || mealCurrency || "THB";

  const airTotal = Number(grandTotal || 0) || 0;
  const tripTotal = airTotal + addonsTotal;

  // Snapshot for downstream
  const priceSummary = React.useMemo(() => {
    return {
      currency: currency || addonsCurrency || "THB",
      baseTotal: Number(fareSummary?.baseTotal || 0) || 0,
      taxTotalExVat: Number(fareSummary?.taxTotalExVat || 0) || 0,
      vatTotal: Number(fareSummary?.vatTotal || 0) || 0,
      airTotal,
      seatTotal: seatGrandTotal,
      baggageTotal: baggageGrandTotal,
      mealTotal: mealGrandTotal,
      addonsTotal,
      tripTotal,
    };
  }, [
    currency,
    addonsCurrency,
    fareSummary,
    airTotal,
    seatGrandTotal,
    baggageGrandTotal,
    mealGrandTotal,
    addonsTotal,
    tripTotal,
  ]);

  const L = {
    tripTotal: t?.tripTotal ?? "Trip total",
    airFare: t?.airFare ?? "Air fare",
    addons: t?.addons ?? "Add-ons",
    details: t?.details ?? "Details",
    hide: t?.hide ?? "Hide",
    none: t?.none ?? "None",
    baggage: t?.baggage ?? "Baggage",
    seat: t?.seat ?? "Seat",
    seatsPerPassenger: t?.seatsPerPassenger ?? "Seats per passenger",
    baggagePerPassenger: t?.baggagePerPassenger ?? "Baggage per passenger",
    meal: t?.meal ?? "Meal",
    bev: t?.beverage ?? t?.bev ?? "Drink",
    mealPerPassenger: t?.mealPerPassenger ?? "Meal & drink per passenger",
  };

  return (
    <aside className={"bg-white border border-slate-200 rounded-2xl p-4 h-fit " + (isLGUp ? "sticky top-20" : "")}>
      <h3 className="text-lg font-semibold mb-3">{t.priceSummary}</h3>

      {/* Selected fare keys */}
      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-extrabold text-slate-900">{t.selectedKeysTitle}</div>
          <button
            type="button"
            onClick={() => setShowKeys((v) => !v)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-extrabold hover:border-blue-400 hover:text-blue-700"
          >
            {showKeys ? t.hideKeys : t.viewKeys}
          </button>
        </div>

        <div className="text-xs text-slate-600 mt-1">{t.selectedKeysHelp}</div>

        {!showKeys ? null : normalizedSelectedOffers.length ? (
          <div className="mt-3 space-y-2">
            {normalizedSelectedOffers.map((o, idx) => {
              const label = normalizedSelectedOffers.length >= 2 ? (idx === 0 ? t.depart : t.ret) : t.depart;

              return (
                <div
                  key={`${o.fareKey || "fk"}-${o.journeyKey || "jk"}-${idx}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                >
                  <div className="text-xs font-extrabold text-slate-800 mb-1">
                    {label} #{idx + 1}
                  </div>
                  <div className="text-[11px] text-slate-700">
                    <div>
                      <span className="font-semibold">fareKey:</span>{" "}
                      <span className="break-all">{o.fareKey || "-"}</span>
                    </div>
                    <div className="mt-1">
                      <span className="font-semibold">journeyKey:</span>{" "}
                      <span className="break-all">{o.journeyKey || "-"}</span>
                    </div>
                    {o.securityToken ? (
                      <div className="mt-1">
                        <span className="font-semibold">securityToken:</span>{" "}
                        <span className="break-all">{o.securityToken}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 text-xs text-rose-600 font-semibold">{t.noSelectedOffers}</div>
        )}
      </div>

      {fareSummary ? (
        <>
          {/* Trip total */}
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-bold text-slate-500">{L.tripTotal}</div>

            <div className="mt-1 flex items-baseline justify-between gap-2">
              <div className="text-sm font-extrabold text-slate-900">
                {t.total}
                <span className="ml-2 text-[11px] text-slate-500">
                  {legs.length ? `• ${legs.length} leg${legs.length > 1 ? "s" : ""}` : ""}
                </span>
              </div>
              <div className="text-xl text-sky-700 font-extrabold">{fmt(tripTotal, currency)}</div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="text-[11px] font-bold text-slate-600">{L.airFare}</div>
                <div className="text-sm font-extrabold text-slate-900">{fmt(airTotal, currency)}</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="text-[11px] font-bold text-slate-600">{L.addons}</div>
                <div className="text-sm font-extrabold text-slate-900">{fmt(addonsTotal, addonsCurrency)}</div>
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
                  showDetails
                    ? "border-slate-300 text-slate-700 hover:border-slate-400"
                    : "border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-700",
                ].join(" ")}
              >
                {showDetails ? (L.hide || "Hide") : (L.details || "Details")}
              </button>
            </div>

            {!showDetails ? null : (
              <div className="px-3 pb-3 space-y-3">
                <div className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                  <div className="text-slate-600">{t.baseFare}</div>
                  <div className="font-semibold">{fmt(fareSummary.baseTotal, currency)}</div>

                  <div className="text-slate-600">{t.tax}</div>
                  <div className="font-semibold">{fmt(fareSummary.taxTotalExVat, currency)}</div>

                  <div className="text-slate-600">{t.vat}</div>
                  <div className="font-semibold">{fmt(fareSummary.vatTotal, currency)}</div>

                  <div className="text-slate-600">{L.seat}</div>
                  <div className="font-semibold">{fmt(seatGrandTotal, seatCurrency)}</div>

                  <div className="text-slate-600">{L.baggage}</div>
                  <div className="font-semibold">{fmt(baggageGrandTotal, baggageCurrency)}</div>

                  <div className="text-slate-600">{L.meal}</div>
                  <div className="font-semibold">{fmt(mealGrandTotal, mealCurrency)}</div>

                  <div className="text-slate-600">{t.addons}</div>
                  <div className="font-semibold">{fmt(addonsTotal, addonsCurrency)}</div>
                </div>

                {/* per pax details */}
                {seatByLeg.length ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-extrabold text-slate-800 mb-2">
                      {t.addons} • {seatByLeg.length >= 2 ? "2 legs" : "1 leg"}
                    </div>

                    <div className="space-y-2">
                      {seatByLeg.map((lg, idx) => {
                        const legLabel =
                          seatByLeg.length >= 2
                            ? idx === 0
                              ? (t?.depart ?? "Depart")
                              : (t?.ret ?? t?.return ?? "Return")
                            : (t?.depart ?? "Depart");

                        return (
                          <div
                            key={`${normalizeKey(lg.fareKey)}-${normalizeKey(lg.journeyKey)}-${idx}`}
                            className="rounded-lg border border-slate-200 bg-white p-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-[11px] font-extrabold text-slate-800">{legLabel}</div>
                              <div className="text-[11px] font-extrabold text-slate-900">
                                {fmt(
                                  (Number(lg?.seat?.total || 0) || 0) +
                                    (Number(baggageByLeg?.[idx]?.baggage?.total || 0) || 0) +
                                    (Number(mealByLeg?.[idx]?.meal?.total || 0) || 0),
                                  addonsCurrency
                                )}
                              </div>
                            </div>

                            <details className="mt-2">
                              <summary className="cursor-pointer text-[11px] font-extrabold text-sky-700">
                                {L.seatsPerPassenger}
                              </summary>
                              <div className="mt-2 space-y-1">
                                {seatsPerPaxForJourney(allSavedSeats, lg.journeyKey).length === 0 ? (
                                  <div className="text-[11px] text-slate-500">{L.none}</div>
                                ) : (
                                  seatsPerPaxForJourney(allSavedSeats, lg.journeyKey).map((x) => (
                                    <div
                                      key={`${lg.journeyKey}-${x.paxId}-${x.seatCode}`}
                                      className="flex items-center justify-between text-[11px]"
                                    >
                                      <div className="text-slate-700">
                                        Pax {x.paxId}: <span className="font-extrabold">{x.seatCode}</span>
                                      </div>
                                      <div className="font-extrabold text-slate-900">
                                        {fmt(x.total, x.currency || seatCurrency)}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </details>

                            <details className="mt-2">
                              <summary className="cursor-pointer text-[11px] font-extrabold text-sky-700">
                                {L.baggagePerPassenger}
                              </summary>
                              <div className="mt-2 space-y-2">
                                {baggagePerPaxForJourney(effectiveBaggage, lg.journeyKey).length === 0 ? (
                                  <div className="text-[11px] text-slate-500">{L.none}</div>
                                ) : (
                                  baggagePerPaxForJourney(effectiveBaggage, lg.journeyKey).map((p) => (
                                    <div
                                      key={`${lg.journeyKey}-bag-${p.paxId}`}
                                      className="rounded-lg border border-slate-200 bg-white p-2"
                                    >
                                      <div className="flex items-center justify-between text-[11px]">
                                        <div className="text-slate-700 font-extrabold">Pax {p.paxId}</div>
                                        <div className="font-extrabold text-slate-900">{fmt(p.total, p.currency)}</div>
                                      </div>
                                      <div className="mt-1 space-y-1">
                                        {p.items.map((it, idx2) => (
                                          <div
                                            key={`${lg.journeyKey}-bag-${p.paxId}-${it.ssrCode}-${idx2}`}
                                            className="flex items-center justify-between text-[11px]"
                                          >
                                            <div className="text-slate-700">
                                              <span className="font-extrabold">{it.ssrCode}</span>
                                              {it.name ? <span className="text-slate-500"> • {it.name}</span> : null}
                                            </div>
                                            <div className="font-extrabold text-slate-900">{fmt(it.amount, it.currency)}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </details>

                            <details className="mt-2">
                              <summary className="cursor-pointer text-[11px] font-extrabold text-sky-700">
                                {L.mealPerPassenger}
                              </summary>
                              <div className="mt-2 space-y-2">
                                {mealPerPaxForJourney(effectiveMeal, lg.journeyKey).length === 0 ? (
                                  <div className="text-[11px] text-slate-500">{L.none}</div>
                                ) : (
                                  mealPerPaxForJourney(effectiveMeal, lg.journeyKey).map((p) => (
                                    <div
                                      key={`${lg.journeyKey}-meal-${p.paxId}`}
                                      className="rounded-lg border border-slate-200 bg-white p-2"
                                    >
                                      <div className="flex items-center justify-between text-[11px]">
                                        <div className="text-slate-700 font-extrabold">Pax {p.paxId}</div>
                                        <div className="font-extrabold text-slate-900">{fmt(p.total, p.currency)}</div>
                                      </div>
                                      <div className="mt-1 space-y-1">
                                        {p.items.map((it, idx2) => (
                                          <div
                                            key={`${lg.journeyKey}-meal-${p.paxId}-${it.ssrCode}-${idx2}`}
                                            className="flex items-center justify-between text-[11px]"
                                          >
                                            <div className="text-slate-700">
                                              <span className="font-extrabold">{it.ssrCode}</span>
                                              {it.name ? <span className="text-slate-500"> • {it.name}</span> : null}
                                            </div>
                                            <div className="font-extrabold text-slate-900">{fmt(it.amount, it.currency)}</div>
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

          {/* ✅ Continue: payload patch (ONE-WAY SAFE + ONLY BG/SB + Seat + MH/MS/BEV) */}
          <button
            className="mt-4 w-full px-4 py-3 rounded-full font-bold text-white bg-sky-500 hover:bg-sky-600 brightness-95"
            onClick={async () => {
              if (!contactValid) setShowContactErrors(true);
              if (!canContinue) return;

              setPnrError("");
              setPnrLoading(true);

              try {
                if (!normalizedSelectedOffers.length) {
                  throw new Error("No selectedOffers / fareKey / journeyKey found (one-way safe guard).");
                }

                const fareKey = state?.fareKey || state?.selectedFareKey || "";
                const journeyKey = state?.journeyKey || state?.selectedJourneyKey || "";

                const payload = buildBookingPayload({
                  agencyCode: state?.agencyCode || "OTATEST",
                  travellers,
                  forms,
                  contact,
                  selectedOffers: normalizedSelectedOffers, // ✅ FIX
                  fareKey,
                  journeyKey,
                });

                const patched = {
                  ...payload,
                  passengerInfos: (payload.passengerInfos || []).map((paxInfo, paxIdx) => {
                    const paxId = travellers?.[paxIdx]?.id;

                    const savedSeatsByJourney = paxId ? allSavedSeats?.[String(paxId)] : null;

                    // ✅ use effective baggage (draft preferred if exists)
                    const effBagsByJourney = paxId ? effectiveBaggage?.[String(paxId)] : null;

                    // ✅ use effective meal (draft preferred if exists)
                    const effMealByJourney = paxId ? effectiveMeal?.[String(paxId)] : null;

                    const newFlightFareKey = (paxInfo.flightFareKey || []).map((ffk) => {
                      const jKey = ffk?.journeyKey || "";

                      // seat from saved store
                      const savedSeatObj = savedSeatsByJourney?.[String(jKey)] || null;
                      const selectedSeatObj = buildSelectedSeatObj(savedSeatObj, jKey);

                      // baggage from effective store (ONLY BGdd/SBdd)
                      const bagLeg = effBagsByJourney?.[String(jKey)] || null;
                      const bagExtras = buildBaggageExtraServices(bagLeg, jKey);

                      // meal/drink from effective store (ONLY MH/MS/BEV)
                      const mealLeg = effMealByJourney?.[String(jKey)] || null;
                      const mealExtras = buildMealDrinkExtraServices(mealLeg, jKey);

                      const extraService = dedupeExtraServices([...(bagExtras || []), ...(mealExtras || [])]);

                      return {
                        ...ffk,
                        // ✅ IMPORTANT: DO NOT keep any SSR from API (RFND etc.)
                        // ✅ Put ONLY what user selected on web page (BG/SB/MH/MS/BEV)
                        extraService,
                        selectedSeat: selectedSeatObj ? [selectedSeatObj] : [],
                      };
                    });

                    return { ...paxInfo, flightFareKey: newFlightFareKey };
                  }),
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
                    selectedOffers: normalizedSelectedOffers, // ✅ FIX
                    isRoundTripSelected: normalizedSelectedOffers.length >= 2, // ✅ FIX
                  },
                });

                requestAnimationFrame(scrollToPassengerTop);
              } catch (e) {
                setPnrError(e?.message || "Hold booking failed");

                navigate("/confirmation", {
                  state: {
                    ok: false,
                    lang: lang || state?.lang || "en",
                    holdResponse: e?.response || { message: e?.message || String(e) },
                    priceSummary,
                    selectedOffers: normalizedSelectedOffers, // ✅ keep consistent
                    isRoundTripSelected: normalizedSelectedOffers.length >= 2,
                  },
                });

                requestAnimationFrame(scrollToPassengerTop);
              } finally {
                setPnrLoading(false);
              }
            }}
          >
            {pnrLoading ? "Submitting..." : t.continue}
          </button>

          {pnrError && (
            <div className="mt-2 p-2 text-sm bg-rose-50 border border-rose-200 rounded text-rose-800">
              {pnrError}
            </div>
          )}

          {/* Back */}
          <div className="mt-2">
            <button
              onClick={() => {
                navigate(-1);
                requestAnimationFrame(scrollToPassengerTop);
              }}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-300 bg-white"
            >
              {t.back}
            </button>
          </div>

          {/* Raw */}
          <details className="mt-3">
            <summary className="cursor-pointer text-slate-600">{t.raw}</summary>
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
              <div className="mt-2 text-sm text-rose-700">
                No selectedOffers / fareKey found → cannot locate seat map response in store.
              </div>
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
                  <div className="mt-2 p-2 text-sm bg-rose-50 border border-rose-200 rounded text-rose-800">
                    {String(seatMapError)}
                  </div>
                ) : null}

                <pre className="bg-slate-100 border border-slate-200 rounded p-2 overflow-x-auto text-xs mt-2 max-h-[420px]">
                  {seatMapJson}
                </pre>
              </>
            )}
          </details>

          {normalizedSelectedOffers.length >= 2 ? (
            <div className="mt-3 text-[11px] text-slate-600">✅ Round-trip selectedOffers detected (2 legs).</div>
          ) : (
            <div className="mt-3 text-[11px] text-slate-600">✅ One-way selectedOffers detected (1 leg).</div>
          )}
        </>
      ) : (
        (state?.requestKey || params.get("key") || state?.priceDetail) && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800">{t.noDetail}</div>
        )
      )}
    </aside>
  );
}
