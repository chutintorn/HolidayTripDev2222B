// src/components/SeatMapPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setDraftSeat,
  saveSeat,
  clearDraftSeat,
  clearSavedSeat,
  selectDraftSeat,
  selectSavedSeat,
  selectAllSavedSeats,
  selectAllDraftSeats,
} from "../redux/seatSelectionSlice";

import {
  fetchSeatMap,
  selectSeatMapFor,
  selectSeatMapStatus,
} from "../redux/seatMapSlice";

/** normalize items list from seatMapData (supports {data:[...]} or [...] ) */
function getSeatMapItems(seatMapData) {
  if (!seatMapData) return [];
  if (Array.isArray(seatMapData)) return seatMapData;
  if (Array.isArray(seatMapData?.data)) return seatMapData.data;
  if (Array.isArray(seatMapData?.detail?.data)) return seatMapData.detail.data;
  return [];
}

/** extract seatCharges by fareKey/journeyKey (robust for your proxy response) */
function normalize(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function extractSeatChargesForJourney(seatMapData, journeyKey, fareKey) {
  if (!seatMapData) return [];

  // direct shapes
  if (Array.isArray(seatMapData?.seatCharges)) return seatMapData.seatCharges;
  if (Array.isArray(seatMapData?.data?.seatCharges)) return seatMapData.data.seatCharges;

  const items = getSeatMapItems(seatMapData);
  if (!items.length) return [];

  // unwrap response
  const matchedItem =
    items.find(it => normalize(it?.request?.fareKey) === normalize(fareKey)) ||
    items.find(it => normalize(it?.request?.fareKey).includes(normalize(fareKey))) ||
    items[0]; // fallback

  const responseData =
    matchedItem?.response?.data ||
    matchedItem?.data ||
    [];

  if (!Array.isArray(responseData) || !responseData.length) return [];

  // ✅ NEW LOGIC: pick segment by flightNumber inside journeyKey
  const flightTokens = String(journeyKey).match(/[A-Z]{2}\d{2,4}/g) || [];

  let segment =
    flightTokens.length
      ? responseData.find(seg =>
          flightTokens.includes(String(seg?.flightNumber || "").trim())
        )
      : null;

  // fallback
  if (!segment) segment = responseData[0];

  const seatCharges =
    segment?.seatCharges ||
    segment?.seatCharge ||
    segment?.seats ||
    [];

  return Array.isArray(seatCharges) ? seatCharges : [];
}


/** Group seatCharges -> rows */
function groupByRow(seatCharges = []) {
  const map = new Map();

  for (const c of seatCharges) {
    const row = Number(c?.rowNumber || c?.row || 0);
    const letter = String(c?.seat || c?.seatLetter || c?.column || "").trim();
    if (!row || !letter) continue;

    const seatCode = `${row}${letter}`;
    const amount = Number(c?.amount || 0) || 0;
    const currency = c?.currency || "THB";
    const available = c?.available !== false;

    const vatArr = Array.isArray(c?.vat) ? c.vat : [];
    const vat = vatArr.reduce((sum, v) => sum + (Number(v?.amount || 0) || 0), 0);

    const seatObj = {
      seatCode,
      rowNumber: row,
      seatLetter: letter,
      serviceCode: c?.serviceCode || "",
      description: c?.description || "",
      amount,
      currency,
      vat,
      available,
    };

    if (!map.has(row)) map.set(row, []);
    map.get(row).push(seatObj);
  }

  for (const [row, arr] of map.entries()) {
    arr.sort((a, b) => String(a.seatLetter).localeCompare(String(b.seatLetter)));
    map.set(row, arr);
  }

  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

export default function SeatMapPanel({
  paxId,
  selectedOffers = [],
  t,
  flightInfoByJourneyKey,
}) {
  const dispatch = useDispatch();
  const [legIndex, setLegIndex] = useState(0);

  // ✅ build legs with fareKey + journeyKey
  const legs = useMemo(() => {
    return (selectedOffers || [])
      .map((o, idx) => ({
        idx,
        fareKey: o?.fareKey || o?.id || o?.token || "",
        journeyKey: o?.journeyKey || "",
        securityToken: o?.securityToken || "",
        label: idx === 0 ? (t?.depart ?? "Depart") : (t?.return ?? "Return"),
      }))
      .filter((x) => x.journeyKey && x.fareKey);
  }, [selectedOffers, t]);

  const activeLeg = legs[legIndex] || null;
  const journeyKey = activeLeg?.journeyKey || "";
  const fareKey = activeLeg?.fareKey || "";

  // ✅ requestKey = fareKey (per-leg) — IMPORTANT for round-trip
  const requestKey = fareKey || "unknown";

  const seatMapStatus = useSelector(selectSeatMapStatus(requestKey));
  const seatMapData = useSelector(selectSeatMapFor(requestKey));
  const seatMapError = useSelector((s) => s?.seatMap?.error?.[requestKey] || null);

  const draft = useSelector(selectDraftSeat(paxId, journeyKey));
  const saved = useSelector(selectSavedSeat(paxId, journeyKey));

  // ✅ Read all seats for realtime locking
  const allSaved = useSelector(selectAllSavedSeats);
  const allDraft = useSelector(selectAllDraftSeats);

  // ✅ Seats chosen by OTHER passengers in the same booking session (same journeyKey)
  const occupiedByOther = useMemo(() => {
    const set = new Set();
    const me = String(paxId);
    const jKey = String(journeyKey || "");
    if (!jKey) return set;

    const addFrom = (root) => {
      for (const [p, journeys] of Object.entries(root || {})) {
        if (String(p) === me) continue;
        const seatObj = journeys?.[jKey] || null;
        if (seatObj?.seatCode) set.add(String(seatObj.seatCode));
      }
    };

    addFrom(allSaved);
    addFrom(allDraft);
    return set;
  }, [allSaved, allDraft, paxId, journeyKey]);

  const hasDraft = Boolean(draft?.seatCode);
  const hasSaved = Boolean(saved?.seatCode);

  const canSave = hasDraft && draft?.seatCode !== saved?.seatCode;

  // ✅ Cancel button: cancel draft OR release saved
  const canCancel = hasDraft || hasSaved;

  // ✅ auto-load per leg (single offer)
  useEffect(() => {
    if (!activeLeg) return;
    if (seatMapStatus !== "idle") return;

    dispatch(
      fetchSeatMap({
        offer: {
          fareKey: activeLeg.fareKey,
          journeyKey: activeLeg.journeyKey,
          securityToken: activeLeg.securityToken,
        },
      })
    );
  }, [dispatch, activeLeg, seatMapStatus]);

  const seatCharges = useMemo(
    () => extractSeatChargesForJourney(seatMapData, journeyKey, fareKey),
    [seatMapData, journeyKey, fareKey]
  );

  const rows = useMemo(() => groupByRow(seatCharges), [seatCharges]);

  // ✅ fixed layout columns (stable alignment)
  const SEAT_COLUMNS = ["A", "B", "C", "_AISLE_", "H", "J", "K"];

  const pickSeat = (seatObj) => {
    if (!seatObj?.seatCode) return;
    if (seatObj.available === false) return;

    const code = String(seatObj.seatCode);
    // ✅ realtime lock guard (booking session)
    if (occupiedByOther.has(code)) return;

    dispatch(
      setDraftSeat({
        paxId,
        journeyKey,
        seat: {
          seatCode: seatObj.seatCode,
          rowNumber: seatObj.rowNumber,
          seat: seatObj.seatLetter,
          amount: seatObj.amount || 0,
          currency: seatObj.currency || "THB",
          vat: seatObj.vat || 0,
          serviceCode: seatObj.serviceCode || "",
          description: seatObj.description || "",
        },
      })
    );
  };

  const onSave = () => dispatch(saveSeat({ paxId, journeyKey }));

  // ✅ Cancel: if draft exists -> clear draft; else if saved exists -> release saved
  const onCancel = () => {
    if (hasDraft) {
      dispatch(clearDraftSeat({ paxId, journeyKey }));
      return;
    }
    if (hasSaved) {
      dispatch(clearSavedSeat({ paxId, journeyKey }));
      return;
    }
  };

  if (!legs.length) {
    return (
      <div className="text-sm text-slate-600">
        No selectedOffers found (cannot show seat map yet).
      </div>
    );
  }

  const flightInfo = flightInfoByJourneyKey?.[journeyKey] || null;

  // ✅ Reusable Action Bar (top/bottom)
  function ActionBar({ variant = "top" }) {
    const isTop = variant === "top";

    return (
      <div
        className={[
          "flex items-center justify-between gap-2 flex-wrap",
          "rounded-xl border border-slate-200 bg-white",
          "px-3 py-2",
          isTop ? "sticky top-0 z-10" : "",
        ].join(" ")}
      >
        {/* Left: Saved/Draft */}
        <div className="text-sm text-slate-700">
          <span className="font-semibold">{t?.saved ?? "Saved"}:</span>{" "}
          <span className={saved?.seatCode ? "font-extrabold text-emerald-700" : "text-slate-500"}>
            {saved?.seatCode || "-"}
          </span>
          <span className="mx-2 text-slate-300">|</span>
          <span className="font-semibold">{t?.draft ?? "Draft"}:</span>{" "}
          <span className={draft?.seatCode ? "font-extrabold text-sky-700" : "text-slate-500"}>
            {draft?.seatCode || "-"}
          </span>
        </div>

        {/* Right: buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className={[
              "px-4 py-2 rounded-lg font-bold",
              canSave
                ? "bg-sky-600 text-white hover:bg-sky-700"
                : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
            title={!canSave ? "Pick a seat (Draft) before saving" : "Save seat"}
          >
            {t?.saveSeat ?? "Save seat"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={!canCancel}
            className={[
              "px-4 py-2 rounded-lg font-bold border",
              canCancel
                ? "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
            ].join(" ")}
            title={
              !canCancel
                ? "Nothing to cancel"
                : hasDraft
                ? "Cancel draft (keep saved)"
                : "Release saved seat"
            }
          >
            {hasDraft ? (t?.cancelDraft ?? t?.cancel ?? "Cancel") : (t?.release ?? "Release")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Leg toggle */}
      <div className="flex gap-2 flex-wrap">
        {legs.map((l) => {
          const active = l.idx === legIndex;
          return (
            <button
              key={`${l.fareKey}-${l.journeyKey}`}
              type="button"
              onClick={() => setLegIndex(l.idx)}
              className={[
                "px-3 py-1.5 rounded-full border text-sm font-semibold",
                active
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-sky-400",
              ].join(" ")}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      {/* Optional: flight info line */}
      {flightInfo ? (
        <div className="text-xs sm:text-sm text-slate-700">
          <div className="font-extrabold text-slate-900">
            {flightInfo.flightNumber || "-"} • {flightInfo.route || ""}
          </div>
          <div className="text-slate-600">
            {flightInfo.dateText || ""} {flightInfo.timeText ? `• ${flightInfo.timeText}` : ""}
          </div>
        </div>
      ) : null}

      {/* Status */}
      <div className="text-xs text-slate-500">
        seatMapStatus: <b>{seatMapStatus}</b> • requestKey(fareKey): <b>{requestKey}</b>
        {" • "}lockedByOther: <b>{occupiedByOther.size}</b>
      </div>

      {/* ✅ TOP action bar */}
      <ActionBar variant="top" />

      {seatMapStatus === "loading" ? (
        <div className="text-sm text-slate-600">Loading seat map…</div>
      ) : null}

      {seatMapStatus === "failed" ? (
        <div className="text-sm text-red-600">
          <div className="font-bold">Seat map API failed</div>
          <div className="text-xs whitespace-pre-wrap break-words">
            {seatMapError || "Unknown error"}
          </div>

          <button
            type="button"
            onClick={() =>
              dispatch(
                fetchSeatMap({
                  offer: {
                    fareKey: activeLeg?.fareKey,
                    journeyKey: activeLeg?.journeyKey,
                    securityToken: activeLeg?.securityToken,
                  },
                })
              )
            }
            className="mt-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:border-slate-400"
          >
            Retry API
          </button>
        </div>
      ) : null}

      {/* Seats */}
      {seatMapStatus === "succeeded" && rows.length === 0 ? (
        <div className="text-sm text-slate-600">
          Seat map loaded but no seatCharges for this journeyKey.
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-2 overflow-x-auto">
          {rows.map(([rowNo, seats]) => {
            const byLetter = new Map(seats.map((s) => [String(s.seatLetter || "").trim(), s]));

            return (
              <div key={rowNo} className="flex items-center gap-1 sm:gap-2 min-w-max">
                {/* Row number */}
                <div className="hidden sm:flex w-10 text-xs font-bold text-slate-500 justify-end pr-1">
                  {rowNo}
                </div>

                {/* Seats area */}
                <div className="w-4/5 sm:w-auto">
                  <div className="flex items-center gap-1 sm:gap-2">
                    {SEAT_COLUMNS.map((col) => {
                      if (col === "_AISLE_") {
                        return <div key={`${rowNo}-aisle`} className="w-2 sm:w-4" />;
                      }

                      const s = byLetter.get(col) || null;
                      const seatCode = s?.seatCode || `${rowNo}${col}`;
                      const apiDisabled = s ? s.available === false : true;

                      const isDraft = draft?.seatCode === seatCode;
                      const isSaved = saved?.seatCode === seatCode;

                      // ✅ Realtime lock by other pax in this booking session
                      const takenByOther = occupiedByOther.has(seatCode) && !isDraft && !isSaved;

                      const disabledFinal = apiDisabled || takenByOther;

                      const amt = Number(s?.amount || 0) || 0;
                      const vat = Number(s?.vat || 0) || 0;
                      const total = amt + vat;
                      const ccy = s?.currency || "THB";
                      const desc = s?.description || "";

                      const tooltip = disabledFinal
                        ? takenByOther
                          ? `${seatCode} • Temporarily occupied by another passenger in this booking`
                          : "No seat"
                        : [
                            seatCode,
                            desc ? `description: ${desc}` : null,
                            `totalPrice: ${total.toFixed(2)} ${ccy}`,
                            `amount: ${amt.toFixed(2)}`,
                            `vat: ${vat.toFixed(2)}`,
                          ]
                            .filter(Boolean)
                            .join(" • ");

                      return (
                        <button
                          key={seatCode}
                          type="button"
                          disabled={disabledFinal}
                          onClick={() => (s ? pickSeat(s) : null)}
                          className={[
                            "h-9 sm:h-10",
                            "w-[52px] sm:w-[72px]",
                            "rounded-lg border font-extrabold",
                            "text-[11px] sm:text-sm",
                            disabledFinal
                              ? takenByOther
                                ? "bg-rose-50 border-rose-200 text-rose-300 cursor-not-allowed"
                                : "bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed"
                              : isSaved
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                              : isDraft
                              ? "bg-sky-50 border-sky-300 text-sky-800"
                              : "bg-white border-slate-300 text-slate-700 hover:border-sky-300",
                          ].join(" ")}
                          title={tooltip}
                        >
                          {seatCode}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ✅ BOTTOM action bar */}
      <ActionBar variant="bottom" />

      <div className="text-xs text-slate-500">
        Hover shows: seatCode • description • totalPrice(amount+vat) • amount • vat (from API).
      </div>
    </div>
  );
}
