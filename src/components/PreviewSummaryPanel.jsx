// src/components/PreviewSummaryPanel.jsx
import React, { useMemo } from "react";
import { useSelector } from "react-redux";

import { selectAllSavedSeats, selectAllDraftSeats } from "../redux/seatSelectionSlice";
import { selectAllSavedBaggage, selectAllDraftBaggage } from "../redux/baggageSelectionSlice";

/* ========================= helpers ========================= */
function norm(v) {
  return String(v || "").trim();
}

function normUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function labelForLeg(idx, total, t) {
  if (total >= 2) {
    if (idx === 0) return t?.depart || t?.legDepart || "Depart";
    return t?.return || t?.legReturn || "Return";
  }
  return t?.depart || t?.legDepart || "Depart";
}

function extractFlightNumberFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /_([A-Z]{2}\d{2,4})20\d{6}/.exec(s) || /_([A-Z]{2}\d{2,4})/.exec(s);
  return m ? m[1] : "";
}

function seatCodeFromSeatObj(seatObj) {
  if (!seatObj) return "";
  if (typeof seatObj === "string") return seatObj;
  const s = seatObj.seatCode || seatObj.seat || seatObj.seatNumber;
  if (s) return String(s);
  if (seatObj.rowNumber && seatObj.column) return `${seatObj.rowNumber}${seatObj.column}`;
  return "";
}

function statusPill(status) {
  // status: "confirmed" | "selecting" | "none"
  if (status === "confirmed") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "selecting") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function resolveSeatStatus({ savedSeat, draftSeat }) {
  const saved = seatCodeFromSeatObj(savedSeat);
  const draft = seatCodeFromSeatObj(draftSeat);

  if (saved) return { value: saved, status: "confirmed" };
  if (draft) return { value: draft, status: "selecting" };
  return { value: "-", status: "none" };
}

function resolveBaggageStatus({ savedLeg, draftLeg }) {
  const sBg = normUpper(savedLeg?.bg?.ssrCode);
  const sSb = normUpper(savedLeg?.sb?.ssrCode);
  const dBg = normUpper(draftLeg?.bg?.ssrCode);
  const dSb = normUpper(draftLeg?.sb?.ssrCode);

  const savedAny = !!(sBg || sSb);
  const draftAny = !!(dBg || dSb);

  return {
    bg: savedAny ? (sBg || "-") : draftAny ? (dBg || "-") : "-",
    sb: savedAny ? (sSb || "-") : draftAny ? (dSb || "-") : "-",
    status: savedAny ? "confirmed" : draftAny ? "selecting" : "none",
  };
}

export default function PreviewSummaryPanel({
  travellers = [],
  forms = {},
  titleFromForm,
  selectedOffers = [],
  t,
}) {
  const allSavedSeats = useSelector(selectAllSavedSeats);
  const allDraftSeats = useSelector(selectAllDraftSeats);
  const allSavedBaggage = useSelector(selectAllSavedBaggage);
  const allDraftBaggage = useSelector(selectAllDraftBaggage);

  const legs = useMemo(() => {
    const so = Array.isArray(selectedOffers) ? selectedOffers : [];
    return so
      .map((o, idx) => ({
        idx,
        journeyKey: String(o?.journeyKey || ""),
        label: labelForLeg(idx, so.length, t),
        flightNo: extractFlightNumberFromJourneyKey(o?.journeyKey),
      }))
      .filter((x) => x.journeyKey);
  }, [selectedOffers, t]);

  return (
    <div className="mt-3 border border-slate-200 rounded-2xl bg-slate-50 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-slate-900">
            {t?.previewSummary || "Preview summary"}
          </div>
          <div className="text-xs sm:text-sm text-slate-600">
            {t?.previewSummaryHint || "Shows what is already saved (confirmed) and what is still selecting."}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className={`px-2 py-1 rounded-full border ${statusPill("confirmed")}`}>
            {t?.confirmed || "Confirmed"}
          </span>
          <span className={`px-2 py-1 rounded-full border ${statusPill("selecting")}`}>
            {t?.selecting || "Selecting"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {travellers.map((p) => {
          const paxId = String(p?.id ?? "");
          const v = forms?.[paxId] || {};
          const fullName =
            v.firstName && v.lastName
              ? `${typeof titleFromForm === "function" ? titleFromForm(v) : ""} ${norm(v.firstName)} ${norm(
                  v.lastName
                )}`.trim()
              : norm(p?.label || p?.name || `Pax ${paxId}`);

          return (
            <div key={paxId} className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{fullName || `Pax ${paxId}`}</div>
                <div className="text-xs text-slate-500">{(p?.type || "").toUpperCase()}</div>
              </div>

              {legs.length ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {legs.map((leg) => {
                    const j = leg.journeyKey;

                    const savedSeat = allSavedSeats?.[paxId]?.[j] ?? null;
                    const draftSeat = allDraftSeats?.[paxId]?.[j] ?? null;
                    const seatRes = resolveSeatStatus({ savedSeat, draftSeat });

                    const savedBagLeg = allSavedBaggage?.[paxId]?.[j] ?? null;
                    const draftBagLeg = allDraftBaggage?.[paxId]?.[j] ?? null;
                    const bagRes = resolveBaggageStatus({ savedLeg: savedBagLeg, draftLeg: draftBagLeg });

                    const hasAnySelecting = seatRes.status === "selecting" || bagRes.status === "selecting";
                    const hasAnyConfirmed = seatRes.status === "confirmed" || bagRes.status === "confirmed";
                    const overallStatus = hasAnyConfirmed ? "confirmed" : hasAnySelecting ? "selecting" : "none";

                    return (
                      <div key={j} className="border border-slate-200 rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {leg.label}
                            {leg.flightNo ? (
                              <span className="ml-2 text-xs font-normal text-slate-500">{leg.flightNo}</span>
                            ) : null}
                          </div>
                          <span className={`px-2 py-1 rounded-full border text-[11px] ${statusPill(overallStatus)}`}>
                            {overallStatus === "confirmed"
                              ? t?.confirmed || "Confirmed"
                              : overallStatus === "selecting"
                                ? t?.selecting || "Selecting"
                                : t?.notSelected || "Not selected"}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                          <div className="rounded-lg bg-white border border-slate-200 p-2">
                            <div className="text-[11px] text-slate-500">{t?.seatLabel || "Seat"}</div>
                            <div
                              className={`font-semibold ${
                                seatRes.status === "none" ? "text-slate-400" : "text-slate-900"
                              }`}
                            >
                              {seatRes.value}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${statusPill(
                                  seatRes.status
                                )}`}
                              >
                                {seatRes.status === "confirmed"
                                  ? t?.confirmed || "Confirmed"
                                  : seatRes.status === "selecting"
                                    ? t?.selecting || "Selecting"
                                    : t?.notSelected || "Not selected"}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-lg bg-white border border-slate-200 p-2">
                            <div className="text-[11px] text-slate-500">{t?.bgLabel || "BG"}</div>
                            <div className={`font-semibold ${bagRes.bg === "-" ? "text-slate-400" : "text-slate-900"}`}>
                              {bagRes.bg}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${statusPill(
                                  bagRes.status
                                )}`}
                              >
                                {bagRes.status === "confirmed"
                                  ? t?.confirmed || "Confirmed"
                                  : bagRes.status === "selecting"
                                    ? t?.selecting || "Selecting"
                                    : t?.notSelected || "Not selected"}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-lg bg-white border border-slate-200 p-2">
                            <div className="text-[11px] text-slate-500">{t?.sbLabel || "SB"}</div>
                            <div className={`font-semibold ${bagRes.sb === "-" ? "text-slate-400" : "text-slate-900"}`}>
                              {bagRes.sb}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${statusPill(
                                  bagRes.status
                                )}`}
                              >
                                {bagRes.status === "confirmed"
                                  ? t?.confirmed || "Confirmed"
                                  : bagRes.status === "selecting"
                                    ? t?.selecting || "Selecting"
                                    : t?.notSelected || "Not selected"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-600">{t?.noLegs || "No flight legs found (missing journeyKey)."}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
