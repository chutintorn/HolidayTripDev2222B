import React from "react";

/* ===== helpers ===== */
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

function labelForLeg(idx, total, lang) {
  if (total >= 2) {
    if (idx === 0) return lang === "th" ? "ขาไป" : "Depart";
    return lang === "th" ? "ขากลับ" : "Return";
  }
  return lang === "th" ? "ขาไป" : "Depart";
}

/**
 * Build legs from:
 * 1) holdResponse.airlines (best)
 * 2) selectedOffers fallback
 */
function buildFlightLegs({ holdResponse, selectedOffers, lang }) {
  const legs = [];
  const so = Array.isArray(selectedOffers) ? selectedOffers : [];
  const airArr = Array.isArray(holdResponse?.airlines) ? holdResponse.airlines : [];

  if (airArr.length) {
    airArr.forEach((a, idx) => {
      const origin = a?.origin || a?.from || a?.departureAirport || "";
      const destination = a?.destination || a?.to || a?.arrivalAirport || "";

      const depDT = a?.departureDateTime || a?.departureTime || a?.departTime || a?.departure || "";
      const arrDT = a?.arrivalDateTime || a?.arrivalTime || a?.arriveTime || a?.arrival || "";

      const flightNo =
        a?.flightNumber ||
        a?.flightNo ||
        a?.flight ||
        a?.travelInfos?.[0]?.flightNumber ||
        a?.travelInfos?.[0]?.flightNo ||
        "";

      const journeyKey = so?.[idx]?.journeyKey || a?.journeyKey || "";
      const iso =
        (typeof depDT === "string" && depDT.slice(0, 10).includes("-") ? depDT.slice(0, 10) : "") ||
        extractIsoFromJourneyKey(journeyKey);

      const d = iso ? new Date(`${iso}T00:00:00`) : null;
      const dow = d && !Number.isNaN(d.getTime()) ? weekdayName(d.getDay(), lang) : "";

      legs.push({
        idx,
        label: labelForLeg(idx, airArr.length, lang),
        origin,
        destination,
        iso,
        dow,
        depTime: formatTime(depDT),
        arrTime: formatTime(arrDT),
        flightNo,
      });
    });
    return legs;
  }

  // fallback by selectedOffers only
  if (so.length) {
    so.forEach((o, idx) => {
      const journeyKey = o?.journeyKey || "";
      const iso = extractIsoFromJourneyKey(journeyKey);
      const d = iso ? new Date(`${iso}T00:00:00`) : null;
      const dow = d && !Number.isNaN(d.getTime()) ? weekdayName(d.getDay(), lang) : "";

      legs.push({
        idx,
        label: labelForLeg(idx, so.length, lang),
        origin: o?.origin || o?.from || "",
        destination: o?.destination || o?.to || "",
        iso,
        dow,
        depTime: "",
        arrTime: "",
        flightNo: "",
      });
    });
  }

  return legs;
}

function dayPillClass(dow, lang) {
  const en = String(dow || "");
  const th = String(dow || "");
  const key = lang === "th" ? th : en;
  // color highlight for Tue/Wed (ตามที่คุณขอ) และใส่นิ่มๆ
  if (key === "Tue" || key === "อ.") return "bg-pink-100 text-pink-800 border-pink-200";
  if (key === "Wed" || key === "พ.") return "bg-green-100 text-green-800 border-green-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function FlightSummaryPanel({ lang = "en", t, holdResponse, selectedOffers }) {
  const legs = React.useMemo(
    () => buildFlightLegs({ holdResponse, selectedOffers, lang }),
    [holdResponse, selectedOffers, lang]
  );

  if (!legs.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold text-slate-800">
          {t?.flightSummary || (lang === "th" ? "สรุปเที่ยวบิน" : "Flight summary")}
        </div>
        <div className="text-xs text-slate-500">
          {legs.length >= 2 ? "2 legs" : "1 leg"}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {legs.map((L) => (
          <div key={L.idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            {/* header row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold text-slate-800">{L.label}</div>

              {/* Route + day-of-week + date (same line on mobile) */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <div className="font-bold text-slate-800">
                  {safeUpper(L.origin) || "---"} → {safeUpper(L.destination) || "---"}
                </div>

                {L.dow ? (
                  <span
                    className={
                      "px-2 py-0.5 rounded-full border text-[11px] font-bold " +
                      dayPillClass(L.dow, lang)
                    }
                  >
                    {L.dow}
                  </span>
                ) : null}

                {L.iso ? (
                  <span className="text-xs font-semibold text-slate-600">
                    {formatDate(L.iso, lang)}
                  </span>
                ) : null}
              </div>
            </div>

            {/* times + flight number */}
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              {/* Departure + Arrival same line */}
              <div className="flex items-center justify-between sm:block">
                <div className="text-xs text-slate-500">{t?.departure || (lang === "th" ? "เวลาออก" : "Departure")}</div>
                <div className="font-bold text-slate-800">
                  {L.depTime || "--:--"}
                  <span className="mx-2 text-slate-300">→</span>
                  {L.arrTime || "--:--"}
                </div>
              </div>

              <div className="flex items-center justify-between sm:block">
                <div className="text-xs text-slate-500">{t?.flight || (lang === "th" ? "เที่ยวบิน" : "Flight")}</div>
                <div className="font-bold text-slate-800">{L.flightNo || "-"}</div>
              </div>

              {/* reserved slot: you can later add Air fare per leg */}
              <div className="hidden sm:block">
                <div className="text-xs text-slate-500">{t?.airFare || (lang === "th" ? "ค่าโดยสาร" : "Air fare")}</div>
                <div className="font-bold text-slate-800">—</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
