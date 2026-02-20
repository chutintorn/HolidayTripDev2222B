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

function normalize(v) {
  return String(v || "").trim().replace(/\s+/g, "").toUpperCase();
}

function findMatchedItem(seatMapData, fareKey) {
  const items = getSeatMapItems(seatMapData);
  if (!items.length) return null;

  const fk = normalize(fareKey);

  return (
    items.find((it) => normalize(it?.request?.fareKey) === fk) ||
    items.find((it) => normalize(it?.request?.fareKey).includes(fk)) ||
    items[0] ||
    null
  );
}

function findMatchedSegmentFromItem(item, journeyKey) {
  const responseData = item?.response?.data || item?.data || [];
  if (!Array.isArray(responseData) || !responseData.length) return null;

  const flightTokens = String(journeyKey || "").match(/[A-Z]{2}\d{2,4}/g) || [];
  let segment =
    flightTokens.length
      ? responseData.find((seg) =>
          flightTokens.includes(String(seg?.flightNumber || "").trim())
        )
      : null;

  return segment || responseData[0] || null;
}

/** extract seatCharges by fareKey/journeyKey (robust for your proxy response) */
function extractSeatChargesForJourney(seatMapData, journeyKey, fareKey) {
  if (!seatMapData) return [];

  if (Array.isArray(seatMapData?.seatCharges)) return seatMapData.seatCharges;
  if (Array.isArray(seatMapData?.data?.seatCharges)) return seatMapData.data.seatCharges;

  const matchedItem = findMatchedItem(seatMapData, fareKey);
  if (!matchedItem) return [];

  const segment = findMatchedSegmentFromItem(matchedItem, journeyKey);
  if (!segment) return [];

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

/** ===== Flight header helpers ===== */
function safeParseDate(x) {
  if (!x) return null;
  const s = String(x).trim().replace(" ", "T");
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateDDMMM(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtTimeHHMM(d) {
  if (!d) return "--:--";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function weekdayShort(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function weekdayPillClass(d) {
  if (!d) return "bg-slate-100 text-slate-700 border-slate-200";
  const day = d.getDay(); // 0 Sun .. 6 Sat
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

function extractFlightInfoFromSeatMap(seatMapData, journeyKey, fareKey) {
  const item = findMatchedItem(seatMapData, fareKey);
  if (!item) return null;

  const seg = findMatchedSegmentFromItem(item, journeyKey);
  if (!seg) return null;

  const origin = String(seg?.origin || "").trim();
  const destination = String(seg?.destination || "").trim();
  const flightNumber = String(seg?.flightNumber || "").trim();

  const departRaw = seg?.departureDate || seg?.departure || "";
  const arriveRaw = seg?.arrivalDate || seg?.arrivalTime || seg?.arrival || "";

  const departDate = safeParseDate(departRaw);
  const arriveDate = safeParseDate(arriveRaw);

  return { origin, destination, flightNumber, departDate, arriveDate };
}

export default function SeatMapPanel({
  paxId,
  selectedOffers = [],
  t,
  flightInfoByJourneyKey, // optional
}) {
  const dispatch = useDispatch();
  const [legIndex, setLegIndex] = useState(0);

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
  const requestKey = fareKey || "unknown";

  // ===== Primary read (by fareKey) =====
  const seatMapStatusPrimary = useSelector(selectSeatMapStatus(requestKey));
  const seatMapDataPrimary = useSelector(selectSeatMapFor(requestKey));
  const seatMapErrorPrimary = useSelector((s) => s?.seatMap?.error?.[requestKey] || null);

  // ===== Fallback read: scan all byKey and find any data that contains request.fareKey =====
  const seatMapDataFallback = useSelector((state) => {
    const fk = normalize(fareKey);
    const byKey = state?.seatMap?.byKey || {};
    for (const k of Object.keys(byKey)) {
      const data = byKey[k];
      const items = getSeatMapItems(data);
      if (!items?.length) continue;
      const hit = items.find((it) => normalize(it?.request?.fareKey) === fk);
      if (hit) return data;
    }
    return null;
  });

  const seatMapData = seatMapDataPrimary || seatMapDataFallback;
  const seatMapStatus =
    seatMapStatusPrimary !== "idle"
      ? seatMapStatusPrimary
      : seatMapDataFallback
      ? "succeeded"
      : "idle";
  const seatMapError = seatMapErrorPrimary;

  const draft = useSelector(selectDraftSeat(paxId, journeyKey));
  const saved = useSelector(selectSavedSeat(paxId, journeyKey));

  const allSaved = useSelector(selectAllSavedSeats);
  const allDraft = useSelector(selectAllDraftSeats);

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
  const canCancel = hasDraft || hasSaved;

  // ✅ auto-load per leg (no duplicate if we already have fallback data)
  useEffect(() => {
    if (!activeLeg) return;
    if (seatMapData) return; // already have data (primary or fallback)
    if (seatMapStatusPrimary !== "idle") return;

    dispatch(
      fetchSeatMap({
        offer: {
          fareKey: activeLeg.fareKey,
          journeyKey: activeLeg.journeyKey,
          securityToken: activeLeg.securityToken,
        },
      })
    );
  }, [dispatch, activeLeg, seatMapData, seatMapStatusPrimary]);

  const seatCharges = useMemo(
    () => extractSeatChargesForJourney(seatMapData, journeyKey, fareKey),
    [seatMapData, journeyKey, fareKey]
  );

  const rows = useMemo(() => groupByRow(seatCharges), [seatCharges]);

  const SEAT_COLUMNS = ["A", "B", "C", "_AISLE_", "H", "J", "K"];

  const pickSeat = (seatObj) => {
    if (!seatObj?.seatCode) return;
    if (seatObj.available === false) return;

    const code = String(seatObj.seatCode);
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

  // ===== Flight header data (prefer supplied; else extract from seatMap response) =====
  const supplied = flightInfoByJourneyKey?.[journeyKey] || null;

  const extracted = useMemo(() => {
    if (!seatMapData) return null;
    return extractFlightInfoFromSeatMap(seatMapData, journeyKey, fareKey);
  }, [seatMapData, journeyKey, fareKey]);

  const header = useMemo(() => {
    const origin = supplied?.origin || extracted?.origin || "";
    const destination = supplied?.destination || extracted?.destination || "";
    const flightNumber = supplied?.flightNumber || extracted?.flightNumber || "";

    const departDate = supplied?.departDate
      ? safeParseDate(supplied?.departDate)
      : extracted?.departDate || null;

    const arriveDate = supplied?.arriveDate
      ? safeParseDate(supplied?.arriveDate)
      : extracted?.arriveDate || null;

    const dateText = supplied?.dateText || (departDate ? fmtDateDDMMM(departDate) : "");
    const dayText = supplied?.dayText || (departDate ? weekdayShort(departDate) : "");
    const depTime = supplied?.departTime || fmtTimeHHMM(departDate);
    const arrTime = supplied?.arriveTime || fmtTimeHHMM(arriveDate);

    return { origin, destination, flightNumber, departDate, dateText, dayText, depTime, arrTime };
  }, [supplied, extracted]);

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
        {/* Left: Confirmed / Selecting */}
        <div className="text-sm text-slate-700">
          <span className="font-semibold">{t?.confirmed ?? "Confirmed"}:</span>{" "}
          <span className={saved?.seatCode ? "font-extrabold text-emerald-700" : "text-slate-500"}>
            {saved?.seatCode || "-"}
          </span>

          <span className="mx-2 text-slate-300">|</span>

          <span className="font-semibold">{t?.selecting ?? "Selecting"}:</span>{" "}
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
            title={!canSave ? "Pick a seat (Selecting) before confirm" : "Confirm seat"}
          >
            {t?.confirm ?? "Confirm"}
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
                ? "Cancel selecting (keep confirmed)"
                : "Release confirmed seat"
            }
          >
            {hasDraft ? (t?.cancelSelecting ?? t?.cancel ?? "Cancel") : (t?.release ?? "Release")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Leg toggle (optional: you can later enhance this button to show day pill too) */}
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

      {/* ✅ Replace debug line with: Topest Flight Header */}
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-extrabold text-slate-900">
              {(header.origin || "—")} – {(header.destination || "—")}
            </div>

            <span className="text-slate-300">|</span>

            <div className="text-sm font-bold text-slate-800">
              {header.dateText || "—"}
            </div>

            <span
              className={[
                "inline-flex items-center text-xs font-extrabold px-2.5 py-1 rounded-full border",
                weekdayPillClass(header.departDate),
              ].join(" ")}
              title="Day of week"
            >
              {header.dayText || "—"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500">
              {t?.depart ?? "Depart"}:
            </span>
            <span className="text-sm font-extrabold text-slate-900">
              {header.depTime}
            </span>

            <span className="text-slate-300">|</span>

            <span className="text-xs font-bold text-slate-500">
              {t?.arrive ?? "Arrival"}:
            </span>
            <span className="text-sm font-extrabold text-slate-900">
              {header.arrTime}
            </span>

            <span className="text-slate-300">|</span>

            <span className="text-sm font-extrabold text-slate-900">
              {header.flightNumber || "—"}
            </span>
          </div>
        </div>
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

      {seatMapStatus === "succeeded" && rows.length === 0 ? (
        <div className="text-sm text-slate-600">
          Seat map loaded but no seatCharges for this journeyKey.
        </div>
      ) : null}

      {/* Seats */}
      {rows.length > 0 ? (
        <div className="space-y-2 overflow-x-auto">
          {rows.map(([rowNo, seats]) => {
            const byLetter = new Map(seats.map((s) => [String(s.seatLetter || "").trim(), s]));
            return (
              <div key={rowNo} className="flex items-center gap-1 sm:gap-2 min-w-max">
                <div className="hidden sm:flex w-10 text-xs font-bold text-slate-500 justify-end pr-1">
                  {rowNo}
                </div>

                <div className="w-4/5 sm:w-auto">
                  <div className="flex items-center gap-1 sm:gap-2">
                    {SEAT_COLUMNS.map((col) => {
                      if (col === "_AISLE_") return <div key={`${rowNo}-aisle`} className="w-2 sm:w-4" />;

                      const s = byLetter.get(col) || null;
                      const seatCode = s?.seatCode || `${rowNo}${col}`;
                      const apiDisabled = s ? s.available === false : true;

                      const isDraft = draft?.seatCode === seatCode;
                      const isSaved = saved?.seatCode === seatCode;

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
