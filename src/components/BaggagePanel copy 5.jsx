// src/components/BaggagePanel.jsx
import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setDraftBaggage,
  saveBaggage,
  clearDraftBaggage,
  clearSavedBaggage,
  selectDraftBaggage,
  selectSavedBaggage,
} from "../redux/baggageSelectionSlice";

/* ========================= PNG icons (Vite-safe) ========================= */
const baggageImg = new URL("../assets/anc_baggage.png", import.meta.url).href;
const specialBaggageImg = new URL(
  "../assets/anc_special_baggage.png",
  import.meta.url
).href;

// ✅ icon size ~250% (32px -> 80px)
const ICON_CLASS_250 = "w-20 h-20 object-contain";

// ✅ make PNG “stronger” WITHOUT shadow (shadow makes gray background look stronger)
const ICON_FILTER = "brightness-90 contrast-150 saturate-150";

/* ========================= Helpers (match SeatMapPanel style) ========================= */
function normalize(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
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
  const s = String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const m = /^([A-Z]{2})(\d{2,4})/.exec(s);
  if (!m) return "";
  return `${m[1]}${m[2]}`;
}

function extractFlightNoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "").toUpperCase();
  const m =
    /_([A-Z]{2}\d{2,4})(?=20\d{6})/.exec(s) || // stop before date
    /_([A-Z]{2}\d{2,4})/.exec(s);
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

function formatMoney(x, currency = "THB") {
  const n = Number(x);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

/* rawDetail can be many shapes (same robustness as your existing) */
function pickAirlinesFromRawDetail(rawDetail) {
  if (!rawDetail) return [];
  if (Array.isArray(rawDetail?.airlines)) return rawDetail.airlines;
  if (Array.isArray(rawDetail?.data?.airlines)) return rawDetail.data.airlines;
  if (Array.isArray(rawDetail?.data?.data?.airlines))
    return rawDetail.data.data.airlines;
  if (Array.isArray(rawDetail?.detail?.data?.airlines))
    return rawDetail.detail.data.airlines;
  if (Array.isArray(rawDetail?.detail?.data?.data?.airlines))
    return rawDetail.detail.data.data.airlines;
  if (Array.isArray(rawDetail?.detail?.airlines)) return rawDetail.detail.airlines;

  const legs = rawDetail?.legs;
  if (Array.isArray(legs)) {
    const merged = [];
    for (const leg of legs) {
      const al = leg?.data?.airlines;
      if (Array.isArray(al)) merged.push(...al);
    }
    return merged;
  }
  return [];
}

function sameService(a, b) {
  const aa = a?.ssrCode ? normalize(a.ssrCode) : "";
  const bb = b?.ssrCode ? normalize(b.ssrCode) : "";
  return aa === bb;
}

function hasAnySelection(x) {
  return !!(x?.bg?.ssrCode || x?.sb?.ssrCode);
}

/* ========================= Component ========================= */
export default function BaggagePanel({ paxId, selectedOffers = [], rawDetail, t }) {
  const dispatch = useDispatch();
  const [legIndex, setLegIndex] = useState(0);

  const airlines = useMemo(() => pickAirlinesFromRawDetail(rawDetail), [rawDetail]);

  const legs = useMemo(() => {
    return (selectedOffers || [])
      .filter(Boolean)
      .map((o, idx) => ({
        idx,
        journeyKey: o?.journeyKey || "",
        fareKey: o?.fareKey || "",
        label: idx === 0 ? (t?.depart ?? "Depart") : (t?.return ?? "Return"),
      }))
      .filter((x) => x.journeyKey);
  }, [selectedOffers, t]);

  const activeLeg = legs[legIndex] || null;
  const journeyKey = activeLeg?.journeyKey || "";
  const flightNo = useMemo(() => extractFlightNoFromJourneyKey(journeyKey), [journeyKey]);

  // ✅ hooks safe
  const draft = useSelector(selectDraftBaggage(paxId, journeyKey));
  const saved = useSelector(selectSavedBaggage(paxId, journeyKey));

  const currentDraft = draft || { bg: null, sb: null };
  const currentSaved = saved || { bg: null, sb: null };

  // ✅ show saved when user never touched draft
  const uiBG = draft == null ? currentSaved?.bg : currentDraft?.bg;
  const uiSB = draft == null ? currentSaved?.sb : currentDraft?.sb;

  const hasDraft =
    hasAnySelection(currentDraft) ||
    (!hasAnySelection(currentDraft) &&
      hasAnySelection(currentSaved) &&
      draft !== undefined &&
      draft !== null);

  const hasSaved = hasAnySelection(currentSaved);

  const changed =
    !sameService(currentDraft?.bg, currentSaved?.bg) ||
    !sameService(currentDraft?.sb, currentSaved?.sb);

  const canConfirm = !!journeyKey && changed;
  const canCancel = !!journeyKey && (hasDraft || hasSaved);

  const route = useMemo(() => parseRouteFromJourneyKey(journeyKey), [journeyKey]);

  const departDate = useMemo(() => {
    const iso = extractIsoFromJourneyKey(journeyKey);
    return iso ? new Date(`${iso}T00:00:00`) : null;
  }, [journeyKey]);

  const dayText = useMemo(() => weekdayShort(departDate), [departDate]);
  const dateText = useMemo(() => fmtDateLong(departDate), [departDate]);

  const servicesForFlight = useMemo(() => {
    if (!flightNo) return { bg: [], sb: [] };

    const airline = airlines.find((a) => {
      const infos = a?.travelInfos || [];
      return infos.some((ti) => normalize(ti?.flightNumber) === normalize(flightNo));
    });

    const services = airline?.availableExtraServices || [];
    const bg = services.filter((s) => /^BG\d{2}$/.test(normalize(s?.ssrCode)));
    const sb = services.filter((s) => /^SB\d{2}$/.test(normalize(s?.ssrCode)));
    return { bg, sb };
  }, [airlines, flightNo]);

  function ActionBar() {
    const confirmedBG = currentSaved?.bg?.ssrCode ? normalize(currentSaved.bg.ssrCode) : "-";
    const confirmedSB = currentSaved?.sb?.ssrCode ? normalize(currentSaved.sb.ssrCode) : "-";

    const selectingBG = uiBG?.ssrCode ? normalize(uiBG.ssrCode) : "-";
    const selectingSB = uiSB?.ssrCode ? normalize(uiSB.ssrCode) : "-";

    // ✅ NEW: line-by-line summary rows (Confirmed / Selecting)
    const Row = ({ label, value, tone }) => (
      <div className="flex items-center gap-2 text-[13px] leading-snug">
        <span className="text-slate-600 font-semibold w-[86px]">{label}</span>
        <span
          className={[
            "font-extrabold",
            value !== "-" ? tone : "text-slate-500 font-semibold",
          ].join(" ")}
        >
          {value}
        </span>
      </div>
    );

    return (
      <div className="flex items-start justify-between gap-2 flex-wrap rounded-xl border border-slate-200 bg-white px-3 py-2">
        {/* LEFT: Summary (line-by-line) */}
        <div className="min-w-[240px]">
          <div className="space-y-2">
            {/* Confirmed */}
            <div>
              <div className="text-[12px] font-extrabold text-slate-700">
                {t?.confirmed ?? "Confirmed"}:
              </div>
              <div className="mt-1 pl-2 space-y-1">
                <Row
                  label={t?.checkedBaggageShort ?? (t?.checkedBaggage ?? "Baggage")}
                  value={confirmedBG}
                  tone="text-emerald-700"
                />
                <Row
                  label={t?.specialBaggageShort ?? (t?.specialBaggage ?? "Special")}
                  value={confirmedSB}
                  tone="text-emerald-700"
                />
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            {/* Selecting */}
            <div>
              <div className="text-[12px] font-extrabold text-slate-700">
                {t?.selecting ?? "Selecting"}:
              </div>
              <div className="mt-1 pl-2 space-y-1">
                <Row
                  label={t?.checkedBaggageShort ?? (t?.checkedBaggage ?? "Baggage")}
                  value={selectingBG}
                  tone="text-sky-700"
                />
                <Row
                  label={t?.specialBaggageShort ?? (t?.specialBaggage ?? "Special")}
                  value={selectingSB}
                  tone="text-sky-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Buttons */}
        <div className="flex items-center gap-2 self-center">
          <button
            type="button"
            onClick={() => dispatch(saveBaggage({ paxId, journeyKey }))}
            disabled={!canConfirm}
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
            onClick={() => {
              if (hasDraft) return dispatch(clearDraftBaggage({ paxId, journeyKey }));
              if (hasSaved) return dispatch(clearSavedBaggage({ paxId, journeyKey }));
            }}
            disabled={!canCancel}
            className={[
              "px-4 py-2 rounded-lg font-bold border",
              canCancel
                ? "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {hasDraft ? (t?.cancelSelecting ?? t?.cancel ?? "Cancel") : t?.release ?? "Release"}
          </button>
        </div>
      </div>
    );
  }

  if (!legs.length) {
    return (
      <div className="text-sm text-slate-600">
        {t?.noFlights ?? "No selectedOffers found (cannot show baggage yet)."}
      </div>
    );
  }

  const showSB = (servicesForFlight?.sb || []).length > 0;

  return (
    <div className="space-y-3">
      {/* Leg toggle */}
      <div className="flex gap-2 flex-wrap">
        {legs.map((l) => {
          const active = l.idx === legIndex;
          return (
            <button
              key={`${l.journeyKey}-${l.idx}`}
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

      {/* Flight header */}
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
            >
              {dayText || "—"}
            </span>

            <div className="text-sm text-slate-700 font-semibold">{dateText || ""}</div>
          </div>
        </div>
      </div>

      <ActionBar />

      {/* BG options */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        {/* ✅ NO gray wrapper around icon */}
        <div className="flex items-center gap-3 mb-2">
          <img
            src={baggageImg}
            alt="Baggage"
            className={`${ICON_CLASS_250} ${ICON_FILTER} bg-transparent p-0 shadow-none rounded-none`}
          />
          <div className="min-w-0">
            <div className="font-extrabold text-slate-900">
              {t?.bagCheckedTitle ?? (t?.isTH ? "สัมภาระโหลดใต้ท้องเครื่อง" : "Checked baggage")}
            </div>
            <div className="text-xs text-slate-500">
              {t?.bagHint ?? (t?.isTH ? "เลือกน้ำหนักสัมภาระที่ต้องการ" : "Choose your baggage weight")}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          {/* None */}
          <label className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-sky-50">
            <div className="flex items-center gap-2 min-w-0">
              <input
                type="radio"
                name={`bg-${paxId}-${journeyKey}`}
                checked={!uiBG}
                onChange={() =>
                  dispatch(
                    setDraftBaggage({
                      paxId,
                      journeyKey,
                      kind: "BG",
                      service: null,
                    })
                  )
                }
              />
              <span className="text-slate-700 font-semibold">
                {t?.noBaggage ?? (t?.isTH ? "ไม่เพิ่มสัมภาระ" : "No baggage")}
              </span>
            </div>
            <span className="text-slate-400 text-sm">—</span>
          </label>

          {(servicesForFlight?.bg || []).map((s) => {
            const code = normalize(s?.ssrCode);
            const checked = normalize(uiBG?.ssrCode) === code;

            return (
              <label
                key={code}
                className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-sky-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="radio"
                    name={`bg-${paxId}-${journeyKey}`}
                    checked={checked}
                    onChange={() =>
                      dispatch(
                        setDraftBaggage({
                          paxId,
                          journeyKey,
                          kind: "BG",
                          service: {
                            ssrCode: code,
                            description: s?.description || "",
                            amount: s?.amount ?? 0,
                            currency: s?.currency || "THB",
                            vat: s?.vat,
                            flightNumber: s?.flightNumber || flightNo,
                            departureDate: s?.departureDate,
                          },
                        })
                      )
                    }
                  />

                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">
                      {s?.description || (t?.checkedBaggage ?? "Baggage")}
                      {/* ✅ keep code small grey (not in title) */}
                      <span className="ml-2 text-xs text-slate-400 font-bold">{code}</span>
                    </div>
                  </div>
                </div>

                <div className="text-sky-700 font-extrabold whitespace-nowrap">
                  {formatMoney(s?.amount, s?.currency || "THB")}
                </div>
              </label>
            );
          })}

          {(servicesForFlight?.bg || []).length === 0 ? (
            <div className="text-xs text-slate-500">
              {t?.noBgOptions ??
                (t?.isTH ? "เที่ยวบินนี้ไม่มีตัวเลือกสัมภาระ" : "No baggage options for this flight.")}
            </div>
          ) : null}
        </div>
      </div>

      {/* SB options */}
      {showSB ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          {/* ✅ NO gray wrapper around icon */}
          <div className="flex items-center gap-3 mb-2">
            <img
              src={specialBaggageImg}
              alt="Special baggage"
              className={`${ICON_CLASS_250} ${ICON_FILTER} bg-transparent p-0 shadow-none rounded-none`}
            />
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900">
                {t?.bagSpecialTitle ?? (t?.isTH ? "สัมภาระพิเศษ" : "Special baggage")}
              </div>
              <div className="text-xs text-slate-500">
                {t?.specialBagHint ??
                  (t?.isTH
                    ? "เช่น อุปกรณ์กีฬา จักรยาน กระดานโต้คลื่น"
                    : "e.g. sports equipment, bike, surfboard")}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-sky-50">
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="radio"
                  name={`sb-${paxId}-${journeyKey}`}
                  checked={!uiSB}
                  onChange={() =>
                    dispatch(
                      setDraftBaggage({
                        paxId,
                        journeyKey,
                        kind: "SB",
                        service: null,
                      })
                    )
                  }
                />
                <span className="text-slate-700 font-semibold">
                  {t?.none ?? (t?.isTH ? "ไม่เลือก" : "None")}
                </span>
              </div>
              <span className="text-slate-400 text-sm">—</span>
            </label>

            {(servicesForFlight?.sb || []).map((s) => {
              const code = normalize(s?.ssrCode);
              const checked = normalize(uiSB?.ssrCode) === code;

              return (
                <label
                  key={code}
                  className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-sky-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="radio"
                      name={`sb-${paxId}-${journeyKey}`}
                      checked={checked}
                      onChange={() =>
                        dispatch(
                          setDraftBaggage({
                            paxId,
                            journeyKey,
                            kind: "SB",
                            service: {
                              ssrCode: code,
                              description: s?.description || "",
                              amount: s?.amount ?? 0,
                              currency: s?.currency || "THB",
                              vat: s?.vat,
                              flightNumber: s?.flightNumber || flightNo,
                              departureDate: s?.departureDate,
                            },
                          })
                        )
                      }
                    />

                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">
                        {s?.description || (t?.bagSpecial ?? "Special baggage")}
                        <span className="ml-2 text-xs text-slate-400 font-bold">{code}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-sky-700 font-extrabold whitespace-nowrap">
                    {formatMoney(s?.amount, s?.currency || "THB")}
                  </div>
                </label>
              );
            })}

            {(servicesForFlight?.sb || []).length === 0 ? (
              <div className="text-xs text-slate-500">
                {t?.noSbOptions ??
                  (t?.isTH ? "เที่ยวบินนี้ไม่มีตัวเลือกสัมภาระพิเศษ" : "No special baggage options for this flight.")}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}