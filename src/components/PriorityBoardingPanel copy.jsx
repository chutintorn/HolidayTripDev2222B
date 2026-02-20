// src/components/PriorityBoardingPanel.jsx
import React, { useMemo, useState } from "react";
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
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function money(amount, currency) {
  const n = toNum(amount);
  const c = currency || "THB";
  return `${n.toFixed(2)} ${c}`;
}
function sumVat(vatArr) {
  return safeArray(vatArr).reduce((s, x) => s + toNum(x?.amount), 0);
}

/**
 * Try to find PBOD service from pricing details for a given flightNumber.
 * We expect pricing details already have availableExtraServices / extraServices list.
 * Works with common shapes:
 * - rawDetail.airlines[].availableExtraServices[]
 * - rawDetail.availableExtraServices[]
 * - rawDetail.extraServices[]
 */
function findPBODFromPricing(rawDetail, flightNumber) {
  const fn = String(flightNumber || "").trim().toUpperCase();

  const pools = [];

  // common pools
  pools.push(safeArray(rawDetail?.availableExtraServices));
  pools.push(safeArray(rawDetail?.extraServices));

  // airlines[] pools
  const airlines = safeArray(rawDetail?.airlines);
  airlines.forEach((a) => {
    pools.push(safeArray(a?.availableExtraServices));
    pools.push(safeArray(a?.extraServices));
  });

  const flat = pools.flat().filter(Boolean);

  // match PBOD + flightNumber
  const hit =
    flat.find(
      (x) =>
        String(x?.ssrCode || "").toUpperCase() === "PBOD" &&
        String(x?.flightNumber || "").trim().toUpperCase() === fn
    ) ||
    // fallback: match PBOD only (if flightNumber not included)
    flat.find((x) => String(x?.ssrCode || "").toUpperCase() === "PBOD");

  if (!hit) return null;

  // normalize (keep fields for display)
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
 * - paxId: string | number (unique per passenger in your app)
 * - legs: [{ key:'depart'|'return', label, journeyKey, flightNumber }]
 * - rawDetail: pricing details object (same one you use for meal/baggage)
 *
 * IMPORTANT:
 * - Save per paxId + journeyKey (like baggage/meal)
 * - UI shows description + price but payload later will send only ssrCode PBOD
 */
export default function PriorityBoardingPanel({ paxId, legs = [], rawDetail }) {
  const dispatch = useDispatch();
  const [activeIdx, setActiveIdx] = useState(0);

  const activeLeg = legs?.[activeIdx] || null;
  const activeJourneyKey = activeLeg?.journeyKey || "";
  const activeFlightNumber = activeLeg?.flightNumber || "";

  // get PBOD service for active leg
  const pbodService = useMemo(() => {
    if (!activeLeg) return null;
    return findPBODFromPricing(rawDetail, activeFlightNumber);
  }, [rawDetail, activeFlightNumber, activeLeg]);

  const draft = useSelector(selectDraftPriorityBoarding(paxId, activeJourneyKey));
  const saved = useSelector(selectSavedPriorityBoarding(paxId, activeJourneyKey));

  // effective: draft overrides saved (same concept you use in other panels)
  const effective = draft?.pbod !== undefined ? draft : saved;
  const selected = effective?.pbod || null;

  const hasPBOD = !!pbodService;

  const vatTotal = useMemo(() => sumVat(pbodService?.vat), [pbodService]);
  const total = useMemo(() => toNum(pbodService?.amount), [pbodService]);

  function onSelectNone() {
    dispatch(setDraftPriorityBoarding({ paxId, journeyKey: activeJourneyKey, service: null }));
  }

  function onSelectPBOD() {
    dispatch(setDraftPriorityBoarding({ paxId, journeyKey: activeJourneyKey, service: pbodService }));
  }

  function onConfirm() {
    dispatch(savePriorityBoarding({ paxId, journeyKey: activeJourneyKey }));
  }

  function onCancel() {
    dispatch(clearDraftPriorityBoarding({ paxId, journeyKey: activeJourneyKey }));
  }

  return (
    <div className="mt-3">
      {/* Leg tabs: Depart/Return */}
      <div className="flex gap-2">
        {safeArray(legs).map((leg, idx) => {
          const active = idx === activeIdx;
          return (
            <button
              key={leg?.key || idx}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={[
                "px-3 py-2 rounded-xl border text-[13px] font-semibold",
                active ? "bg-white border-slate-900" : "bg-slate-50 border-slate-200",
              ].join(" ")}
            >
              {leg?.label || (leg?.key === "return" ? "Return" : "Depart")}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-[14px] font-bold text-slate-900">Priority Boarding</div>
        <div className="mt-1 text-[12px] text-slate-600">
          Select priority boarding for this passenger (per flight leg).
        </div>

        {!hasPBOD ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-700">
            No Priority Boarding (PBOD) service available for this flight.
          </div>
        ) : (
          <>
            {/* Options */}
            <div className="mt-3 space-y-2">
              {/* None */}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
                <input
                  type="radio"
                  name={`pbod-${paxId}-${activeJourneyKey}`}
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
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
                <input
                  type="radio"
                  name={`pbod-${paxId}-${activeJourneyKey}`}
                  checked={!!selected && String(selected?.ssrCode).toUpperCase() === "PBOD"}
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

            {/* Actions */}
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
              * On submit, system will send only SSR code <b>PBOD</b> (no amount) for selected legs.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
