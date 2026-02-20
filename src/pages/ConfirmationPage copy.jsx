// src/pages/ConfirmationPage.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import QRCode from "react-qr-code";

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

  const raw =
    p?.seatSelect ??
    p?.selectedSeat ??
    p?.seat ??
    p?.seatNumber ??
    p?.seatNo ??
    "";

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
  const nav = useNavigate();
  const { state } = useLocation() || {};

  const allSavedSeats = useSelector((s) => s?.seatSelection?.saved || {});

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
  const seatByPaxByLeg = Array.isArray(priceSummary?.seatByPaxByLeg)
    ? priceSummary.seatByPaxByLeg
    : [];

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
      title: lang === "th" ? "ยืนยันการจอง & ชำระเงิน" : "Confirmation & Payment",
      passengers: lang === "th" ? "ผู้โดยสาร" : "Passengers",
      depart: lang === "th" ? "ขาไป" : "Depart",
      ret: lang === "th" ? "ขากลับ" : "Return",
      confirmed: lang === "th" ? "ยืนยันแล้ว" : "Confirmed",
      noPassengers: lang === "th" ? "ยังไม่มีรายชื่อผู้โดยสาร" : "No passenger list provided.",
      flightSummary: lang === "th" ? "สรุปเที่ยวบิน" : "Flight summary",
      route: lang === "th" ? "เส้นทาง" : "Route",
      departArrive: lang === "th" ? "เวลาออก/ถึง" : "Departure / Arrival",
      flight: lang === "th" ? "เที่ยวบิน" : "Flight",
      back: lang === "th" ? "กลับไปแก้ไข" : "Back to edit",
      reservation: lang === "th" ? "รหัสการจอง" : "Reservation code",
      total: lang === "th" ? "ยอดรวม" : "Total",
      timeLimit: lang === "th" ? "เวลาชำระเงินภายใน" : "Time limit",
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
      demoTopNote:
        lang === "th"
          ? "สำหรับเดโมเท่านั้น: QR แบบธนาคารจริงต้องเป็น Thai QR / PromptPay."
          : "Demo only: Bank payment requires Thai QR / PromptPay standard.",
      seatTitle: lang === "th" ? "ที่นั่ง" : "Seat",
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

  /* ========================= Seat UI ========================= */
  function SeatLine({ paxId }) {
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
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
        <div className="text-sm font-semibold text-slate-800 mb-1">{t.seatTitle}:</div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-700">
          {items.map((it) => (
            <div key={it.idx} className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">{it.label} :</span>
              <span className="text-lg font-semibold text-slate-700 leading-none">{it.seat}</span>
              {it.idx === 0 && items.length > 1 ? (
                <span className="mx-1 text-slate-300 font-semibold">|</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ========================= Fare summary (with Details/Hide) ========================= */
  function FareSummaryCard() {
    const legsCount = legs.length || seatByLeg.length || (selectedOffers?.length || 0);

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4">
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

            <div className="text-lg sm:text-xl font-bold text-sky-700 text-right leading-tight">
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

        {/* only button (no left text) */}
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

                    const paxLeg = seatByPaxByLeg.find(
                      (x) => String(x?.journeyKey) === String(lg?.journeyKey)
                    );
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
                                    Pax {x?.paxId}:{" "}
                                    <span className="font-extrabold">{x?.seatCode || "-"}</span>
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
            <div className="font-extrabold text-sky-800 text-xl whitespace-nowrap">Nok Holiday</div>
            <div className="font-extrabold text-sky-700 truncate">{t.title}</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setLang("th")}
              className={
                "px-4 py-2 rounded-lg border text-sm font-extrabold " +
                (lang === "th"
                  ? "bg-sky-600 border-sky-600 text-white"
                  : "bg-white border-sky-400 text-sky-800")
              }
            >
              ไทย
            </button>
            <button
              onClick={() => setLang("en")}
              className={
                "px-4 py-2 rounded-lg border text-sm font-extrabold " +
                (lang === "en"
                  ? "bg-sky-600 border-sky-600 text-white"
                  : "bg-white border-sky-400 text-sky-800")
              }
            >
              English
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-3 sm:px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,58%)_minmax(0,42%)] gap-4">
          {/* LEFT */}
          <div className="space-y-4">
            {/* Hold status + reservation code */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-800">{ok ? t.holdOk : t.holdFail}</div>

                  <div className="mt-3">
                    <div className="text-sm text-slate-500">{t.reservation}:</div>
                    <div className="font-mono font-extrabold text-slate-900 text-xl break-all">
                      {reservationCode}
                    </div>

                    {timeLimit ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {t.timeLimit}:{" "}
                        <span className="font-semibold text-slate-700 break-all">
                          {String(timeLimit)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={
                      "px-3 py-1 rounded-full border font-bold text-sm shrink-0 " +
                      (ok
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-rose-50 border-rose-200 text-rose-700")
                    }
                  >
                    {ok ? "OK" : "ERROR"}
                  </span>

                  <button
                    onClick={() => copy(reservationCode)}
                    className="px-3 py-2 rounded border border-slate-300 bg-white text-sm"
                  >
                    {t.copy}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-3 gap-3">
                <div className="text-slate-700">{t.total}</div>
                <div className="text-xl font-bold text-slate-900 text-right">{fmt(tripTotal)}</div>
              </div>

              <div className="mt-2 text-xs text-slate-500">{t.demoTopNote}</div>

              <button
                onClick={() => nav(-1)}
                className="mt-4 px-4 py-2 rounded border border-slate-300 bg-white text-sm"
              >
                {t.back}
              </button>
            </div>

            {/* Fare summary */}
            <FareSummaryCard />

            {/* Passenger cards */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="font-extrabold text-slate-800">{t.passengers}</div>

              {passengerInfos.length ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {passengerInfos.map((p, i) => {
                    const paxId = p?.paxNumber ?? p?.paxNo ?? p?.pax ?? i + 1;
                    const fullName = `${safeUpper(p.title)} ${p.firstName || ""} ${p.lastName || ""}`.trim();

                    const g =
                      genderLabel(p?.gender) ||
                      genderLabel(p?.sex) ||
                      genderLabel(p?.genderCode) ||
                      "";

                    return (
                      <div key={String(paxId)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {/* ✅ keep name + status on ONE LINE on narrow */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            {/* ✅ single-line name (truncate if too long) */}
                            <div className="font-semibold text-slate-800 truncate whitespace-nowrap">
                              {fullName || "-"}
                              <span className="ml-2 text-xs font-bold text-slate-500">#{paxId}</span>
                            </div>

                            {/* ✅ remove "Type:" label; show "Adult • Male" on same line */}
                            <div className="text-xs text-slate-500 truncate whitespace-nowrap">
                              <span className="font-semibold text-slate-700">
                                {p.passengerType || "-"}
                              </span>
                              {g ? <span className="text-slate-400">{"  •  "}</span> : null}
                              {g ? <span className="font-semibold text-slate-700">{g}</span> : null}
                            </div>
                          </div>

                          <span className="px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold shrink-0">
                            {t.confirmed}
                          </span>
                        </div>

                        <SeatLine paxId={paxId} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-500">{t.noPassengers}</div>
              )}
            </div>

            {/* Flight summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="font-extrabold text-slate-800">{t.flightSummary}</div>

              {legs.length ? (
                <div className="mt-3 space-y-3">
                  {legs.map((L, idx) => {
                    const dateText = formatDate(L.dateIso, lang);
                    return (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold text-slate-800">{L.label}</div>
                        </div>

                        {/* ✅ Route line: put Day-of-week + date next to route (NOT right end) */}
                        <div className="mt-2">
                          <div className="text-xs text-slate-500">{t.route}</div>

                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-bold text-slate-800">
                              {safeUpper(L.origin) || "---"} → {safeUpper(L.destination) || "---"}
                            </div>

                            {L.dow ? (
                              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 font-bold text-xs">
                                {L.dow}
                              </span>
                            ) : null}

                            {dateText ? (
                              <span className="text-xs font-bold text-slate-600">{dateText}</span>
                            ) : null}
                          </div>
                        </div>

                        {/* ✅ Keep wide screen like current: 3 columns; on narrow, still stacks */}
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                          {/* Departure + Arrival on SAME LINE */}
                          <div>
                            <div className="text-xs text-slate-500">{t.departArrive}</div>
                            <div className="font-bold text-slate-800">
                              {L.depTime || "--:--"}
                              <span className="text-slate-400">{"  ,  "}</span>
                              {L.arrTime || "--:--"}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-slate-500">{t.flight}</div>
                            <div className="font-bold text-slate-800">{L.flightNo || "-"}</div>
                          </div>

                          {/* keep a third column on wide screens (empty but keeps layout stable like your current look) */}
                          <div className="hidden sm:block" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-500">
                  {lang === "th" ? "ยังไม่มีข้อมูลเที่ยวบิน" : "No flight details available yet."}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: payment */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="font-extrabold text-slate-800">{t.payment}</div>
              <div className="mt-2 text-sm font-bold text-slate-700">{t.choosePayment}</div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setPayMethod("counter")}
                  className={
                    "px-3 py-2 rounded border text-sm font-bold " +
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
                    "px-3 py-2 rounded border text-sm font-bold " +
                    (payMethod === "card"
                      ? "bg-sky-600 border-sky-600 text-white"
                      : "bg-white border-slate-300 text-slate-700")
                  }
                >
                  {t.card}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-slate-700 font-bold">{t.amountToPay}</div>
                  <div className="text-lg sm:text-xl font-extrabold text-sky-700 text-right">
                    {fmt(tripTotal)}
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">{t.demoDisabled}</div>
              </div>

              {payMethod === "counter" ? (
                <div className="mt-4 border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="text-sm font-extrabold text-slate-800">{t.qrTitle}</div>

                  <div className="mt-3 flex flex-col sm:flex-row items-start gap-3">
                    <div className="bg-white p-2 border border-slate-200 rounded-lg">
                      <QRCode value={qrAmountOnly} size={160} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-500">{t.qrAmount}</div>
                      <div className="mt-1 text-sm font-extrabold text-slate-800">
                        {Number(tripTotal || 0).toFixed(2)}
                      </div>

                      <button
                        onClick={() => copy(qrAmountOnly)}
                        className="mt-2 px-3 py-2 rounded border border-slate-300 bg-white text-sm"
                      >
                        {t.copy}
                      </button>

                      <div className="mt-2 text-[11px] text-slate-500">{t.noteQr}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {payMethod === "card" ? (
                <div className="mt-4 border border-slate-200 rounded-xl p-3">
                  <div className="text-sm font-extrabold text-slate-800">
                    {lang === "th" ? "กรอกรายละเอียดบัตร" : "Enter card details"}
                  </div>
                  <div className="mt-3 space-y-2">
                    <input className="w-full border rounded p-2" placeholder={lang === "th" ? "ชื่อบนบัตร" : "Name on card"} />
                    <input className="w-full border rounded p-2" placeholder={lang === "th" ? "หมายเลขบัตร" : "Card number"} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="w-full border rounded p-2" placeholder="MM/YY" />
                      <input className="w-full border rounded p-2" placeholder="CVV" />
                    </div>
                    <button disabled className="w-full px-4 py-3 rounded bg-slate-300 text-white font-bold cursor-not-allowed">
                      {lang === "th" ? "ชำระเงิน" : "Pay now"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 border border-slate-200 rounded-xl p-3">
                  <div className="text-sm font-extrabold text-slate-800">
                    {lang === "th" ? "สแกน QR สำหรับชำระเงิน" : "Scan QR for payment"}
                  </div>
                  <div className="mt-3 text-xs text-slate-600">
                    {lang === "th"
                      ? "เดโม: QR แสดงเฉพาะตอนเลือกเคาน์เตอร์/QR"
                      : "Demo: QR shows only when Counter/QR is selected."}
                  </div>
                  <button disabled className="mt-3 w-full px-4 py-3 rounded bg-slate-300 text-white font-bold cursor-not-allowed">
                    {lang === "th" ? "ชำระเงิน" : "Pay now"}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="font-extrabold text-slate-800">Debug: holdResponse</div>
              <pre className="mt-2 text-xs overflow-auto bg-slate-50 border border-slate-200 rounded p-2 max-h-[360px]">
                {JSON.stringify(holdResponse, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
