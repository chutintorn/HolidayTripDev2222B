// src/components/MealPanel.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setDraftMealRadio,
  setDraftBeverageRadio,
  saveMealSelection,
  clearDraftMealSelection,
  selectDraftMealSelection,
  selectSavedMealSelection,
} from "../redux/mealSelectionSlice";

/* ========================= Helpers ========================= */
function normalize(v) {
  return String(v || "").trim().replace(/\s+/g, "").toUpperCase();
}

function extractIsoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /(20\d{2})(\d{2})(\d{2})/.exec(s);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function parseRouteFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /^([A-Z]{3})([A-Z]{3})/.exec(s);
  if (!m) return { origin: "", destination: "" };
  return { origin: m[1], destination: m[2] };
}

function sanitizeFlightNumber(v) {
  const s = String(v || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z]{2})(\d{2,4})/.exec(s);
  if (!m) return "";
  return `${m[1]}${m[2]}`;
}

function extractFlightNoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "").toUpperCase();
  const m =
    /_([A-Z]{2}\d{2,4})(?=20\d{6})/.exec(s) || /_([A-Z]{2}\d{2,4})/.exec(s);
  return sanitizeFlightNumber(m ? m[1] : "");
}

function weekdayPillClass(d) {
  if (!d) return "bg-slate-100 text-slate-700 border-slate-200";
  const day = d.getDay();
  const map = {
    0: "bg-rose-50 text-rose-700 border-rose-200",
    1: "bg-sky-50 text-sky-700 border-sky-200",
    2: "bg-indigo-50 text-indigo-700 border-indigo-200",
    3: "bg-emerald-50 text-emerald-700 border-emerald-200",
    4: "bg-amber-50 text-amber-800 border-amber-200",
    5: "bg-violet-50 text-violet-700 border-violet-200",
    6: "bg-teal-50 text-teal-700 border-teal-200",
  };
  return map[day] || "bg-slate-100 text-slate-700 border-slate-200";
}

function weekdayShort(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function fmtDateLong(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateShort(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(x, currency = "THB") {
  const n = Number(x);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      n
    );
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

/* rawDetail can be many shapes */
function pickAirlinesFromRawDetail(rawDetail) {
  if (!rawDetail) return [];
  if (Array.isArray(rawDetail?.airlines)) return rawDetail.airlines;
  if (Array.isArray(rawDetail?.data?.airlines)) return rawDetail.data.airlines;
  if (Array.isArray(rawDetail?.data?.data?.airlines)) return rawDetail.data.data.airlines;
  if (Array.isArray(rawDetail?.detail?.data?.airlines)) return rawDetail.detail.data.airlines;
  if (Array.isArray(rawDetail?.detail?.data?.data?.airlines)) return rawDetail.detail.data.data.airlines;
  if (Array.isArray(rawDetail?.detail?.airlines)) return rawDetail.detail.airlines;
  return [];
}

function isMealCode(code) {
  const c = normalize(code);
  return /^MH\d{2}$/.test(c) || /^MS\d{2}$/.test(c);
}

// support BEV1/BEV2 (1 digit) and BEV10.. (2 digits)
function isBeverageCode(code) {
  const c = normalize(code);
  return /^BEV\d{1,2}$/.test(c);
}

function serviceKey(svc) {
  return normalize(svc?.ssrCode);
}

function samePick(a, b) {
  const aa = normalize(a?.ssrCode);
  const bb = normalize(b?.ssrCode);
  return aa === bb;
}

/* ========================= Component ========================= */
export default function MealPanel({ paxId, selectedOffers = [], rawDetail, t }) {
  const dispatch = useDispatch();
  const [legIndex, setLegIndex] = useState(0);

  const airlines = useMemo(() => pickAirlinesFromRawDetail(rawDetail), [rawDetail]);

  const legs = useMemo(() => {
    const so = Array.isArray(selectedOffers) ? selectedOffers : [];
    return so
      .filter(Boolean)
      .map((o, idx) => ({
        idx,
        journeyKey: String(o?.journeyKey || ""),
        label: idx === 0 ? (t?.depart ?? "Depart") : (t?.return ?? "Return"),
      }))
      .filter((x) => x.journeyKey);
  }, [selectedOffers, t]);

  useEffect(() => {
    if (!legs.length) return;
    if (legIndex > legs.length - 1) setLegIndex(0);
  }, [legs.length, legIndex]);

  if (!legs.length) {
    return (
      <div className="text-sm text-slate-600">
        {t?.noFlights ?? "No selectedOffers found."}
      </div>
    );
  }

  const activeLeg = legs[legIndex] || null;
  const journeyKey = activeLeg?.journeyKey || "";

  const flightNo = useMemo(() => extractFlightNoFromJourneyKey(journeyKey), [journeyKey]);
  const route = useMemo(() => parseRouteFromJourneyKey(journeyKey), [journeyKey]);

  const departDate = useMemo(() => {
    const iso = extractIsoFromJourneyKey(journeyKey);
    return iso ? new Date(`${iso}T00:00:00`) : null;
  }, [journeyKey]);

  const dayText = useMemo(() => weekdayShort(departDate), [departDate]);
  const dateText = useMemo(() => fmtDateLong(departDate), [departDate]);
  const dateShort = useMemo(() => fmtDateShort(departDate), [departDate]);

  // Redux (draft/saved per paxId + journeyKey)
  const draft = useSelector(selectDraftMealSelection(paxId, journeyKey));
  const saved = useSelector(selectSavedMealSelection(paxId, journeyKey));

  // Like baggage: if draft exists -> show draft, else show saved
  const ui = draft != null ? draft : saved != null ? saved : { meal: null, bev: null };

  const uiMeal = ui?.meal ?? null;
  const uiBev = ui?.bev ?? null;

  // change detection (for Confirm enable)
  const savedMeal = saved?.meal ?? null;
  const savedBev = saved?.bev ?? null;
  const changed = !(samePick(uiMeal, savedMeal) && samePick(uiBev, savedBev));
  const canConfirm = !!journeyKey && changed;
  const canRelease = !!journeyKey && draft != null;

  // robust services filter (use service.flightNumber)
  const servicesForFlight = useMemo(() => {
    if (!flightNo) return { meals: [], bevs: [] };

    const all = [];
    for (const a of airlines) {
      const services = Array.isArray(a?.availableExtraServices) ? a.availableExtraServices : [];
      for (const s of services) all.push(s);
    }

    const byFlight = all.filter((s) => normalize(s?.flightNumber) === normalize(flightNo));

    const meals = byFlight.filter((s) => isMealCode(s?.ssrCode));
    const bevs = byFlight.filter((s) => isBeverageCode(s?.ssrCode));
    return { meals, bevs };
  }, [airlines, flightNo]);

  function RadioRow({ svc, group, checked, onPick }) {
    const ssr = normalize(svc?.ssrCode);
    const desc = svc?.description || svc?.name || "";
    const amount = Number(svc?.amount || 0) || 0;
    const cur = svc?.currency || "THB";

    return (
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-2 hover:border-sky-300 cursor-pointer">
        <input
          type="radio"
          name={`${String(paxId)}-${journeyKey}-${group}`}
          className="mt-1 h-4 w-4 accent-sky-600"
          checked={!!checked}
          onChange={onPick}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="font-extrabold text-slate-900 text-[13px]">{ssr}</div>
            <div className="text-[12px] font-bold text-slate-700">
              {amount ? `+${formatMoney(amount, cur)}` : ""}
            </div>
          </div>
          {!desc ? null : (
            <div className="mt-0.5 text-[12px] text-slate-700 break-words">{desc}</div>
          )}
        </div>
      </label>
    );
  }

  const emptyHint = (text) => (
    <div className="text-[12px] text-slate-500 bg-white border border-slate-200 rounded-lg p-3">
      {text}
    </div>
  );

  // ✅ button style match Baggage
  const tabBtnClass = (active) =>
    [
      "px-4 py-1.5 rounded-full border text-[12px] font-extrabold",
      active
        ? "bg-sky-600 text-white border-sky-600"
        : "bg-white text-slate-700 border-slate-300 hover:border-sky-400",
    ].join(" ");

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        {/* ✅ Header: Meal + Depart/Return same line like Baggage */}
        <div className="flex items-center justify-between gap-3">
          <div className="font-extrabold text-slate-900">{t?.mealLabel ?? "Meal"}</div>

          {legs.length <= 1 ? null : (
            <div className="flex gap-2 shrink-0">
              {legs.map((l) => {
                const active = l.idx === legIndex;
                return (
                  <button
                    key={`${l.journeyKey}-${l.idx}`}
                    type="button"
                    onClick={() => setLegIndex(l.idx)}
                    className={tabBtnClass(active)}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ✅ Confirmed/Selecting row (same visual language as Baggage) */}
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center flex-wrap gap-2 text-[12px] font-semibold text-slate-700">
            <span className="text-slate-500">{t?.confirmed ?? "Confirmed"}:</span>
            <span className="font-extrabold">{normalize(savedMeal?.ssrCode) || "-"}</span>
            <span className="text-slate-300">|</span>
            <span className="font-extrabold">{normalize(savedBev?.ssrCode) || "-"}</span>

            <span className="text-slate-300">&nbsp;|&nbsp;</span>

            <span className="text-slate-500">{t?.selecting ?? "Selecting"}:</span>
            <span className="font-extrabold">{normalize(uiMeal?.ssrCode) || "-"}</span>
            <span className="text-slate-300">|</span>
            <span className="font-extrabold">{normalize(uiBev?.ssrCode) || "-"}</span>
          </div>
        </div>

        {/* Flight/date pill row */}
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-extrabold text-slate-900">
              {(route.origin || "—")} – {(route.destination || "—")}
              <span className="text-slate-400 font-black mx-2">:</span>
              <span className="text-slate-900">{flightNo || "—"}</span>
            </div>

            <span className="text-slate-300">|</span>

            <span
              className={[
                "inline-flex items-center text-xs font-extrabold px-2.5 py-1 rounded-full border",
                weekdayPillClass(departDate),
              ].join(" ")}
            >
              {dayText || "—"}
            </span>

            <div className="text-sm text-slate-700 font-semibold">{dateText || ""}</div>
          </div>
        </div>

        {/* Group 1: MEAL (MH/MS) */}
        <div className="mt-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-600">{t?.mealGroup ?? "Meal (MH/MS)"}</div>

          {/* None meal */}
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-2 cursor-pointer hover:border-sky-300">
            <input
              type="radio"
              name={`${String(paxId)}-${journeyKey}-MEAL`}
              className="mt-1 h-4 w-4 accent-sky-600"
              checked={!uiMeal}
              onChange={() => dispatch(setDraftMealRadio({ paxId, journeyKey, service: null }))}
            />
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900 text-[13px]">{t?.noMeal ?? "No meal"}</div>
            </div>
          </label>

          {servicesForFlight.meals.length ? (
            <div className="space-y-2">
              {servicesForFlight.meals.map((svc) => (
                <RadioRow
                  key={serviceKey(svc) || `${svc?.ssrCode}-${svc?.amount}-${svc?.currency}`}
                  svc={svc}
                  group="MEAL"
                  checked={normalize(uiMeal?.ssrCode) === normalize(svc?.ssrCode)}
                  onPick={() => dispatch(setDraftMealRadio({ paxId, journeyKey, service: svc }))}
                />
              ))}
            </div>
          ) : (
            emptyHint(t?.noMealsForFlight ?? "No MH/MS meals for this flight.")
          )}
        </div>

        {/* Group 2: BEV */}
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-bold text-slate-600">{t?.bevGroup ?? "Beverage (BEV)"}</div>

          {/* None bev */}
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-2 cursor-pointer hover:border-sky-300">
            <input
              type="radio"
              name={`${String(paxId)}-${journeyKey}-BEV`}
              className="mt-1 h-4 w-4 accent-sky-600"
              checked={!uiBev}
              onChange={() => dispatch(setDraftBeverageRadio({ paxId, journeyKey, service: null }))}
            />
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900 text-[13px]">{t?.noBev ?? "No beverage"}</div>
            </div>
          </label>

          {servicesForFlight.bevs.length ? (
            <div className="space-y-2">
              {servicesForFlight.bevs.map((svc) => (
                <RadioRow
                  key={serviceKey(svc) || `${svc?.ssrCode}-${svc?.amount}-${svc?.currency}`}
                  svc={svc}
                  group="BEV"
                  checked={normalize(uiBev?.ssrCode) === normalize(svc?.ssrCode)}
                  onPick={() => dispatch(setDraftBeverageRadio({ paxId, journeyKey, service: svc }))}
                />
              ))}
            </div>
          ) : (
            emptyHint(t?.noBevForFlight ?? "No BEV options for this flight.")
          )}
        </div>

        {/* Bottom buttons: Confirm / Release */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!journeyKey) return;
              dispatch(saveMealSelection({ paxId, journeyKey }));
            }}
            className={[
              "px-4 py-2 rounded-lg font-bold",
              canConfirm
                ? "bg-sky-600 text-white hover:bg-sky-700"
                : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            {t?.confirm ?? "Confirm"}
          </button>

          <button
            type="button"
            disabled={!canRelease}
            onClick={() => {
              if (!journeyKey) return;
              dispatch(clearDraftMealSelection({ paxId, journeyKey }));
            }}
            className={[
              "px-4 py-2 rounded-lg font-bold border",
              canRelease
                ? "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {t?.release ?? "Release"}
          </button>
        </div>
      </div>
    </div>
  );
}
