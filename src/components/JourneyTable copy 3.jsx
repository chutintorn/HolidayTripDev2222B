// src/components/JourneyTable.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { selectResults, selectSearch } from "../redux/searchSlice";
import { fetchPriceDetail, selectPricingStatus } from "../redux/pricingSlice";
import { fetchSeatMap, selectSeatMapStatus } from "../redux/seatMapSlice";
import { setSelectedOfferLegs } from "../redux/offerSelectionSlice";

import { flattenFlights } from "../utils/flattenFlights";
import PaxChips from "./PaxChips";
import { derivePax } from "../utils/pax";

/** ------ Local-safe date helpers ---- */
const ymd = (s) =>
  typeof s === "string" && s.length >= 10 ? s.slice(0, 10) : "";

const toLocalDate = (s) => {
  const dstr = ymd(s);
  if (!dstr) return null;
  const y = Number(dstr.slice(0, 4));
  const m = Number(dstr.slice(5, 7)) - 1;
  const d = Number(dstr.slice(8, 10));
  const date = new Date(y, m, d);
  return isNaN(date) ? null : date;
};

/** ---- Currency helper ---- */
const fmtMoney = (n, currency = "THB") => {
  if (n === "" || n === null || n === undefined) return "";
  const num = typeof n === "string" ? Number(n.replace(/,/g, "")) : Number(n);
  if (!Number.isFinite(num)) return "";
  return `${currency} ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** ---- Hex → rgba for soft accent backgrounds ---- */
const hexToRgba = (hex, alpha = 0.18) => {
  const m = hex?.trim().match(/^#?([a-f\d]{3}|[a-f\d]{6})$/i);
  if (!m) return `rgba(0,0,0,${alpha})`;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** ---- Time helper for secondary sort ---- */
const timeToMinutes = (value) => {
  if (!value) return Number.MAX_SAFE_INTEGER;

  const str = String(value).trim();

  const hhmm = str.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    return h * 60 + m;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.getHours() * 60 + d.getMinutes();
  }

  return Number.MAX_SAFE_INTEGER;
};

/** ---- Price helper for sort ---- */
const getFareNumber = (row) => {
  const candidates = [
    row?.fareAmountIncludingTax,
    row?.totalPrice,
    row?.amount,
    row?.price,
    row?.fareAmount,
    row?.total,
  ];

  for (const value of candidates) {
    if (value === null || value === undefined || value === "") continue;

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    const num = Number(cleaned);
    if (Number.isFinite(num)) return num;
  }

  return Number.MAX_SAFE_INTEGER;
};

const TEXT = {
  en: {
    depart: "Depart",
    arrive: "Arrive",
    details: "Details ▾",
    hideDetails: "Hide details ▴",
    freeFare: "✅ Free fare inclusions — Carry-on allowance 7 kg × 1",
    shortHaul: "Short-haul",
    estEmission: "est. emissions",
    nonstop: "Nonstop",
    carryOn: "7 kg per person",
    economy: "Economy",
    noFlights:
      "No flights to display. The response may be empty or in an unexpected format.",
    noSelected: "No flight selected yet.",
    selected: "Selected",
    select: "Select",
    next: "NEXT",
    pleaseWait: "Please wait…",
    loadingPriceSeatMap: "Loading price & seat map…",
    failedPrice: "Failed to load price.",
    failedSeatMap: "Failed to load seat map.",
    sortByPrice: "Sort by Price",
    sortByDeparture: "Sort by Departure",
  },
  th: {
    depart: "ออกเดินทาง",
    arrive: "ถึง",
    details: "รายละเอียด ▾",
    hideDetails: "ซ่อนรายละเอียด ▴",
    freeFare: "✅ สิทธิ์ค่าโดยสารฟรี — สัมภาระถือขึ้นเครื่อง 7 กก. × 1",
    shortHaul: "เที่ยวบินระยะใกล้",
    estEmission: "การปล่อยคาร์บอนโดยประมาณ",
    nonstop: "บินตรง",
    carryOn: "7 กก. ต่อท่าน",
    economy: "ชั้นประหยัด",
    noFlights:
      "ไม่มีเที่ยวบินที่จะแสดง ผลลัพธ์อาจว่างหรือรูปแบบข้อมูลไม่ตรงที่คาดไว้",
    noSelected: "ยังไม่ได้เลือกเที่ยวบิน",
    selected: "เลือกแล้ว",
    select: "เลือก",
    next: "ถัดไป",
    pleaseWait: "กรุณารอสักครู่…",
    loadingPriceSeatMap: "กำลังโหลดราคาและผังที่นั่ง…",
    failedPrice: "โหลดราคาไม่สำเร็จ",
    failedSeatMap: "โหลดผังที่นั่งไม่สำเร็จ",
    sortByPrice: "เรียงตามราคา",
    sortByDeparture: "เรียงตามเวลา",
  },
};

/** ---- Inline details ---- */
function InlineDetails({ row, accent, t }) {
  return (
    <div
      className="min-h-0 pt-3 pb-3 px-3 rounded-lg"
      style={{ backgroundColor: hexToRgba(accent, 0.12) }}
    >
      <div className="relative pl-5">
        <span className="absolute left-2 top-0 bottom-0 w-[1px] bg-slate-300 rounded" />

        <div className="relative my-3">
          <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
          <div className="inline-block text-[13px] px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-blue-700">
            {(row?.departureTime || "").toString()} • {t.depart}
          </div>
          <div className="text-slate-600 text-[12px] mt-0.5">
            {row?.originName || row?.origin}
          </div>
        </div>

        <div className="relative my-3">
          <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
          <div className="bg-white border border-slate-200 rounded p-3 text-[12px] text-slate-700 shadow-sm">
            <div className="font-bold text-blue-700 text-[14px]">
              {row?.marketingCarrier || "Nok Air"}, {row?.flightNumber || ""}
            </div>
            <div className="text-slate-500">{t.shortHaul}</div>
            <div className="text-[11px] mt-1">
              {row?.perPaxCo2 || "48kg CO₂e"} • {t.estEmission}
            </div>
          </div>
        </div>

        <div className="relative my-3">
          <span className="absolute left-0 top-1 w-[12px] h-[12px] rounded-full bg-white border border-slate-400" />
          <div className="inline-block text-[13px] px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-blue-700">
            {(row?.arrivalTime || "").toString()} • {t.arrive}
          </div>
          <div className="text-slate-600 text-[12px] mt-0.5">
            {row?.destinationName || row?.destination}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-dashed text-[12px] font-medium text-blue-700">
        {t.freeFare}
      </div>
    </div>
  );
}

/** closed-strip bar (no text) */
function ClosedDowStrip({ accent }) {
  return (
    <div className="col-span-full mt-1.5">
      <div
        className="h-6 rounded-lg border border-slate-100"
        style={{ backgroundColor: hexToRgba(accent, 0.12) }}
      />
    </div>
  );
}

export default function JourneyTable({
  resultsOverride = null,
  currencyOverride,
  securityTokenOverride,
  titleOverride,
  hideHeader = false,
  showNextButton = false,
  onSelectRow,
  onNext,

  externalTab,
  onExternalTabChange,
  externalClearSignal = 0,

  onSelectionChange,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const globalResults = useSelector(selectResults);
  const search = useSelector(selectSearch);
  const lang = useSelector((s) => s.language?.value || "en");
  const t = TEXT[lang] || TEXT.en;

  useSelector((s) => {
    return (
      s?.offerSelection?.selectedOfferLegs ||
      s?.offerSelectionSlice?.selectedOfferLegs ||
      s?.offerSelectionReducer?.selectedOfferLegs ||
      []
    );
  });

  const raw = resultsOverride ?? globalResults;

  const currency =
    currencyOverride || raw?.currency || globalResults?.currency || "THB";
  const securityToken =
    securityTokenOverride ||
    raw?.securityToken ||
    globalResults?.securityToken ||
    "";

  const payload = raw?.data ?? raw;

  const rows = useMemo(() => {
    if (!payload) return [];
    const input = Array.isArray(payload) ? payload : [payload];
    const out = flattenFlights(input, securityToken) || [];
    return out.filter(
      (r) => r && (r.id || r.flightNumber) && (r.origin || r.destination)
    );
  }, [payload, securityToken]);

  const pax = useMemo(
    () => derivePax(search?.params || search?.results || payload || raw || {}),
    [search, payload, raw]
  );
  const totalPax = (pax.adult || 0) + (pax.child || 0) + (pax.infant || 0);

  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedFare, setSelectedFare] = useState(null);
  const [openId, setOpenId] = useState(null);

  const [localTab, setLocalTab] = useState("list");
  const tab = externalTab || localTab;

  const setTabSafe = (next) => {
    if (typeof onExternalTabChange === "function") onExternalTabChange(next);
    else setLocalTab(next);
  };

  const [nextLoading, setNextLoading] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  const [priceSortOrder, setPriceSortOrder] = useState(null); // null | asc | desc
  const [departureSortOrder, setDepartureSortOrder] = useState(null); // null | asc | desc

  const requestKey = selectedFare?.fareKey || "";
  const pricingStatus = useSelector(selectPricingStatus(requestKey));
  const seatStatus = useSelector(selectSeatMapStatus(requestKey));

  const canNext =
    !!(selectedFare?.journeyKey && selectedFare?.fareKey) && !nextLoading;

  const sortedRows = useMemo(() => {
    const data = [...rows];

    if (priceSortOrder) {
      data.sort((a, b) => {
        const priceDiff = getFareNumber(a) - getFareNumber(b);
        if (priceDiff !== 0) {
          return priceSortOrder === "asc" ? priceDiff : -priceDiff;
        }

        return timeToMinutes(a?.departureTime) - timeToMinutes(b?.departureTime);
      });
      return data;
    }

    if (departureSortOrder) {
      data.sort((a, b) => {
        const timeDiff =
          timeToMinutes(a?.departureTime) - timeToMinutes(b?.departureTime);
        if (timeDiff !== 0) {
          return departureSortOrder === "asc" ? timeDiff : -timeDiff;
        }

        return getFareNumber(a) - getFareNumber(b);
      });
      return data;
    }

    return data;
  }, [rows, priceSortOrder, departureSortOrder]);

  const handlePriceSortClick = () => {
    setPriceSortOrder((prev) => {
      const next = prev === "asc" ? "desc" : "asc";
      return next;
    });
    setDepartureSortOrder(null);
  };

  const handleDepartureSortClick = () => {
    setDepartureSortOrder((prev) => {
      const next = prev === "asc" ? "desc" : "asc";
      return next;
    });
    setPriceSortOrder(null);
  };

  useEffect(() => {
    if (search?.status === "loading") {
      setSelectedRow(null);
      setSelectedFare(null);
      setOpenId(null);
      setTabSafe("list");
      setViewOpen(false);
      setPriceSortOrder(null);
      setDepartureSortOrder(null);
      if (typeof onSelectionChange === "function") onSelectionChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search?.status]);

  const searchKey = useMemo(() => {
    const p = search?.params || {};
    return JSON.stringify({
      origin: p.origin,
      destination: p.destination,
      depart: p.depart,
      ret: p.ret,
      adult: p.adult,
      child: p.child,
      infant: p.infant,
      promoCode: p.promoCode,
      currency: p.currency,
      agencyCode: p.agencyCode,
    });
  }, [search?.params]);

  useEffect(() => {
    setSelectedRow(null);
    setSelectedFare(null);
    setOpenId(null);
    setTabSafe("list");
    setViewOpen(false);
    setPriceSortOrder(null);
    setDepartureSortOrder(null);
    if (typeof onSelectionChange === "function") onSelectionChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  useEffect(() => {
    if (!externalClearSignal) return;

    setSelectedRow(null);
    setSelectedFare(null);
    setOpenId(null);
    setTabSafe("list");
    setViewOpen(false);
    setPriceSortOrder(null);
    setDepartureSortOrder(null);

    dispatch(setSelectedOfferLegs([]));
    if (typeof onSelectionChange === "function") onSelectionChange(false);
    if (typeof onSelectRow === "function") onSelectRow(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalClearSignal]);

  if (!rows.length) {
    return (
      <div className="mt-6 rounded-xl border bg-amber-50 text-amber-900 p-4">
        {t.noFlights}
      </div>
    );
  }

  const selectLite = (row) => {
    const fareKey = row?.fareKey;
    if (!fareKey) return;

    const selection = {
      brand: "LITE",
      fareKey,
      journeyKey: row.journeyKey,
      securityToken: row.securityToken || securityToken,
      currency,
      row,
      origin: row.origin,
      destination: row.destination,
      fareAmountIncludingTax: row.fareAmountIncludingTax,
    };

    setSelectedRow(row);
    setSelectedFare(selection);
    if (typeof onSelectionChange === "function") onSelectionChange(true);

    dispatch(
      setSelectedOfferLegs([
        {
          direction: "OUT",
          journeyKey: selection.journeyKey ?? null,
          fareKey: selection.fareKey ?? null,
          securityToken: selection.securityToken ?? null,
          currency: selection.currency ?? currency ?? null,
          row: selection.row ?? row ?? null,
          origin: selection.origin ?? row?.origin ?? null,
          destination: selection.destination ?? row?.destination ?? null,
          fareAmountIncludingTax:
            selection.fareAmountIncludingTax ??
            row?.fareAmountIncludingTax ??
            null,
        },
      ])
    );

    setViewOpen(false);

    if (typeof onSelectRow === "function") onSelectRow(selection);
  };

  const handleInternalNext = async () => {
    if (!selectedFare?.journeyKey || !selectedFare?.fareKey) return;

    dispatch(
      setSelectedOfferLegs([
        {
          direction: "OUT",
          journeyKey: selectedFare.journeyKey ?? null,
          fareKey: selectedFare.fareKey ?? null,
          securityToken: selectedFare.securityToken ?? null,
          currency: selectedFare.currency ?? currency ?? null,
          row: selectedFare.row ?? selectedRow ?? null,
          origin: selectedFare.origin ?? selectedRow?.origin ?? null,
          destination:
            selectedFare.destination ?? selectedRow?.destination ?? null,
          fareAmountIncludingTax:
            selectedFare.fareAmountIncludingTax ??
            selectedRow?.fareAmountIncludingTax ??
            null,
        },
      ])
    );

    if (typeof onNext === "function") {
      onNext({
        journeyKey: selectedFare.journeyKey,
        fareKey: selectedFare.fareKey,
      });
      return;
    }

    const offers = [
      {
        journeyKey: selectedFare.journeyKey,
        fareKey: selectedFare.fareKey,
        securityToken: selectedFare.securityToken,
      },
    ];

    const API_BASE =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
      "http://localhost:3100";
    const priceUrl = `${API_BASE}/pricedetails`;
    const seatUrl = `${API_BASE}/seat-map`;

    const commonHeaders = { "Content-Type": "application/json" };
    const priceHeaders = {
      ...commonHeaders,
      ...(selectedFare.securityToken
        ? { securitytoken: selectedFare.securityToken }
        : {}),
    };
    const seatHeaders = {
      ...commonHeaders,
      ...(selectedFare.securityToken
        ? { securitytoken: selectedFare.securityToken }
        : {}),
    };

    setNextLoading(true);
    try {
      const priceP = dispatch(
        fetchPriceDetail({ offers, currency, includeSeats: false })
      ).unwrap();

      const seatP = dispatch(fetchSeatMap({ offers, agencyCode: "" })).unwrap();

      const [priceRes, seatRes] = await Promise.allSettled([priceP, seatP]);

      if (priceRes.status !== "fulfilled") {
        console.error("Pricing failed:", priceRes.reason);
        return;
      }

      const seatOk = seatRes.status === "fulfilled";
      const seatError =
        seatOk ? null : seatRes.reason?.message || "Seat map failed.";
      const seatRaw = seatOk ? seatRes.value : null;

      navigate("/skyblue-price-detail", {
        state: {
          requestKey: selectedFare.fareKey,
          seatOk,
          seatError,
          seatRaw,
          debug: {
            pricingRequest: {
              url: priceUrl,
              method: "POST",
              headers: priceHeaders,
              body: { offers, currency, includeSeats: false },
            },
            seatMapRequest: {
              url: seatUrl,
              method: "POST",
              headers: seatHeaders,
              body: { offers, agencyCode: "" },
            },
            seatResponse: seatRaw,
            seatOk,
            seatError,
          },
        },
      });
    } catch (e) {
      console.error("Unexpected NEXT error:", e);
    } finally {
      setNextLoading(false);
    }
  };

  const depDate = toLocalDate(rows[0]?.departureDate);
  const ddMMM = depDate
    ? depDate
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        .toUpperCase()
    : "";
  const dow = depDate
    ? depDate.toLocaleDateString("en-GB", { weekday: "short" })
    : "";
  const dowColors = {
    Mon: "#FFD700",
    Tue: "#FF69B4",
    Wed: "#32CD32",
    Thu: "#FFA500",
    Fri: "#00BFFF",
    Sat: "#CF9FFF",
    Sun: "#FF4500",
  };
  const accent = dowColors[dow] || "#00BFFF";
  const containerStyle = { "--dow": accent };

  const viewRow = selectedFare?.row || selectedRow || null;

  const baseSortBtn =
    "h-9 w-[156px] rounded-xl border bg-white px-4 text-[13px] font-medium leading-none transition-colors";
  const activeSortBtn =
    "border-blue-400 text-blue-700 bg-blue-50 hover:border-blue-500";
  const idleSortBtn =
    "border-slate-400 text-blue-700 hover:border-blue-300 hover:bg-blue-50";

  return (
    <div className="w-full" style={containerStyle}>
      {!hideHeader && (
        <>
          <h2 className="ml-1 mb-2 text-blue-700 flex items-center gap-2 flex-wrap text-[200%] leading-tight">
            {titleOverride && (
              <span className="text-slate-700 font-semibold text-[0.6em]">
                {titleOverride}
              </span>
            )}

            <span className="font-semibold text-[0.9em]">
              {rows[0]?.origin} {rows[0]?.destination}
            </span>

            {ddMMM && (
              <>
                <span className="text-slate-700 text-[0.65em]">{ddMMM}</span>
                <span
                  className="font-semibold px-3 py-1 rounded text-[0.6em]"
                  style={{ backgroundColor: "#000", color: accent }}
                >
                  {dow}
                </span>
              </>
            )}

            <PaxChips source={search?.params || search?.results || payload || raw} />
          </h2>

          {tab !== "view" && (
            <div className="ml-1 mb-2 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handlePriceSortClick}
                className={`${baseSortBtn} ${
                  priceSortOrder ? activeSortBtn : idleSortBtn
                }`}
                aria-label={t.sortByPrice}
                title={t.sortByPrice}
              >
                <span className="inline-flex w-full items-center justify-center gap-1.5">
                  <span>{t.sortByPrice}</span>
                  <span className="text-[15px] font-extrabold leading-none tracking-[-0.02em]">
                    ⇅
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleDepartureSortClick}
                className={`${baseSortBtn} ${
                  departureSortOrder ? activeSortBtn : idleSortBtn
                }`}
                aria-label={t.sortByDeparture}
                title={t.sortByDeparture}
              >
                <span className="inline-flex w-full items-center justify-center gap-1.5">
                  <span>{t.sortByDeparture}</span>
                  <span className="text-[15px] font-extrabold leading-none tracking-[-0.02em]">
                    ⇅
                  </span>
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {tab === "view" && (
        <div className="mb-3">
          {!viewRow ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-600">
              {t.noSelected}
            </div>
          ) : (
            <article
              style={{ "--dow": accent }}
              className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center transition-colors hover:border-[var(--dow)]"
            >
              <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                <div className="w-7 h-7 rounded-md bg-white border border-amber-200 grid place-items-center overflow-hidden">
                  <img
                    className="w-full h-full object-cover"
                    alt="Nok Air"
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHBKoufNO6L_f1AvGmnvXR7b5TfMiDQGjH6w&s"
                  />
                </div>

                <div>
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#e9f2ff] border border-[#c8defa] text-[#0b4f8a] mb-0.5">
                    {t.economy}
                  </span>

                  <div className="font-bold text-[15px] text-[#0b4f8a] leading-tight">
                    {viewRow.flightNumber || viewRow.id}&nbsp;&nbsp;
                    {viewRow.origin} → {viewRow.destination}
                  </div>

                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="text-[18px] font-extrabold">
                      {viewRow.departureTime}
                    </div>
                    <div className="flex-1 h-[1px] bg-slate-200 relative rounded">
                      <span className="absolute left-0 right-0 mx-auto -top-[7px] block h-[1px] w-[80px] bg-slate-300 rounded" />
                    </div>
                    <div className="text-[18px] font-extrabold">
                      {viewRow.arrivalTime}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
                    <span>
                      {viewRow.aircraftDescription
                        ? `${viewRow.aircraftDescription} • ${viewRow.duration}`
                        : viewRow.duration}
                    </span>
                    <span>•</span>
                    <span>{t.nonstop}</span>
                    <span>•</span>
                    <span>{t.carryOn}</span>
                    {viewRow.co2 && (
                      <>
                        <span>•</span>
                        <span>{viewRow.co2}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <div className="text-right">
                  <span
                    className="font-bold text-[20px] leading-none px-2 py-1 rounded transition-colors"
                    style={{
                      color: "#0b4f8a",
                      backgroundColor: hexToRgba(accent, 0.12),
                    }}
                  >
                    {fmtMoney(viewRow.fareAmountIncludingTax, currency)}
                  </span>

                  <div className="text-[10px] text-slate-500">
                    <span className="mr-2">ADT {pax.adult || 0}</span>
                    {(pax.child || 0) > 0 && (
                      <span className="mr-2">CHD {pax.child}</span>
                    )}
                    / {totalPax} pax*
                  </div>
                </div>

                <button
                  onClick={() => setViewOpen((v) => !v)}
                  className={
                    "text-[11px] border-b border-dashed transition-colors " +
                    (viewOpen
                      ? "text-blue-700 border-blue-300"
                      : "text-slate-700 border-slate-400 hover:text-[var(--dow)] hover:border-[var(--dow)]")
                  }
                >
                  {viewOpen ? t.hideDetails : t.details}
                </button>
              </div>

              {viewOpen ? (
                <div className="col-span-full mt-1.5 border-t border-dashed border-slate-200 pt-2">
                  <InlineDetails row={viewRow} accent={accent} t={t} />
                </div>
              ) : (
                <ClosedDowStrip accent={accent} />
              )}
            </article>
          )}
        </div>
      )}

      {tab !== "view" && (
        <div className="flex flex-col gap-3">
          {sortedRows.map((row, idx) => {
            const cardId = row.id || `${row.flightNumber}-${idx}`;
            const open = openId === cardId;
            const selected = selectedRow?.fareKey === row.fareKey;

            return (
              <article
                key={row.id || `${row.flightNumber}-${row.departureTime}-${idx}`}
                style={{ "--dow": accent }}
                className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center transition-colors hover:border-[var(--dow)]"
              >
                <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                  <div className="w-7 h-7 rounded-md bg-white border border-amber-200 grid place-items-center overflow-hidden">
                    <img
                      className="w-full h-full object-cover"
                      alt="Nok Air"
                      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHBKoufNO6L_f1AvGmnvXR7b5TfMiDQGjH6w&s"
                    />
                  </div>

                  <div>
                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#e9f2ff] border border-[#c8defa] text-[#0b4f8a] mb-0.5">
                      {t.economy}
                    </span>

                    <div className="font-bold text-[15px] text-[#0b4f8a] leading-tight">
                      {row.flightNumber || row.id}&nbsp;&nbsp;{row.origin} →{" "}
                      {row.destination}
                    </div>

                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="text-[18px] font-extrabold">
                        {row.departureTime}
                      </div>
                      <div className="flex-1 h-[1px] bg-slate-200 relative rounded">
                        <span className="absolute left-0 right-0 mx-auto -top-[7px] block h-[1px] w-[80px] bg-slate-300 rounded" />
                      </div>
                      <div className="text-[18px] font-extrabold">
                        {row.arrivalTime}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
                      <span>
                        {row.aircraftDescription
                          ? `${row.aircraftDescription} • ${row.duration}`
                          : row.duration}
                      </span>
                      <span>•</span>
                      <span>{t.nonstop}</span>
                      <span>•</span>
                      <span>{t.carryOn}</span>
                      {row.co2 && (
                        <>
                          <span>•</span>
                          <span>{row.co2}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-right">
                    <span
                      className="font-bold text-[20px] leading-none px-2 py-1 rounded transition-colors"
                      style={{
                        color: selected ? "#4927F5" : "#0b4f8a",
                        backgroundColor: selected
                          ? hexToRgba(accent, 0.18)
                          : "transparent",
                      }}
                    >
                      {fmtMoney(row.fareAmountIncludingTax, currency)}
                    </span>

                    <div className="text-[10px] text-slate-500">
                      <span className="mr-2">ADT {pax.adult || 0}</span>
                      {(pax.child || 0) > 0 && (
                        <span className="mr-2">CHD {pax.child}</span>
                      )}
                      / {totalPax} pax*
                    </div>
                  </div>

                  <button
                    onClick={() => selectLite(row)}
                    className={
                      "rounded-lg text-white font-bold px-3 py-1.5 shadow min-w-[100px] text-sm transition-colors " +
                      (selected
                        ? "bg-[#0a65a0] hover:bg-[var(--dow)]"
                        : "bg-[#0B73B1] hover:bg-[var(--dow)]")
                    }
                  >
                    {selected ? t.selected : t.select}
                  </button>

                  <button
                    onClick={() => setOpenId(open ? null : cardId)}
                    className={
                      "text-[11px] border-b border-dashed transition-colors " +
                      (open
                        ? "text-blue-700 border-blue-300"
                        : "text-slate-700 border-slate-400 hover:text-[var(--dow)] hover:border-[var(--dow)]")
                    }
                  >
                    {open ? t.hideDetails : t.details}
                  </button>
                </div>

                {open ? (
                  <div className="col-span-full mt-1.5 border-t border-dashed border-slate-200 pt-2">
                    <InlineDetails row={row} accent={accent} t={t} />
                  </div>
                ) : (
                  <ClosedDowStrip accent={accent} />
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        {nextLoading && (
          <div className="mb-2 text-xs text-slate-600">
            {t.loadingPriceSeatMap}
          </div>
        )}
        {!nextLoading && pricingStatus === "failed" && (
          <div className="mb-2 text-xs text-red-600">{t.failedPrice}</div>
        )}
        {!nextLoading && seatStatus === "failed" && (
          <div className="mb-2 text-xs text-red-600">{t.failedSeatMap}</div>
        )}

        {showNextButton && (
          <div className="sm:flex sm:justify-end">
            <button
              onClick={handleInternalNext}
              disabled={!canNext}
              className={
                "w-full rounded-xl font-bold transition-colors " +
                "py-3 text-sm " +
                "sm:w-auto sm:py-2 sm:px-4 sm:text-xs sm:rounded-md " +
                (canNext
                  ? "bg-blue-600 text-white hover:bg-[var(--dow)]"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed")
              }
            >
              {nextLoading ? t.pleaseWait : t.next}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}