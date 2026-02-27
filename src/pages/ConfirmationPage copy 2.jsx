// src/pages/ConfirmationPage.jsx
import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import QRCode from "react-qr-code";

// ✅ Logo from assets (adjust filename if needed)
import NokAirLogo from "../assets/NokAirLogo.png";

/* ========================= helpers ========================= */
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

function safeUpper(x) {
  return (x || "").toString().toUpperCase();
}

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

function isBgSb(code) {
  const s = norm(code);
  return /^BG\d{2}$/.test(s) || /^SB\d{2}$/.test(s);
}

/* ========================= Meal/Drink SSR helpers ========================= */
function isMealSsr(code) {
  const s = norm(code);
  return /^(MH|MS)\d{2}$/.test(s);
}
function isBevSsr(code) {
  const s = norm(code);
  return /^BEV\d+$/.test(s);
}

/* ========================= PBOD helpers ========================= */
function isPBOD(code) {
  return norm(code) === "PBOD";
}

/* ========================= Friendly fallback names ========================= */
function baggageFallbackName(code, lang) {
  const s = norm(code);
  if (/^BG\d{2}$/.test(s)) {
    const kg = s.slice(2);
    return lang === "th" ? `กระเป๋า ${kg} กก.` : `Bag ${kg}kg`;
  }
  if (/^SB\d{2}$/.test(s)) {
    const kg = s.slice(2);
    return lang === "th" ? `กระเป๋าพิเศษ ${kg} กก.` : `Special bag ${kg}kg`;
  }
  return "";
}

function getReservationCode(holdResponse, fallbackBookingRef) {
  const r = holdResponse || {};
  return (
    r.confirmationNumber ||
    r.bookingNumber ||
    r.bookingRef ||
    r.reservationCode ||
    r.pnr ||
    r.recordLocator ||
    fallbackBookingRef ||
    "-"
  );
}

function getTimeLimit(holdResponse, fallback) {
  const r = holdResponse || {};
  return (
    r.holdTimeExpiredDate ||
    r.timeLimit ||
    r.paymentTimeLimit ||
    r.expiry ||
    r.expiration ||
    r?.data?.holdTimeExpiredDate ||
    r?.data?.timeLimit ||
    r?.data?.paymentTimeLimit ||
    fallback ||
    ""
  );
}

function labelForLeg(idx, total, lang) {
  if (total >= 2) {
    if (idx === 0) return lang === "th" ? "ขาไป" : "Depart";
    return lang === "th" ? "ขากลับ" : "Return";
  }
  return lang === "th" ? "ขาไป" : "Depart";
}

/* ========================= Seat read (API-first) ========================= */
function getPassengerDetailsArrayByLeg(holdResponse, legIndex = 0) {
  const airlines = Array.isArray(holdResponse?.airlines) ? holdResponse.airlines : [];
  const leg = airlines?.[legIndex];
  return Array.isArray(leg?.passengerDetails) ? leg.passengerDetails : [];
}

function findPaxInApiByLeg(holdResponse, paxId, legIndex = 0) {
  const arr = getPassengerDetailsArrayByLeg(holdResponse, legIndex);
  if (!arr.length) return null;

  const pid = String(paxId);
  return (
    arr.find((x) => String(x?.paxNumber) === pid) ||
    arr.find((x) => String(x?.paxNo) === pid) ||
    arr.find((x) => String(x?.passengerNumber) === pid) ||
    arr.find((x) => String(x?.travelerNumber) === pid) ||
    null
  );
}

function getSeatFromApi(holdResponse, paxId, legIndex = 0) {
  const p = findPaxInApiByLeg(holdResponse, paxId, legIndex);
  if (!p) return "";

  const raw = p?.seatSelect ?? p?.selectedSeat ?? p?.seat ?? p?.seatNumber ?? p?.seatNo ?? "";

  if (typeof raw === "string") return raw || "";

  if (Array.isArray(raw)) {
    const v = raw?.[0];
    if (typeof v === "string") return v || "";
    if (v && typeof v === "object") {
      if (v.seatCode) return String(v.seatCode);
      if (v.seat) return String(v.seat);
      if (v.seatNumber) return String(v.seatNumber);
      if (v.rowNumber && v.column) return `${v.rowNumber}${v.column}`;
    }
    return "";
  }

  if (raw && typeof raw === "object") {
    const s = raw.seatCode || raw.seat || raw.seatNumber;
    return s ? String(s) : "";
  }

  return "";
}

function getSeatFromRedux(allSaved, paxId, journeyKey) {
  if (!allSaved || !paxId || !journeyKey) return "";
  const byPax = allSaved?.[String(paxId)];
  const s = byPax?.[String(journeyKey)];
  return s?.seatCode || "";
}

/* ========================= taxName map builder from taxesAndFees ========================= */
function buildSsrNameMapFromTaxes(taxesAndFees) {
  const list = Array.isArray(taxesAndFees) ? taxesAndFees : [];
  const map = {};
  for (const x of list) {
    if (!x?.isSSR) continue;
    const code = norm(x?.taxCode);
    const name = String(x?.taxName || "").trim();
    if (!code) continue;
    if (!map[code] && name) map[code] = name;
  }
  return map;
}

/* ========================= Baggage read (Redux + API) ========================= */
function getBaggageFromReduxCodes(allSavedBaggage, paxId, journeyKey) {
  if (!allSavedBaggage || !paxId || !journeyKey) return { bg: "", sb: "" };
  const byPax = allSavedBaggage?.[String(paxId)];
  const leg = byPax?.[String(journeyKey)];
  if (!leg) return { bg: "", sb: "" };
  const bg = leg?.bg?.ssrCode ? norm(leg.bg.ssrCode) : "";
  const sb = leg?.sb?.ssrCode ? norm(leg.sb.ssrCode) : "";
  return { bg, sb };
}

function extractBgSbCodesFromTaxes(taxesAndFees) {
  const list = Array.isArray(taxesAndFees) ? taxesAndFees : [];
  const codes = list
    .filter((x) => x?.isSSR)
    .map((x) => norm(x?.taxCode))
    .filter((c) => isBgSb(c));

  const seen = new Set();
  const out = [];
  for (const c of codes) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function getBaggageFromApiCodesAndNameMap(holdResponse, paxId, legIndex = 0) {
  const p = findPaxInApiByLeg(holdResponse, paxId, legIndex);
  if (!p) return { codes: [], nameMap: {} };
  const taxes = p?.pricingDetails?.taxesAndFees;
  return {
    codes: extractBgSbCodesFromTaxes(taxes),
    nameMap: buildSsrNameMapFromTaxes(taxes),
  };
}

function formatBaggageDisplay(codes, nameMap, lang) {
  if (!codes || !codes.length) return "-";

  const items = codes.map((c) => {
    const code = norm(c);
    const taxName = nameMap && nameMap[code] ? String(nameMap[code]) : "";
    const fallback = baggageFallbackName(code, lang);
    const label = taxName || fallback || "";
    return label ? `${code} ${label}` : code;
  });

  return items.join("  +  ");
}

/* ========================= Meal/Drink read (Redux + API) ========================= */
function getMealDrinkFromReduxCodes(allSavedMeal, paxId, journeyKey) {
  if (!allSavedMeal || !paxId || !journeyKey) return [];
  const byPax = allSavedMeal?.[String(paxId)];
  const leg = byPax?.[String(journeyKey)];
  if (!leg) return [];

  const out = [];
  const meal = leg?.meal?.ssrCode ? norm(leg.meal.ssrCode) : "";
  const bev = leg?.bev?.ssrCode ? norm(leg.bev.ssrCode) : "";
  if (meal) out.push(meal);
  if (bev) out.push(bev);

  const seen = new Set();
  return out.filter((c) => {
    if (!c) return false;
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}

function extractMealDrinkCodesFromTaxes(taxesAndFees) {
  const list = Array.isArray(taxesAndFees) ? taxesAndFees : [];
  const codes = list
    .filter((x) => x?.isSSR)
    .map((x) => norm(x?.taxCode))
    .filter((c) => isMealSsr(c) || isBevSsr(c));

  const seen = new Set();
  const out = [];
  for (const c of codes) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function getMealDrinkFromApiCodesAndNameMap(holdResponse, paxId, legIndex = 0) {
  const p = findPaxInApiByLeg(holdResponse, paxId, legIndex);
  if (!p) return { codes: [], nameMap: {} };
  const taxes = p?.pricingDetails?.taxesAndFees;
  return {
    codes: extractMealDrinkCodesFromTaxes(taxes),
    nameMap: buildSsrNameMapFromTaxes(taxes),
  };
}

function formatMealDrinkDisplay(codes, nameMap, lang) {
  const mealCodes = (codes || []).filter((c) => isMealSsr(c));
  const bevCodes = (codes || []).filter((c) => isBevSsr(c));

  const mealPart = mealCodes.length
    ? mealCodes
        .map((c) => {
          const code = norm(c);
          const name = nameMap && nameMap[code] ? String(nameMap[code]) : "";
          const fallback = name ? "" : lang === "th" ? "อาหาร" : "Meal";
          return name ? `${code} : ${name}` : `${code} : ${fallback}`;
        })
        .join("  +  ")
    : "-";

  const bevPart = bevCodes.length
    ? bevCodes
        .map((c) => {
          const code = norm(c);
          const name = nameMap && nameMap[code] ? String(nameMap[code]) : "";
          const fallback = name ? "" : lang === "th" ? "เครื่องดื่ม" : "Drink";
          return name ? `${code} : ${name}` : `${code} : ${fallback}`;
        })
        .join("  +  ")
    : "-";

  return { mealText: mealPart, bevText: bevPart };
}

/* ========================= PBOD read (Redux + API) ========================= */
function extractPBODFromTaxes(taxesAndFees) {
  const list = Array.isArray(taxesAndFees) ? taxesAndFees : [];
  return list.some((x) => x?.isSSR && isPBOD(x?.taxCode));
}

function getPBODFromApiSelected(holdResponse, paxId, legIndex = 0) {
  const p = findPaxInApiByLeg(holdResponse, paxId, legIndex);
  if (!p) return false;
  const taxes = p?.pricingDetails?.taxesAndFees;
  return extractPBODFromTaxes(taxes);
}

function getPBODFromReduxSelected(allSavedPB, paxId, journeyKey) {
  if (!allSavedPB || !paxId || !journeyKey) return false;
  const byPax = allSavedPB?.[String(paxId)];
  const leg = byPax?.[String(journeyKey)];
  const pbod = leg?.pbod;
  return !!(pbod && isPBOD(pbod?.ssrCode));
}

/* ========================= legs builder ========================= */
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
      const dateIso =
        (typeof depDT === "string" && depDT.slice(0, 10).includes("-") ? depDT.slice(0, 10) : "") ||
        extractIsoFromJourneyKey(journeyKey);

      const d = dateIso ? new Date(`${dateIso}T00:00:00`) : null;
      const dow = d && !Number.isNaN(d.getTime()) ? weekdayName(d.getDay(), lang) : "";

      legs.push({
        legIndex: idx,
        label: labelForLeg(idx, airArr.length, lang),
        journeyKey,
        origin,
        destination,
        dateIso,
        dow,
        depTime: formatTime(depDT),
        arrTime: formatTime(arrDT),
        flightNo,
      });
    });
    return legs;
  }

  if (so.length) {
    so.forEach((o, idx) => {
      const journeyKey = o?.journeyKey || "";
      const dateIso = extractIsoFromJourneyKey(journeyKey);
      const d = dateIso ? new Date(`${dateIso}T00:00:00`) : null;
      const dow = d && !Number.isNaN(d.getTime()) ? weekdayName(d.getDay(), lang) : "";

      legs.push({
        legIndex: idx,
        label: labelForLeg(idx, so.length, lang),
        journeyKey,
        origin: o?.origin || o?.from || "",
        destination: o?.destination || o?.to || "",
        dateIso,
        dow,
        depTime: "",
        arrTime: "",
        flightNo: "",
      });
    });
  }

  return legs;
}

/* ========================= page ========================= */
export default function ConfirmationPage() {
  const { state } = useLocation() || {};

  const allSavedSeats = useSelector((s) => s?.seatSelection?.saved || {});

  const allSavedBaggage = useSelector((s) => {
    return (
      s?.baggageSelection?.saved ||
      s?.baggageSelectionSlice?.saved ||
      s?.baggage?.saved ||
      s?.baggageSelections?.saved ||
      {}
    );
  });

  const allSavedMeal = useSelector((s) => {
    return (
      s?.mealSelection?.saved ||
      s?.mealSelectionSlice?.saved ||
      s?.meals?.saved ||
      s?.mealSelections?.saved ||
      {}
    );
  });

  const allSavedPB = useSelector((s) => {
    return (
      s?.priorityBoardingSelection?.saved ||
      s?.priorityBoardingSelectionSlice?.saved ||
      s?.priorityBoarding?.saved ||
      s?.pbodSelection?.saved ||
      {}
    );
  });

  const initialLang = state?.lang === "th" ? "th" : "en";
  const [lang, setLang] = useState(initialLang);

  const ok = !!state?.ok;
  const holdResponse = state?.holdResponse || null;

  const passengerInfos = Array.isArray(state?.passengerInfos) ? state.passengerInfos : [];
  const selectedOffers = Array.isArray(state?.selectedOffers) ? state.selectedOffers : [];

  const priceSummary = state?.priceSummary || {};
  const currency = priceSummary?.currency || holdResponse?.currency || "THB";

  const tripTotal = Number(priceSummary?.tripTotal ?? priceSummary?.total ?? 0) || 0;
  const airTotal = Number(priceSummary?.airTotal ?? 0) || 0;
  const seatTotal = Number(priceSummary?.seatTotal ?? priceSummary?.addonsTotal ?? 0) || 0;

  const baseTotal = Number(priceSummary?.baseTotal ?? 0) || 0;
  const taxTotalExVat = Number(priceSummary?.taxTotalExVat ?? 0) || 0;
  const vatTotal = Number(priceSummary?.vatTotal ?? 0) || 0;

  const seatByLeg = Array.isArray(priceSummary?.seatByLeg) ? priceSummary.seatByLeg : [];
  const seatByPaxByLeg = Array.isArray(priceSummary?.seatByPaxByLeg) ? priceSummary.seatByPaxByLeg : [];

  const reservationCode = useMemo(
    () => getReservationCode(holdResponse, state?.bookingRef),
    [holdResponse, state?.bookingRef]
  );

  const timeLimit = useMemo(
    () => getTimeLimit(holdResponse, state?.timeLimit),
    [holdResponse, state?.timeLimit]
  );

  const legs = useMemo(
    () => buildFlightLegs({ holdResponse, selectedOffers, lang }),
    [holdResponse, selectedOffers, lang]
  );

  const fmt = (n, ccy = currency) =>
    `${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${ccy}`;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
    } catch {}
  };

  const [payMethod, setPayMethod] = useState("counter");
  const qrAmountOnly = useMemo(() => String(Number(tripTotal || 0).toFixed(2)), [tripTotal]);

  const [showFareDetails, setShowFareDetails] = useState(false);

  const t = useMemo(
    () => ({
      title: lang === "th" ? "ยืนยันการจอง" : "Confirmation",

      thanks: lang === "th" ? "ขอบคุณ" : "Thank you",
      passengers: lang === "th" ? "ผู้โดยสาร" : "Passengers",
      depart: lang === "th" ? "ขาไป" : "Depart",
      ret: lang === "th" ? "ขากลับ" : "Return",
      confirmed: lang === "th" ? "ยืนยันแล้ว" : "Confirmed",
      noPassengers: lang === "th" ? "ยังไม่มีรายชื่อผู้โดยสาร" : "No passenger list provided.",
      back: lang === "th" ? "กลับ" : "Back",
      reservation: lang === "th" ? "รหัสการจอง" : "Reservation code",
      total: lang === "th" ? "ยอดรวม" : "Total",
      timeLimit: lang === "th" ? "ชำระเงินภายใน" : "Pay by",
      payment: lang === "th" ? "ชำระเงิน" : "Payment",
      choosePayment: lang === "th" ? "เลือกวิธีชำระเงิน" : "Choose payment method",
      counter: lang === "th" ? "เคาน์เตอร์ / QR (เดโม)" : "Counter / QR (demo)",
      card: lang === "th" ? "บัตรเครดิต (เดโม)" : "Card payment (demo)",
      amountToPay: lang === "th" ? "ยอดชำระ" : "Amount to pay",
      demoDisabled: lang === "th" ? "เดโม: Pay now ยังไม่ทำงาน" : "Demo: Pay now is disabled.",
      qrTitle: lang === "th" ? "QR ชำระเงิน (เดโม)" : "Payment QR (demo)",
      qrAmount: lang === "th" ? "จำนวนเงินใน QR" : "Amount in QR",
      noteQr:
        lang === "th"
          ? "หมายเหตุ: แอปธนาคารจะไม่เปิดจ่ายเงินจริง เพราะยังไม่ใช่ Thai QR มาตรฐาน"
          : "Note: Bank apps won’t open real payment unless Thai QR standard is used.",
      copy: lang === "th" ? "คัดลอก" : "Copy",
      holdOk: lang === "th" ? "Hold booking สำเร็จ" : "Hold booking successful",
      holdFail: lang === "th" ? "Hold booking ไม่สำเร็จ" : "Hold booking failed",

      seatTitle: lang === "th" ? "ที่นั่ง" : "Seat",
      baggageTitle: lang === "th" ? "สัมภาระ" : "Baggage",
      mealTitle: lang === "th" ? "อาหาร" : "Meal",
      drinkTitle: lang === "th" ? "เครื่องดื่ม" : "Drink",
      pbodTitle: lang === "th" ? "Priority Boarding" : "Priority Boarding",
      yes: lang === "th" ? "ใช่" : "Yes",
      notSelected: lang === "th" ? "ไม่ได้เลือก" : "Not selected",

      fareSummary: lang === "th" ? "สรุปราคา" : "Fare summary",
      tripTotal: lang === "th" ? "ยอดรวมทั้งทริป" : "Trip total",
      airFare: lang === "th" ? "ค่าโดยสาร" : "Air fare",
      addons: lang === "th" ? "ส่วนเพิ่ม" : "Add-ons",
      details: lang === "th" ? "รายละเอียด" : "Details",
      hide: lang === "th" ? "ซ่อน" : "Hide",
      baseFare: lang === "th" ? "ค่าโดยสารพื้นฐาน" : "Base fare",
      taxes: lang === "th" ? "ภาษี/ค่าธรรมเนียม" : "Taxes, fees & surcharges",
      vat: "VAT",
      seatsPerPassenger: lang === "th" ? "ที่นั่งต่อผู้โดยสาร" : "Seats per passenger",
      none: lang === "th" ? "ไม่มี" : "None",

      tripSummary: lang === "th" ? "สรุปทริป" : "Trip summary",
      flightNo: lang === "th" ? "เที่ยวบิน" : "Flight",
      services: lang === "th" ? "รายละเอียดการซื้อ" : "Purchased services",
      viewServices: lang === "th" ? "ดูรายละเอียด" : "View details",
      hideServices: lang === "th" ? "ซ่อนรายละเอียด" : "Hide details",
    }),
    [lang]
  );

  const genderLabel = (g) => {
    const s = String(g || "").toLowerCase();
    if (!s) return "";
    if (lang === "th") {
      if (s === "male" || s === "m") return "ชาย";
      if (s === "female" || s === "f") return "หญิง";
      return String(g);
    }
    if (s === "m") return "Male";
    if (s === "f") return "Female";
    if (s === "male") return "Male";
    if (s === "female") return "Female";
    return String(g);
  };

  const greetingName = useMemo(() => {
    const p0 = passengerInfos?.[0] || {};
    const full = `${safeUpper(p0?.title)} ${p0?.firstName || ""} ${p0?.lastName || ""}`.trim();
    return full || "Customer";
  }, [passengerInfos]);

  /* ========================= Small UI blocks ========================= */
  function InfoBox({ title, children }) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="text-[12px] font-extrabold tracking-wide text-slate-700 uppercase">{title}</div>
        <div className="mt-2">{children}</div>
      </div>
    );
  }

  function LegChip({ text }) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 font-bold text-xs">
        {text}
      </span>
    );
  }

  /* ========================= Seat UI ========================= */
  function SeatBox({ paxId }) {
    const hasLegs = legs.length > 0;

    const items = hasLegs
      ? legs.map((L, idx) => {
          const fromApi = getSeatFromApi(holdResponse, paxId, L.legIndex);
          const fromRedux = getSeatFromRedux(allSavedSeats, paxId, L.journeyKey);
          return {
            idx,
            label: idx === 0 ? t.depart : t.ret,
            seat: fromApi || fromRedux || "-",
          };
        })
      : [
          {
            idx: 0,
            label: t.depart,
            seat:
              getSeatFromApi(holdResponse, paxId, 0) ||
              (() => {
                const byPax = allSavedSeats?.[String(paxId)];
                const anySeat = byPax ? Object.values(byPax)[0]?.seatCode : "";
                return anySeat || "-";
              })(),
          },
        ];

    return (
      <InfoBox title={t.seatTitle}>
        <div className="space-y-2 text-sm text-slate-800">
          {items.map((it) => (
            <div key={it.idx} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LegChip text={it.label} />
                <span className="text-slate-600">{it.label}:</span>
              </div>
              <div className="text-lg font-extrabold text-slate-900 leading-none">{it.seat}</div>
            </div>
          ))}
        </div>
      </InfoBox>
    );
  }

  /* ========================= Baggage UI (BG/SB) ========================= */
  function BaggageBox({ paxId }) {
    const hasLegs = legs.length > 0;

    const items = hasLegs
      ? legs.map((L, idx) => {
          const api = getBaggageFromApiCodesAndNameMap(holdResponse, paxId, L.legIndex);
          const reduxCodes = getBaggageFromReduxCodes(allSavedBaggage, paxId, L.journeyKey);

          const codes =
            api.codes && api.codes.length ? api.codes : [reduxCodes.bg, reduxCodes.sb].map(norm).filter(Boolean);

          const text = codes.length ? formatBaggageDisplay(codes, api.nameMap || {}, lang) : "-";

          return { idx, label: idx === 0 ? t.depart : t.ret, text };
        })
      : [
          {
            idx: 0,
            label: t.depart,
            text: (() => {
              const api = getBaggageFromApiCodesAndNameMap(holdResponse, paxId, 0);
              return api.codes.length ? formatBaggageDisplay(api.codes, api.nameMap || {}, lang) : "-";
            })(),
          },
        ];

    return (
      <InfoBox title={t.baggageTitle}>
        <div className="space-y-2 text-sm text-slate-800">
          {items.map((it) => (
            <div key={it.idx} className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 pt-0.5">
                <LegChip text={it.label} />
                <span className="text-slate-600">{it.label}:</span>
              </div>
              <div className="text-[12px] font-semibold text-slate-900 leading-snug text-right">
                {it.text}
              </div>
            </div>
          ))}
        </div>
      </InfoBox>
    );
  }

  /* ========================= Meal + Drink UI ========================= */
  function MealDrinkBox({ paxId }) {
    const hasLegs = legs.length > 0;

    const items = hasLegs
      ? legs.map((L, idx) => {
          const api = getMealDrinkFromApiCodesAndNameMap(holdResponse, paxId, L.legIndex);
          const reduxCodes = getMealDrinkFromReduxCodes(allSavedMeal, paxId, L.journeyKey);

          const codes = api.codes && api.codes.length ? api.codes : reduxCodes;
          const clean = (codes || []).map(norm).filter(Boolean);

          const seen = new Set();
          const unique = clean.filter((c) => {
            if (seen.has(c)) return false;
            seen.add(c);
            return true;
          });

          const { mealText, bevText } = formatMealDrinkDisplay(unique, api.nameMap || {}, lang);

          return { idx, label: idx === 0 ? t.depart : t.ret, mealText, bevText };
        })
      : [
          {
            idx: 0,
            label: t.depart,
            mealText: (() => {
              const api = getMealDrinkFromApiCodesAndNameMap(holdResponse, paxId, 0);
              const { mealText } = formatMealDrinkDisplay(api.codes, api.nameMap || {}, lang);
              return mealText;
            })(),
            bevText: (() => {
              const api = getMealDrinkFromApiCodesAndNameMap(holdResponse, paxId, 0);
              const { bevText } = formatMealDrinkDisplay(api.codes, api.nameMap || {}, lang);
              return bevText;
            })(),
          },
        ];

    return (
      <InfoBox title={`${t.mealTitle} / ${t.drinkTitle}`}>
        <div className="space-y-3 text-sm text-slate-800">
          {items.map((it) => (
            <div key={it.idx} className="space-y-1">
              <div className="flex items-center gap-2">
                <LegChip text={it.label} />
                <span className="text-slate-600">{it.label}</span>
              </div>
              <div className="text-[12px] leading-snug">
                <span className="text-slate-500 font-semibold">{t.mealTitle}:</span>{" "}
                <span className="font-semibold text-slate-900">{it.mealText || "-"}</span>
              </div>
              <div className="text-[12px] leading-snug">
                <span className="text-slate-500 font-semibold">{t.drinkTitle}:</span>{" "}
                <span className="font-semibold text-slate-900">{it.bevText || "-"}</span>
              </div>
            </div>
          ))}
        </div>
      </InfoBox>
    );
  }

  /* ========================= Priority Boarding UI ========================= */
  function PriorityBoardingBox({ paxId }) {
    const hasLegs = legs.length > 0;

    const items = hasLegs
      ? legs.map((L, idx) => {
          const apiSelected = getPBODFromApiSelected(holdResponse, paxId, L.legIndex);
          const reduxSelected = getPBODFromReduxSelected(allSavedPB, paxId, L.journeyKey);
          const selected = !!(apiSelected || reduxSelected);

          return { idx, label: idx === 0 ? t.depart : t.ret, selected };
        })
      : [{ idx: 0, label: t.depart, selected: getPBODFromApiSelected(holdResponse, paxId, 0) || false }];

    return (
      <InfoBox title={t.pbodTitle}>
        <div className="space-y-2 text-sm text-slate-800">
          {items.map((it) => (
            <div key={it.idx} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LegChip text={it.label} />
                <span className="text-slate-600">{it.label}:</span>
              </div>
              {it.selected ? (
                <span className="text-[12px] font-extrabold text-emerald-700">{t.yes}</span>
              ) : (
                <span className="text-[12px] font-semibold text-slate-400">{t.notSelected}</span>
              )}
            </div>
          ))}
        </div>
      </InfoBox>
    );
  }

  /* ========================= Trip summary card ========================= */
  function TripSummaryCard() {
    if (!legs.length) return null;

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="font-extrabold text-slate-800">{t.tripSummary}</div>

        <div className="mt-3 space-y-2">
          {legs.map((L, idx) => {
            const dateText = formatDate(L.dateIso, lang);
            return (
              <div
                key={`${L.journeyKey || idx}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-extrabold text-slate-900">{idx === 0 ? t.depart : t.ret}</div>
                      <div className="text-sm font-extrabold text-slate-800">
                        {safeUpper(L.origin) || "---"} → {safeUpper(L.destination) || "---"}
                      </div>
                      {L.depTime ? (
                        <div className="ml-1 text-sm font-extrabold text-sky-700">{L.depTime}</div>
                      ) : null}
                    </div>

                    <div className="mt-1 flex items-center gap-2 flex-wrap text-sm">
                      {L.flightNo ? (
                        <span className="font-extrabold text-slate-900">{L.flightNo}</span>
                      ) : null}
                      {L.dow ? <LegChip text={L.dow} /> : null}
                      {dateText ? <span className="font-semibold text-slate-700">{dateText}</span> : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-bold text-slate-500">
                      {lang === "th" ? "ออก/ถึง" : "Dep/Arr"}
                    </div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {L.depTime || "--:--"}{" "}
                      <span className="text-slate-400 font-bold">,</span>{" "}
                      {L.arrTime || "--:--"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ========================= Fare summary (with Details/Hide) ========================= */
  function FareSummaryCard() {
    const legsCount = legs.length || seatByLeg.length || (selectedOffers?.length || 0);

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="font-extrabold text-slate-800">{t.fareSummary}</div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-bold text-slate-500">{t.tripTotal}</div>

          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="text-sm font-extrabold text-slate-900">
              {t.total}
              {legsCount ? (
                <span className="ml-2 text-[11px] text-slate-500">
                  • {legsCount} leg{legsCount > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            <div className="text-lg sm:text-xl font-extrabold text-sky-700 text-right leading-tight">
              {fmt(tripTotal)}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="text-[11px] font-bold text-slate-600">{t.airFare}</div>
              <div className="text-sm font-extrabold text-slate-900">{fmt(airTotal)}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="text-[11px] font-bold text-slate-600">{t.addons}</div>
              <div className="text-sm font-extrabold text-slate-900">{fmt(seatTotal)}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 flex justify-end">
          <button
            type="button"
            onClick={() => setShowFareDetails((v) => !v)}
            className={[
              "px-3 py-1.5 rounded-lg border text-sm font-extrabold bg-white",
              showFareDetails
                ? "border-slate-300 text-slate-700 hover:border-slate-400"
                : "border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-700",
            ].join(" ")}
          >
            {showFareDetails ? t.hide : t.details}
          </button>
        </div>

        {!showFareDetails ? null : (
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                <div className="text-slate-600">{t.baseFare}</div>
                <div className="font-semibold">{fmt(baseTotal)}</div>

                <div className="text-slate-600">{t.taxes}</div>
                <div className="font-semibold">{fmt(taxTotalExVat)}</div>

                <div className="text-slate-600">{t.vat}</div>
                <div className="font-semibold">{fmt(vatTotal)}</div>

                <div className="text-slate-600">{t.addons}</div>
                <div className="font-semibold">{fmt(seatTotal)}</div>
              </div>
            </div>

            {seatByLeg.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-slate-900">
                    {t.addons}
                    <span className="ml-2 text-[11px] text-slate-500">
                      • {seatByLeg.length} leg{seatByLeg.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">{fmt(seatTotal)}</div>
                </div>

                <div className="mt-2 space-y-2">
                  {seatByLeg.map((lg, idx) => {
                    const legLabel = seatByLeg.length >= 2 ? (idx === 0 ? t.depart : t.ret) : t.depart;

                    const paxLeg = seatByPaxByLeg.find((x) => String(x?.journeyKey) === String(lg?.journeyKey));
                    const paxItems = Array.isArray(paxLeg?.items) ? paxLeg.items : [];

                    return (
                      <div
                        key={`${String(lg?.fareKey || "")}-${String(lg?.journeyKey || "")}-${idx}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-extrabold text-slate-800">
                            {legLabel}
                            <span className="ml-2 text-[11px] text-slate-500">
                              ({Number(lg?.paxCount || 0) || 0} pax)
                            </span>
                          </div>
                          <div className="text-[11px] font-extrabold text-slate-900">
                            {fmt(Number(lg?.total || 0) || 0, lg?.currency || currency)}
                          </div>
                        </div>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-extrabold text-sky-700">
                            {t.seatsPerPassenger}
                          </summary>

                          <div className="mt-2 space-y-1">
                            {!paxItems.length ? (
                              <div className="text-[11px] text-slate-500">{t.none}</div>
                            ) : (
                              paxItems.map((x) => (
                                <div
                                  key={`${lg?.journeyKey}-${x?.paxId}-${x?.seatCode}`}
                                  className="flex items-center justify-between text-[11px]"
                                >
                                  <div className="text-slate-700">
                                    Pax {x?.paxId}: <span className="font-extrabold">{x?.seatCode || "-"}</span>
                                  </div>
                                  <div className="font-extrabold text-slate-900">
                                    {fmt(Number(x?.total || 0) || 0, x?.currency || currency)}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="font-sans bg-gray-50 min-h-screen">
      {/* Top header */}
      <div className="bg-sky-100 border-b border-sky-200">
        <div className="max-w-[1180px] mx-auto px-3 sm:px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={NokAirLogo}
              alt="Nok Air"
              className="h-10 w-10 rounded-full border border-slate-200 bg-white object-contain"
              draggable="false"
            />
            <div className="min-w-0 leading-tight">
              <div className="font-extrabold text-sky-600 text-xl whitespace-nowrap">Demo</div>
              <div className="font-bold text-sky-600 truncate">{t.title}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setLang("th")}
              className={
                "px-4 py-2 rounded-lg border text-sm font-extrabold " +
                (lang === "th" ? "bg-sky-600 border-sky-600 text-white" : "bg-white border-sky-400 text-sky-800")
              }
            >
              ไทย
            </button>
            <button
              onClick={() => setLang("en")}
              className={
                "px-4 py-2 rounded-lg border text-sm font-extrabold " +
                (lang === "en" ? "bg-sky-600 border-sky-600 text-white" : "bg-white border-sky-400 text-sky-800")
              }
            >
              English
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-3 sm:px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,60%)_minmax(0,40%)] gap-4">
          {/* LEFT */}
          <div className="space-y-4">
            {/* Top: Thank you + Reservation code */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="text-slate-900 font-extrabold text-lg">
                {t.thanks}, {greetingName}
              </div>

              <div className="mt-4">
                <div className="text-xs font-bold text-slate-600 tracking-wide uppercase">{t.reservation}</div>
                <div className="mt-1 font-mono font-extrabold text-slate-900 text-4xl tracking-tight break-all">
                  {reservationCode}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={
                    "px-3 py-1 rounded-full border font-extrabold text-sm " +
                    (ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700")
                  }
                >
                  {ok ? t.holdOk : t.holdFail}
                </span>

                {timeLimit ? (
                  <span className="px-3 py-1 rounded-full border border-sky-200 bg-sky-50 text-sky-800 font-bold text-sm">
                    {t.timeLimit}: {String(timeLimit)}
                  </span>
                ) : null}

                <button
                  onClick={() => copy(reservationCode)}
                  className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-sm font-extrabold hover:border-sky-400 hover:text-sky-800"
                >
                  {t.copy}
                </button>
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-3 gap-3">
                <div className="text-slate-700 font-bold">{t.total}</div>
                <div className="text-2xl font-extrabold text-slate-900 text-right">{fmt(tripTotal)}</div>
              </div>
            </div>

            {/* Trip summary (NEW) */}
            <TripSummaryCard />

            {/* Fare summary */}
            <FareSummaryCard />

            {/* Passengers - 1 per line + details collapsible */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="font-extrabold text-slate-800">{t.passengers}</div>

              {passengerInfos.length ? (
                <div className="mt-3 space-y-3">
                  {passengerInfos.map((p, i) => {
                    const paxId = p?.paxNumber ?? p?.paxNo ?? p?.pax ?? i + 1;
                    const fullName = `${safeUpper(p.title)} ${p.firstName || ""} ${p.lastName || ""}`.trim();
                    const g = genderLabel(p?.gender) || genderLabel(p?.sex) || genderLabel(p?.genderCode) || "";

                    return (
                      <div key={String(paxId)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">
                              {fullName || "-"}
                              <span className="ml-2 text-xs font-bold text-slate-500">#{paxId}</span>
                            </div>

                            <div className="text-sm text-slate-600 mt-1">
                              <span className="font-semibold text-slate-800">{p.passengerType || "-"}</span>
                              {g ? <span className="text-slate-400">{"  •  "}</span> : null}
                              {g ? <span className="font-semibold text-slate-800">{g}</span> : null}
                            </div>
                          </div>

                          <span className="px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-extrabold shrink-0">
                            {t.confirmed}
                          </span>
                        </div>

                        <details className="mt-3">
                          <summary className="cursor-pointer select-none text-sm font-extrabold text-sky-700">
                            {t.services} — {t.viewServices}
                          </summary>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <SeatBox paxId={paxId} />
                            <BaggageBox paxId={paxId} />
                            <MealDrinkBox paxId={paxId} />
                            <PriorityBoardingBox paxId={paxId} />
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-500">{t.noPassengers}</div>
              )}
            </div>

            {/* ✅ Removed: Flight summary section (as requested) */}
          </div>

          {/* RIGHT: payment */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="font-extrabold text-slate-800">{t.payment}</div>
              <div className="mt-2 text-sm font-bold text-slate-700">{t.choosePayment}</div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setPayMethod("counter")}
                  className={
                    "px-3 py-2 rounded-xl border text-sm font-extrabold " +
                    (payMethod === "counter"
                      ? "bg-sky-600 border-sky-600 text-white"
                      : "bg-white border-slate-300 text-slate-700")
                  }
                >
                  {t.counter}
                </button>

                <button
                  onClick={() => setPayMethod("card")}
                  className={
                    "px-3 py-2 rounded-xl border text-sm font-extrabold " +
                    (payMethod === "card" ? "bg-sky-600 border-sky-600 text-white" : "bg-white border-slate-300 text-slate-700")
                  }
                >
                  {t.card}
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-slate-700 font-bold">{t.amountToPay}</div>
                  <div className="text-lg sm:text-xl font-extrabold text-sky-700 text-right">{fmt(tripTotal)}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">{t.demoDisabled}</div>
              </div>

              {payMethod === "counter" ? (
                <div className="mt-4 border border-slate-200 rounded-2xl p-3 bg-white">
                  <div className="text-sm font-extrabold text-slate-800">{t.qrTitle}</div>

                  <div className="mt-3 flex flex-col sm:flex-row items-start gap-3">
                    <div className="bg-white p-2 border border-slate-200 rounded-xl">
                      <QRCode value={qrAmountOnly} size={160} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-500">{t.qrAmount}</div>
                      <div className="mt-1 text-sm font-extrabold text-slate-800">{Number(tripTotal || 0).toFixed(2)}</div>

                      <button
                        onClick={() => copy(qrAmountOnly)}
                        className="mt-2 px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-extrabold hover:border-sky-400 hover:text-sky-800"
                      >
                        {t.copy}
                      </button>

                      <div className="mt-2 text-[11px] text-slate-500">{t.noteQr}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {payMethod === "card" ? (
                <div className="mt-4 border border-slate-200 rounded-2xl p-3">
                  <div className="text-sm font-extrabold text-slate-800">{lang === "th" ? "กรอกรายละเอียดบัตร" : "Enter card details"}</div>
                  <div className="mt-3 space-y-2">
                    <input className="w-full border rounded-xl p-2" placeholder={lang === "th" ? "ชื่อบนบัตร" : "Name on card"} />
                    <input className="w-full border rounded-xl p-2" placeholder={lang === "th" ? "หมายเลขบัตร" : "Card number"} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="w-full border rounded-xl p-2" placeholder="MM/YY" />
                      <input className="w-full border rounded-xl p-2" placeholder="CVV" />
                    </div>
                    <button disabled className="w-full px-4 py-3 rounded-xl bg-slate-300 text-white font-extrabold cursor-not-allowed">
                      {lang === "th" ? "ชำระเงิน" : "Pay now"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 border border-slate-200 rounded-2xl p-3">
                  <div className="text-sm font-extrabold text-slate-800">{lang === "th" ? "สแกน QR สำหรับชำระเงิน" : "Scan QR for payment"}</div>
                  <div className="mt-3 text-xs text-slate-600">
                    {lang === "th" ? "เดโม: QR แสดงเฉพาะตอนเลือกเคาน์เตอร์/QR" : "Demo: QR shows only when Counter/QR is selected."}
                  </div>
                  <button disabled className="mt-3 w-full px-4 py-3 rounded-xl bg-slate-300 text-white font-extrabold cursor-not-allowed">
                    {lang === "th" ? "ชำระเงิน" : "Pay now"}
                  </button>
                </div>
              )}
            </div>

            {/* ✅ Removed share buttons and back-to-edit as requested */}
          </div>
        </div>
      </div>
    </div>
  );
}