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

/* Find PBOD service for a flight (same concept as MealPanel) */
function findPBODFromPricing(rawDetail, flightNumber) {
  const airlines = pickAirlinesFromRawDetail(rawDetail);
  const fn = sanitizeFlightNumber(flightNumber);

  // collect all services from airlines[].availableExtraServices
  const all = [];
  for (const a of airlines) {
    const services = Array.isArray(a?.availableExtraServices) ? a.availableExtraServices : [];
    for (const s of services) all.push(s);
  }

  // if we have flightNumber, match by flightNumber first
  const byFlight = fn
    ? all.filter((s) => sanitizeFlightNumber(s?.flightNumber) === fn)
    : all;

  const hit =
    byFlight.find((s) => normalize(s?.ssrCode) === "PBOD") ||
    all.find((s) => normalize(s?.ssrCode) === "PBOD"); // fallback

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

/* ========================= Component ========================= */
/**
 * Props:
 * - paxId
 * - legs: [{ label, journeyKey, flightNumber }]
 * - rawDetail: pricing detail object
 */
export default function PriorityBoardingPanel({ paxId, legs = [], rawDetail }) {
  const dispatch = useDispatch();
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!legs?.length) return;
    if (activeIdx > legs.length - 1) setActiveIdx(0);
  }, [legs?.length, activeIdx]);

  if (!legs?.length) {
    return (
      <div className="text-sm text-slate-600">
        No selectedOffers found.
      </div>
    );
  }

  const activeLeg = legs[activeIdx] || null;
  const journeyKey = String(activeLeg?.journeyKey || "");
  const flightNumber = String(activeLeg?.flightNumber || "");
  const label = activeLeg?.label || (activeIdx === 0 ? "Depart" : "Return");

  const pbodService = useMemo(() => {
    return findPBODFromPricing(rawDetail, flightNumber);
  }, [rawDetail, flightNumber]);

  // Redux (draft/saved per paxId + journeyKey)
  const draft = useSelector(selectDraftPriorityBoarding(paxId, journeyKey));
  const saved = useSelector(selectSavedPriorityBoarding(paxId, journeyKey));

  const ui = draft != null ? draft : saved != null ? saved : { pbod: null };
  const selected = ui?.pbod ?? null;

  const vatTotal = useMemo(() => sumVat(pbodService?.vat), [pbodService]);
  const total = Number(pbodService?.amount || 0) || 0;

  function onSelectNone() {
    dispatch(setDraftPriorityBoarding({ paxId, journeyKey, service: null }));
  }

  function onSelectPBOD() {
    if (!pbodService) return;
    dispatch(setDraftPriorityBoarding({ paxId, journeyKey, service: pbodService }));
  }

  function onConfirm() {
    dispatch(savePriorityBoarding({ paxId, journeyKey }));
  }

  function onCancel() {
    dispatch(clearDraftPriorityBoarding({ paxId, journeyKey }));
  }

  return (
    <div className="mt-3">
      {/* Leg tabs */}
      <div className="flex gap-2">
        {safeArray(legs).map((leg, idx) => {
          const active = idx === activeIdx;
          return (
            <button
              key={leg?.journeyKey || idx}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={[
                "px-4 py-2 rounded-2xl border text-[13px] font-semibold",
                active ? "bg-white border-slate-900" : "bg-slate-50 border-slate-200",
              ].join(" ")}
            >
              {leg?.label || (idx === 0 ? "Depart" : "Return")}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-[14px] font-bold text-slate-900">Priority Boarding</div>
        <div className="mt-1 text-[12px] text-slate-600">
          Select priority boarding for this passenger (per flight leg).
        </div>

        {/* optional debug line (safe) */}
        <div className="mt-1 text-[11px] text-slate-400">
          {label} · {sanitizeFlightNumber(flightNumber) || "—"}
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

                <div className="text-[13px] font-bold text-slate-800">
                  {money(total, pbodService?.currency)}
                </div>
              </label>
            </div>

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
                className="px-4 py-2 rounded-xl border border-blue-600 bg-blue-600 text-white text-[13px] font-semibold"
              >
                Confirm
              </button>
            </div>

            <div className="mt-2 text-[12px] text-slate-500">
              * On submit, system will send only SSR code <b>PBOD</b> for selected legs.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
