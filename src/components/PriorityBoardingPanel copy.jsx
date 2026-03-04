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

/* ========================= helpers ========================= */
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function normalize(v) {
  return String(v || "").trim().replace(/\s+/g, "").toUpperCase();
}
function sanitizeFlightNumber(v) {
  const s = String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
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

/* rawDetail can be many shapes (same as MealPanel) */
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

/* ========================= header helpers (like Meal) ========================= */
function parseJourneyKey(journeyKey) {
  const s = String(journeyKey || "").trim();
  const mRoute = /^([A-Z]{3})([A-Z]{3})/.exec(s);
  const origin = mRoute ? mRoute[1] : "";
  const destination = mRoute ? mRoute[2] : "";

  const mDate = /([0-9]{8})/.exec(s);
  const ymd = mDate ? mDate[1] : "";

  return { origin, destination, ymd };
}

function formatDate(ymd) {
  if (!ymd || ymd.length !== 8) return "";
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
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

/* ========================= NEW helper: compare saved vs draft ========================= */
function codeFromUI(ui) {
  const ssr = normalize(ui?.pbod?.ssrCode);
  return ssr === "PBOD" ? "PBOD" : "NONE";
}

/* ========================= Component ========================= */
export default function PriorityBoardingPanel({ paxId, legs = [], rawDetail, selectedOffers = [] }) {
  const dispatch = useDispatch();
  const [activeIdx, setActiveIdx] = useState(0); // ✅ default Depart

  useEffect(() => {
    if (!legs?.length) return;
    if (activeIdx > legs.length - 1) setActiveIdx(0);
  }, [legs?.length, activeIdx]);

  if (!legs?.length) {
    return <div className="text-sm text-slate-600">No selectedOffers found.</div>;
  }

  const activeLeg = legs[activeIdx] || null;
  const journeyKey = String(activeLeg?.journeyKey || "");
  const flightNumber = String(activeLeg?.flightNumber || "");
  const label = activeLeg?.label || (activeIdx === 0 ? "Depart" : "Return");

  const offer = useMemo(() => findOfferByJourneyKey(selectedOffers, journeyKey), [selectedOffers, journeyKey]);
  const parsed = useMemo(() => parseJourneyKey(journeyKey), [journeyKey]);

  const origin = offer?.origin || offer?.from || parsed.origin;
  const destination = offer?.destination || offer?.to || parsed.destination;

  const ymd = (String(offer?.departureDate || offer?.departure || "").replaceAll("-", "")) || parsed.ymd;

  const dateText = formatDate(ymd);
  const dow = weekdayShort(ymd);

  const pbodService = useMemo(() => {
    return findPBODFromPricing(rawDetail, flightNumber);
  }, [rawDetail, flightNumber]);

  const draft = useSelector(selectDraftPriorityBoarding(paxId, journeyKey));
  const saved = useSelector(selectSavedPriorityBoarding(paxId, journeyKey));

  // ui for radio selection display
  const ui = draft != null ? draft : saved != null ? saved : { pbod: null };
  const selected = ui?.pbod ?? null;

  const vatTotal = useMemo(() => sumVat(pbodService?.vat), [pbodService]);
  const total = Number(pbodService?.amount || 0) || 0;

  // ✅ KEY FIX: Confirm should be active only if DRAFT exists and differs from SAVED
  const savedCode = useMemo(() => codeFromUI(saved || { pbod: null }), [saved]);
  const draftCode = useMemo(() => (draft == null ? null : codeFromUI(draft)), [draft]);

  const canConfirm = useMemo(() => {
    if (draft == null) return false; // user hasn't changed anything
    return draftCode !== savedCode; // changed from saved
  }, [draft, draftCode, savedCode]);

  function onSelectNone() {
    // ถ้า saved ก็ NONE อยู่แล้ว -> ไม่ต้องสร้าง draft (กัน Confirm กลายเป็นฟ้า)
    if (savedCode === "NONE") {
      dispatch(clearDraftPriorityBoarding({ paxId, journeyKey }));
      return;
    }
    // saved เป็น PBOD แต่ user เลือก NONE -> สร้าง draft เพื่อให้ Confirm ได้
    dispatch(setDraftPriorityBoarding({ paxId, journeyKey, service: null }));
  }

  function onSelectPBOD() {
    if (!pbodService) return;
    // ถ้า saved เป็น PBOD อยู่แล้ว -> ไม่ต้องสร้าง draft
    if (savedCode === "PBOD") {
      dispatch(clearDraftPriorityBoarding({ paxId, journeyKey }));
      return;
    }
    // saved เป็น NONE แต่ user เลือก PBOD -> สร้าง draft
    dispatch(setDraftPriorityBoarding({ paxId, journeyKey, service: pbodService }));
  }

  function onConfirm() {
    if (!canConfirm) return; // ✅ safety
    dispatch(savePriorityBoarding({ paxId, journeyKey }));
  }

  function onCancel() {
    dispatch(clearDraftPriorityBoarding({ paxId, journeyKey }));
  }

  const routeLine =
    origin && destination
      ? `${origin} – ${destination} : ${sanitizeFlightNumber(flightNumber) || ""}`
      : `${sanitizeFlightNumber(flightNumber) || ""}`;

  return (
    <div className="mt-3">
      {/* ✅ Leg tabs (active = blue like Meal) */}
      <div className="flex gap-3">
        {safeArray(legs).map((leg, idx) => {
          const active = idx === activeIdx;
          return (
            <button
              key={leg?.journeyKey || idx}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={[
                "px-6 py-2 rounded-full border text-[13px] font-semibold transition-colors",
                active ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {leg?.label || (idx === 0 ? "Depart" : "Return")}
            </button>
          );
        })}
      </div>

      {/* ✅ remove top title/description; keep only flight header + options */}
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        {/* Flight header like Meal */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[14px] font-extrabold text-slate-900">{routeLine}</div>
            {dow ? (
              <span className="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-700">
                {dow}
              </span>
            ) : null}
            {dateText ? <div className="text-[13px] font-semibold text-slate-700">{dateText}</div> : null}
          </div>
        </div>

        {!pbodService ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-700">
            No Priority Boarding (PBOD) service available for this flight.
          </div>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {/* None */}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer bg-white">
                <input
                  type="radio"
                  name={`pbod-${paxId}-${journeyKey}`}
                  checked={!selected}
                  onChange={onSelectNone}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-slate-900">No Priority Boarding</div>
                  <div className="text-[12px] text-slate-600">Do not add PBOD for this leg.</div>
                </div>
                <div className="text-[13px] font-bold text-slate-800">{money(0, pbodService?.currency)}</div>
              </label>

              {/* PBOD */}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer bg-white">
                <input
                  type="radio"
                  name={`pbod-${paxId}-${journeyKey}`}
                  checked={normalize(selected?.ssrCode) === "PBOD"}
                  onChange={onSelectPBOD}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-slate-900">
                    {pbodService?.description || "PRIORITY BOARDING"}{" "}
                    <span className="ml-2 text-[12px] font-bold text-slate-500">(PBOD)</span>
                  </div>

                  <div className="mt-1 text-[12px] text-slate-600">
                    Price: <span className="font-semibold">{money(pbodService?.amount, pbodService?.currency)}</span>
                    {vatTotal > 0 ? (
                      <>
                        {" "}
                        · VAT: <span className="font-semibold">{money(vatTotal, pbodService?.currency)}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="text-[13px] font-bold text-slate-800">{money(total, pbodService?.currency)}</div>
              </label>
            </div>

            {/* ✅ Confirm button behavior fix: gray if no change */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-[13px] font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                className={[
                  "px-4 py-2 rounded-xl border text-[13px] font-semibold",
                  canConfirm
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-slate-200 text-slate-500 cursor-not-allowed",
                ].join(" ")}
              >
                Confirm
              </button>
            </div>

            {/* (optional) tiny hint - you can remove later */}
            {/* <div className="mt-2 text-[11px] text-slate-500">
              saved={savedCode} draft={draftCode ?? "-"} canConfirm={String(canConfirm)}
            </div> */}
          </>
        )}
      </div>
    </div>
  );
}
