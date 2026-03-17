// src/components/PriorityBoardingPanel.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setDraftPriorityBoarding,
  savePriorityBoarding,
  clearDraftPriorityBoarding,
  selectDraftPriorityBoarding,
  selectSavedPriorityBoarding,
} from "../redux/priorityBoardingSelectionSlice";

/* ========================= PNG icon (Vite-safe) ========================= */
const priorityImg = new URL("../assets/anc_priority.png", import.meta.url).href;
const ICON_CLASS_200 = "w-14 h-14 object-contain";

/* ========================= helpers ========================= */
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function normalize(v) {
  return String(v || "").trim().replace(/\s+/g, "").toUpperCase();
}
function sanitizeFlightNumber(v) {
  const s = String(v || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z]{2})(\d{2,4})/.exec(s);
  if (!m) return "";
  return `${m[1]}${m[2]}`;
}
function money(amount, currency) {
  const n = Number(amount);
  const c = currency || "THB";
  if (!Number.isFinite(n)) return `0.00 ${c}`;
  return `${n.toFixed(2)} ${c}`;
}
function sumVat(vatArr) {
  return safeArray(vatArr).reduce((s, x) => s + (Number(x?.amount) || 0), 0);
}

/* rawDetail can be many shapes (same pattern as MealPanel) */
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

/** JourneyKey -> {origin,destination, yyyymmdd} */
function parseJourneyKey(journeyKey) {
  const s = String(journeyKey || "").trim().toUpperCase();
  const mRoute = /^([A-Z]{3})([A-Z]{3})/.exec(s);
  const origin = mRoute ? mRoute[1] : "";
  const destination = mRoute ? mRoute[2] : "";

  const mDate = /(20\d{6})/.exec(s);
  const ymd = mDate ? mDate[1] : "";
  return { origin, destination, ymd };
}

/** JourneyKey -> flightNumber (fallback) */
function extractFlightNoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "").toUpperCase();
  const m =
    /_([A-Z]{2}\d{2,4})(?=20\d{6})/.exec(s) ||
    /_([A-Z]{2}\d{2,4})/.exec(s);
  return sanitizeFlightNumber(m ? m[1] : "");
}

function formatDate(ymd) {
  if (!ymd || ymd.length !== 8) return "";
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

function weekdayShort(ymd) {
  if (!ymd || ymd.length !== 8) return "";
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  const w = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return w[dt.getUTCDay()];
}

function findOfferByJourneyKey(selectedOffers, journeyKey) {
  const so = safeArray(selectedOffers);
  const jk = String(journeyKey || "");
  return so.find((o) => String(o?.journeyKey || "") === jk) || null;
}

function findPBODFromPricing(rawDetail, flightNumber) {
  const airlines = pickAirlinesFromRawDetail(rawDetail);
  const fn = sanitizeFlightNumber(flightNumber);

  const all = [];
  for (const a of airlines) {
    const services = Array.isArray(a?.availableExtraServices) ? a.availableExtraServices : [];
    for (const s of services) all.push(s);
  }

  const byFlight = fn ? all.filter((s) => sanitizeFlightNumber(s?.flightNumber) === fn) : all;
  const hit =
    byFlight.find((s) => normalize(s?.ssrCode) === "PBOD") ||
    all.find((s) => normalize(s?.ssrCode) === "PBOD");

  if (!hit) return null;

  return {
    ssrCode: "PBOD",
    description: hit?.description || "PRIORITY BOARDING",
    amount: hit?.amount ?? 0,
    currency: hit?.currency || "THB",
    departureDate: hit?.departureDate,
    flightNumber: hit?.flightNumber || flightNumber,
    paxTypeCode: hit?.paxTypeCode,
    vat: safeArray(hit?.vat),
  };
}

function samePick(a, b) {
  return normalize(a?.ssrCode) === normalize(b?.ssrCode);
}

function pickLabel(service, t) {
  const code = normalize(service?.ssrCode);
  if (code === "PBOD") return t?.priorityYes ?? "Priority Boarding";
  return t?.priorityNo ?? "No priority";
}

/* ========================= Component ========================= */
export default function PriorityBoardingPanel({
  paxId,
  legs = [],
  rawDetail,
  selectedOffers = [],
  t,
  onClose,
}) {
  const dispatch = useDispatch();
  const [activeIdx, setActiveIdx] = useState(0);

  const canClose = typeof onClose === "function";

  useEffect(() => {
    setActiveIdx(0);
  }, [paxId]);

  useEffect(() => {
    if (!legs?.length) return;
    if (activeIdx > legs.length - 1) setActiveIdx(0);
  }, [legs?.length, activeIdx]);

  if (!legs?.length) {
    return <div className="text-sm text-slate-600">{t?.noFlights ?? "No selectedOffers found."}</div>;
  }

  const activeLeg = legs[activeIdx] || null;
  const journeyKey = String(activeLeg?.journeyKey || "");

  const flightNumber =
    String(activeLeg?.flightNumber || "") || extractFlightNoFromJourneyKey(journeyKey);

  const offer = useMemo(
    () => findOfferByJourneyKey(selectedOffers, journeyKey),
    [selectedOffers, journeyKey]
  );
  const parsed = useMemo(() => parseJourneyKey(journeyKey), [journeyKey]);

  const origin = offer?.origin || offer?.from || parsed.origin;
  const destination = offer?.destination || offer?.to || parsed.destination;

  const ymd =
    (String(offer?.departureDate || offer?.departure || "").replaceAll("-", "")) ||
    parsed.ymd;

  const dateText = formatDate(ymd);
  const dow = weekdayShort(ymd);

  const pbodService = useMemo(
    () => findPBODFromPricing(rawDetail, flightNumber),
    [rawDetail, flightNumber]
  );

  const draft = useSelector(selectDraftPriorityBoarding(paxId, journeyKey));
  const saved = useSelector(selectSavedPriorityBoarding(paxId, journeyKey));

  const ui = draft != null ? draft : saved != null ? saved : { pbod: null };
  const uiPBOD = ui?.pbod ?? null;

  const savedPBOD = saved?.pbod ?? null;

  const changed = !(samePick(uiPBOD, savedPBOD));
  const canConfirm = !!journeyKey && changed;
  const canCancel = !!journeyKey && draft != null;

  const vatTotal = useMemo(() => sumVat(pbodService?.vat), [pbodService]);
  const total = Number(pbodService?.amount || 0) || 0;

  const routeLine =
    origin && destination
      ? `${origin} – ${destination} : ${sanitizeFlightNumber(flightNumber) || ""}`
      : `${sanitizeFlightNumber(flightNumber) || ""}`;

  return (
    <div className="space-y-3">
      {/* Header with Close button */}
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <img src={priorityImg} alt="Priority" className={ICON_CLASS_200} />
            <div className="font-extrabold text-slate-900">
              {t?.priorityLabel ?? "Priority Boarding"}
            </div>
          </div>

          {canClose ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-bold border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            >
              {t?.close ?? (t?.isTH ? "ปิด" : "Close")}
            </button>
          ) : null}
        </div>
      </div>

      {/* Leg tabs */}
      <div className="flex gap-2 flex-wrap">
        {safeArray(legs).map((leg, idx) => {
          const active = idx === activeIdx;
          return (
            <button
              key={leg?.journeyKey || idx}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={[
                "px-4 py-2 rounded-full border text-[13px] font-extrabold",
                active
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-sky-400",
              ].join(" ")}
            >
              {leg?.label || (idx === 0 ? (t?.depart ?? "Depart") : (t?.return ?? "Return"))}
            </button>
          );
        })}
      </div>

      {/* Flight/date row */}
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-extrabold text-slate-900">{routeLine}</div>
          {dow ? (
            <>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center text-xs font-extrabold px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                {dow}
              </span>
            </>
          ) : null}
          {dateText ? (
            <div className="text-sm text-slate-700 font-semibold">{dateText}</div>
          ) : null}
        </div>
      </div>

      {/* Summary + buttons */}
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12px] text-slate-700 font-semibold">
            <span className="text-slate-500">{t?.confirmed ?? "Confirmed"}:</span>{" "}
            <span className="font-extrabold">{pickLabel(savedPBOD, t)}</span>
            <span className="text-slate-300"> &nbsp;|&nbsp; </span>
            <span className="text-slate-500">{t?.selecting ?? "Selecting"}:</span>{" "}
            <span className="font-extrabold">{pickLabel(uiPBOD, t)}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                if (!journeyKey) return;
                dispatch(savePriorityBoarding({ paxId, journeyKey }));
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
              disabled={!canCancel}
              onClick={() => {
                if (!journeyKey) return;
                dispatch(clearDraftPriorityBoarding({ paxId, journeyKey }));
              }}
              className={[
                "px-4 py-2 rounded-lg font-bold border",
                canCancel
                  ? "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
              ].join(" ")}
            >
              {t?.cancel ?? "Cancel"}
            </button>
          </div>
        </div>
      </div>

      {/* Options */}
      {!pbodService ? (
        <div className="text-[12px] text-slate-600 bg-white border border-slate-200 rounded-lg p-3">
          {t?.noPriorityForFlight ?? "No Priority Boarding (PBOD) service available for this flight."}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          {/* None */}
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-sky-300">
            <input
              type="radio"
              name={`pbod-${paxId}-${journeyKey}`}
              className="mt-1 h-4 w-4 accent-sky-600"
              checked={!uiPBOD}
              onChange={() =>
                dispatch(setDraftPriorityBoarding({ paxId, journeyKey, service: null }))
              }
            />
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900 text-[13px]">
                {t?.priorityNo ?? "No priority"}
              </div>
              <div className="text-[12px] text-slate-600">
                {t?.priorityNoHint ?? "Do not add Priority Boarding for this leg."}
              </div>
            </div>
            <div className="text-[12px] font-bold text-slate-700">
              {money(0, pbodService?.currency)}
            </div>
          </label>

          {/* PBOD */}
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-sky-300">
            <input
              type="radio"
              name={`pbod-${paxId}-${journeyKey}`}
              className="mt-1 h-4 w-4 accent-sky-600"
              checked={normalize(uiPBOD?.ssrCode) === "PBOD"}
              onChange={() =>
                dispatch(setDraftPriorityBoarding({ paxId, journeyKey, service: pbodService }))
              }
            />
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900 text-[13px]">
                {pbodService?.description || (t?.priorityYes ?? "Priority Boarding")}
              </div>
              <div className="mt-1 text-[12px] text-slate-600">
                {t?.price ?? "Price"}:{" "}
                <span className="font-semibold">
                  {money(pbodService?.amount, pbodService?.currency)}
                </span>
                {vatTotal > 0 ? (
                  <>
                    {" "}
                    · {t?.vat ?? "VAT"}:{" "}
                    <span className="font-semibold">
                      {money(vatTotal, pbodService?.currency)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="text-[12px] font-bold text-slate-700">
              {money(total, pbodService?.currency)}
            </div>
          </label>
        </div>
      )}
    </div>
  );
}