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

/* ========================= Helpers ========================= */
function normalize(v) {
  return String(v || "").trim().replace(/\s+/g, "").toUpperCase();
}

function sanitizeFlightNumber(v) {
  const s = String(v || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z]{2})(\d{2,4})/.exec(s);
  if (!m) return "";
  return `${m[1]}${m[2]}`;
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

function weekdayShort(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function fmtDateLong(d) {
  if (!d) return "";
  // "14 Feb 2026"
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** JourneyKey -> YYYY-MM-DD */
function extractIsoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /(20\d{2})(\d{2})(\d{2})/.exec(s);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/** JourneyKey -> {origin,destination} */
function parseRouteFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /^([A-Z]{3})([A-Z]{3})/.exec(s);
  if (!m) return { origin: "", destination: "" };
  return { origin: m[1], destination: m[2] };
}

/** JourneyKey -> flightNumber (fix DD1422026 => DD142) */
function extractFlightNoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "").toUpperCase();
  const m =
    /_([A-Z]{2}\d{2,4})(?=20\d{6})/.exec(s) || // stop before date
    /_([A-Z]{2}\d{2,4})/.exec(s);
  return sanitizeFlightNumber(m ? m[1] : "");
}

/* ========================= SeatMap data extract ========================= */
function getSeatMapItems(seatMapData) {
  if (!seatMapData) return [];
  if (Array.isArray(seatMapData)) return seatMapData;
  if (Array.isArray(seatMapData?.data)) return seatMapData.data;
  if (Array.isArray(seatMapData?.detail?.data)) return seatMapData.detail.data;
  return [];
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
  let seg =
    flightTokens.length
      ? responseData.find((s) =>
          flightTokens.includes(String(s?.flightNumber || "").trim())
        )
      : null;

  return seg || responseData[0] || null;
}

function extractSeatChargesForJourney(seatMapData, journeyKey, fareKey) {
  if (!seatMapData) return [];

  if (Array.isArray(seatMapData?.seatCharges)) return seatMapData.seatCharges;
  if (Array.isArray(seatMapData?.data?.seatCharges)) return seatMapData.data.seatCharges;

  const matchedItem = findMatchedItem(seatMapData, fareKey);
  if (!matchedItem) return [];

  const segment = findMatchedSegmentFromItem(matchedItem, journeyKey);
  if (!segment) return [];

  const seatCharges = segment?.seatCharges || segment?.seatCharge || segment?.seats || [];
  return Array.isArray(seatCharges) ? seatCharges : [];
}

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

/* ========================= Component ========================= */
export default function SeatMapPanel({ paxId, selectedOffers = [], t }) {
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

  const seatMapStatusPrimary = useSelector(selectSeatMapStatus(requestKey));
  const seatMapDataPrimary = useSelector(selectSeatMapFor(requestKey));
  const seatMapErrorPrimary = useSelector((s) => s?.seatMap?.error?.[requestKey] || null);

  // fallback read
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

  useEffect(() => {
    if (!activeLeg) return;
    if (seatMapData) return;
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
    if (hasDraft) return dispatch(clearDraftSeat({ paxId, journeyKey }));
    if (hasSaved) return dispatch(clearSavedSeat({ paxId, journeyKey }));
  };

  if (!legs.length) {
    return <div className="text-sm text-slate-600">No selectedOffers found (cannot show seat map yet).</div>;
  }

  /* ===== Header (NO time) ===== */
  const route = useMemo(() => parseRouteFromJourneyKey(journeyKey), [journeyKey]);
  const flightNo = useMemo(() => extractFlightNoFromJourneyKey(journeyKey), [journeyKey]);

  const departDate = useMemo(() => {
    const iso = extractIsoFromJourneyKey(journeyKey);
    return iso ? new Date(`${iso}T00:00:00`) : null;
  }, [journeyKey]);

  const dayText = useMemo(() => weekdayShort(departDate), [departDate]);
  const dateText = useMemo(() => fmtDateLong(departDate), [departDate]);

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className={[
              "px-4 py-2 rounded-lg font-bold",
              canSave ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            {t?.confirm ?? "Confirm"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={!canCancel}
            className={[
              "px-4 py-2 rounded-lg font-bold border",
              canCancel ? "border-slate-300 bg-white text-slate-700 hover:border-slate-400" : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {hasDraft ? (t?.cancelSelecting ?? t?.cancel ?? "Cancel") : (t?.release ?? "Release")}
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
                active ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-700 border-slate-300 hover:border-sky-400",
              ].join(" ")}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      {/* ✅ Header (route + flightNo, no time) */}
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
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
              title="Day of week"
            >
              {dayText || "—"}
            </span>

            <div className="text-sm font-bold text-slate-800">{dateText || "—"}</div>
          </div>

          {/* Keep it clean on right side (no debug line) */}
          <div className="text-xs text-slate-500">
            {seatMapStatus === "loading" ? "Loading seat map…" : seatMapStatus === "failed" ? "Seat map failed" : ""}
          </div>
        </div>
      </div>

      <ActionBar variant="top" />

      {seatMapStatus === "failed" ? (
        <div className="text-sm text-red-600">
          <div className="font-bold">Seat map API failed</div>
          <div className="text-xs whitespace-pre-wrap break-words">
            {seatMapError || "Unknown error"}
          </div>
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

      <ActionBar variant="bottom" />
    </div>
  );
}
