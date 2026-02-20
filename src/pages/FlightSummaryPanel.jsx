// src/pages/FlightSummaryPanel.jsx
import React, { useMemo } from "react";

/* ================= helpers ================= */
function safeUpper(x) {
  return (x || "").toString().toUpperCase();
}

function extractIsoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /(20\d{2})(\d{2})(\d{2})/.exec(s);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function extractTimeFromJourneyKey(journeyKey) {
  // Example: DMKCNX20260211010000THB_DD14220260211
  const s = String(journeyKey || "");
  const m = /(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\d{2}/.exec(s); // YYYY MM DD HH MM SS
  if (!m) return "";
  const hh = m[4];
  const mm = m[5];
  return `${hh}:${mm}`;
}

function parseRouteFromJourneyKey(journeyKey) {
  // DMKCNX...
  const s = String(journeyKey || "");
  const m = /^([A-Z]{3})([A-Z]{3})/.exec(s);
  if (!m) return { origin: "", destination: "" };
  return { origin: m[1], destination: m[2] };
}

function extractFlightNoFromJourneyKey(journeyKey) {
  // ..._DD14220260211  OR ..._DD142
  const s = String(journeyKey || "");
  const m = /_([A-Z]{2}\d{2,4})/.exec(s);
  return m ? m[1] : "";
}

function weekdayName(d, lang) {
  const namesEN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const namesTH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  return lang === "th" ? namesTH[d] : namesEN[d];
}

function formatDate(iso, lang) {
  try {
    if (!iso) return "";
    const dt = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString(lang === "th" ? "th-TH" : undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatTime(any) {
  try {
    if (!any) return "";
    const s = String(any);
    const m = /(\d{2}:\d{2})/.exec(s);
    if (m) return m[1];
    const d = new Date(any);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function dayPillClass(dayIdx) {
  // small highlight pill
  switch (dayIdx) {
    case 1:
      return "bg-yellow-100 text-yellow-900 border-yellow-300";
    case 2:
      return "bg-pink-100 text-pink-900 border-pink-300";
    case 3:
      return "bg-green-100 text-green-900 border-green-300";
    case 4:
      return "bg-orange-100 text-orange-900 border-orange-300";
    case 5:
      return "bg-sky-100 text-sky-900 border-sky-300";
    case 6:
      return "bg-purple-100 text-purple-900 border-purple-300";
    case 0:
      return "bg-red-100 text-red-900 border-red-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getRootFromAny(rawDetail) {
  return rawDetail?.detail?.data || rawDetail?.data || rawDetail?.detail || rawDetail || null;
}

function labelForLeg(idx, total, lang) {
  if (total >= 2) {
    if (idx === 0) return lang === "th" ? "ขาไป" : "Depart";
    return lang === "th" ? "ขากลับ" : "Return";
  }
  return lang === "th" ? "ขาไป" : "Depart";
}

function tryReadAirFareFromLeg(leg) {
  // pricingDetails[].fareAmountIncludingTax or fareAmount
  const pds = Array.isArray(leg?.pricingDetails) ? leg.pricingDetails : [];
  if (!pds.length) return null;

  // sum all pricingDetails incl tax (most consistent)
  let sum = 0;
  let has = false;
  for (const pd of pds) {
    const v = Number(pd?.fareAmountIncludingTax ?? pd?.fareAmount ?? 0) || 0;
    if (v) has = true;
    sum += v;
  }
  return has ? sum : null;
}

function readLegTimesFromTravelInfos(a) {
  const ti0 = a?.travelInfos?.[0] || null;
  const dep =
    a?.departureDateTime ||
    a?.departureTime ||
    a?.departTime ||
    a?.departure ||
    ti0?.departureDateTime ||
    ti0?.departureTime ||
    ti0?.departTime ||
    "";
  const arr =
    a?.arrivalDateTime ||
    a?.arrivalTime ||
    a?.arriveTime ||
    a?.arrival ||
    ti0?.arrivalDateTime ||
    ti0?.arrivalTime ||
    ti0?.arriveTime ||
    "";
  return { depDT: dep, arrDT: arr };
}

function readLegRouteFromAny(a, journeyKey) {
  const ti0 = a?.travelInfos?.[0] || null;
  const origin =
    a?.origin ||
    a?.from ||
    a?.departureAirport ||
    ti0?.origin ||
    ti0?.from ||
    ti0?.departureAirport ||
    "";
  const destination =
    a?.destination ||
    a?.to ||
    a?.arrivalAirport ||
    ti0?.destination ||
    ti0?.to ||
    ti0?.arrivalAirport ||
    "";

  if (origin && destination) return { origin, destination };

  // fallback journeyKey
  if (journeyKey) return parseRouteFromJourneyKey(journeyKey);

  return { origin: "", destination: "" };
}

function readLegFlightNoFromAny(a, journeyKey) {
  const ti0 = a?.travelInfos?.[0] || null;
  return (
    a?.flightNumber ||
    a?.flightNo ||
    a?.travelInfos?.[0]?.flightNumber ||
    a?.travelInfos?.[0]?.flightNo ||
    ti0?.flightNumber ||
    ti0?.flightNo ||
    extractFlightNoFromJourneyKey(journeyKey) ||
    ""
  );
}

function buildLegs({ holdResponse, rawDetail, selectedOffers, lang }) {
  const legs = [];

  const rootHold = holdResponse || null;
  const rootPrice = getRootFromAny(rawDetail);

  const airlinesHold = Array.isArray(rootHold?.airlines) ? rootHold.airlines : [];
  const airlinesPrice = Array.isArray(rootPrice?.airlines) ? rootPrice.airlines : [];

  const so = Array.isArray(selectedOffers) ? selectedOffers : [];

  // prefer holdResponse (after submit-hold it usually has clearer travelInfos)
  const pickAirlines = airlinesHold.length ? airlinesHold : airlinesPrice;

  if (pickAirlines.length) {
    pickAirlines.forEach((a, idx) => {
      const journeyKey = so?.[idx]?.journeyKey || a?.journeyKey || "";

      const { origin, destination } = readLegRouteFromAny(a, journeyKey);
      const { depDT, arrDT } = readLegTimesFromTravelInfos(a);

      const flightNo = readLegFlightNoFromAny(a, journeyKey);

      const dateIso =
        (typeof depDT === "string" && depDT.slice(0, 10).includes("-") ? depDT.slice(0, 10) : "") ||
        extractIsoFromJourneyKey(journeyKey);

      const d = dateIso ? new Date(`${dateIso}T00:00:00`) : null;
      const dayIdx = d && !Number.isNaN(d.getTime()) ? d.getDay() : null;
      const dow = dayIdx === null ? "" : weekdayName(dayIdx, lang);

      const airFare = tryReadAirFareFromLeg(a);

      legs.push({
        idx,
        label: labelForLeg(idx, pickAirlines.length, lang),
        origin,
        destination,
        dateIso,
        dow,
        dayIdx,
        depTime: formatTime(depDT) || extractTimeFromJourneyKey(journeyKey),
        arrTime: formatTime(arrDT),
        flightNo,
        airFare,
      });
    });

    return legs;
  }

  // Fallback: from selectedOffers journeyKey only
  if (so.length) {
    so.forEach((o, idx) => {
      const journeyKey = o?.journeyKey || "";
      const { origin, destination } = parseRouteFromJourneyKey(journeyKey);
      const dateIso = extractIsoFromJourneyKey(journeyKey);

      const d = dateIso ? new Date(`${dateIso}T00:00:00`) : null;
      const dayIdx = d && !Number.isNaN(d.getTime()) ? d.getDay() : null;
      const dow = dayIdx === null ? "" : weekdayName(dayIdx, lang);

      legs.push({
        idx,
        label: labelForLeg(idx, so.length, lang),
        origin,
        destination,
        dateIso,
        dow,
        dayIdx,
        depTime: extractTimeFromJourneyKey(journeyKey),
        arrTime: "",
        flightNo: extractFlightNoFromJourneyKey(journeyKey),
        airFare: null,
      });
    });
  }

  return legs;
}

/* ================= component ================= */
export default function FlightSummaryPanel({
  lang = "en",
  t,
  holdResponse,
  rawDetail,
  selectedOffers,
}) {
  const currency = getRootFromAny(rawDetail)?.currency || holdResponse?.currency || "THB";

  const fmtMoney = (n) =>
    `${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;

  const legs = useMemo(
    () => buildLegs({ holdResponse, rawDetail, selectedOffers, lang }),
    [holdResponse, rawDetail, selectedOffers, lang]
  );

  const title = t?.flightSummary || (lang === "th" ? "สรุปเที่ยวบิน" : "Flight summary");

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-extrabold text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">
          {legs.length ? `${legs.length} ${lang === "th" ? "ขา" : "legs"}` : ""}
        </div>
      </div>

      {!legs.length ? (
        <div className="mt-3 text-sm text-slate-500">
          {lang === "th" ? "ยังไม่มีข้อมูลเที่ยวบิน" : "No flight details available yet."}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {legs.map((L) => (
            <div key={L.idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              {/* top line: label + route + day pill + date (LEFT aligned for mobile) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-extrabold text-slate-800">{L.label}</div>

                <div className="text-sm font-bold text-slate-800">
                  {safeUpper(L.origin) || "---"} → {safeUpper(L.destination) || "---"}
                </div>

                {L.dow ? (
                  <span
                    className={
                      "inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-extrabold " +
                      dayPillClass(L.dayIdx)
                    }
                  >
                    {L.dow}
                  </span>
                ) : null}

                {L.dateIso ? (
                  <span className="text-xs font-semibold text-slate-600">
                    {formatDate(L.dateIso, lang)}
                  </span>
                ) : null}
              </div>

              {/* details row: keep compact on mobile */}
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                {/* Departure & Arrival same line */}
                <div>
                  <div className="text-xs text-slate-500">{lang === "th" ? "เวลา" : "Time"}</div>
                  <div className="font-bold text-slate-800">
                    {(L.depTime || "--:--") + (L.arrTime ? ` → ${L.arrTime}` : "")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">{lang === "th" ? "เที่ยวบิน" : "Flight"}</div>
                  <div className="font-bold text-slate-800">{L.flightNo || "-"}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">{lang === "th" ? "ค่าโดยสาร" : "Air fare"}</div>
                  <div className="font-bold text-slate-800">
                    {typeof L.airFare === "number" ? fmtMoney(L.airFare) : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
