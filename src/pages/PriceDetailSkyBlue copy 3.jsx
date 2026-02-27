// src/pages/PriceDetailSkyBlue.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectPriceFor } from "../redux/pricingSlice";

// read saved seat selections from Redux
import { selectAllSavedSeats } from "../redux/seatSelectionSlice";

// Flight panel
import FlightSummaryPanel from "./FlightSummaryPanel";

// Split files (same folder level)
import { STR } from "./strings";
import PriceHeader from "./PriceHeader";
import PassengersPanel from "./PassengersPanel";
import FareSidebar from "./FareSidebar";

// Components still used in this file (debug)
import PrettyBlock from "../components/PrettyBlock";
import Modal from "../components/Modal";
import submitHoldBooking from "../api/submitHoldBooking";

// Utils
import { paxFromFirstPricingDetails } from "../utils/pricingHelpers";

/* ========================= Responsive helpers ========================= */
function useMediaQuery(query, initial = false) {
  const [matches, setMatches] = useState(initial);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);

    const onChange = () => setMatches(Boolean(mql.matches));
    onChange();

    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

/* ===== Debug helpers (for viewing requests) ===== */
function buildCurl({ url, method = "POST", headers = {}, body = null }) {
  const h = Object.entries(headers)
    .map(([k, v]) => `-H ${JSON.stringify(`${k}: ${v}`)}`)
    .join(" ");
  const d = body ? `--data '${JSON.stringify(body)}'` : "";
  return `curl -X ${method} ${h} ${d} ${JSON.stringify(url)}`;
}

function toPassengerType(code) {
  if (code === "ADT") return "Adult";
  if (code === "CHD") return "Child";
  if (code === "INF") return "Infant";
  return "Adult";
}

function toTitle(gender) {
  if (gender === "F") return "MS";
  return "MR";
}

// "DD/MM/YYYY" or "YYYY-MM-DD" -> "YYYY-MM-DD"
function normalizeDob(dob) {
  if (!dob) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;

  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }
  return dob;
}

function calcAgeFromDob(isoDob) {
  try {
    const d = new Date(isoDob);
    if (Number.isNaN(d.getTime())) return 0;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return Math.max(0, age);
  } catch {
    return 0;
  }
}

/* ========================= Summary helpers (DOB + Age Years/Months) ========================= */
function calcAgeYearsMonths(isoDob) {
  try {
    if (!isoDob) return { years: 0, months: 0 };
    const dob = new Date(isoDob);
    if (Number.isNaN(dob.getTime())) return { years: 0, months: 0 };

    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();

    if (now.getDate() < dob.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years < 0) return { years: 0, months: 0 };

    return { years, months: Math.max(0, months) };
  } catch {
    return { years: 0, months: 0 };
  }
}

function formatDobDisplay(isoDob) {
  try {
    if (!isoDob) return "";
    const d = new Date(isoDob);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatAgeDisplay(isoDob) {
  const { years, months } = calcAgeYearsMonths(isoDob);
  if (!years && !months) return "";
  return `${years} Years ${months} Months`;
}

function titleFromForm(v) {
  if (v?.title) return v.title;
  return toTitle(v?.gender);
}

function genderLabel(v, t) {
  if (v?.gender === "M") return t.male;
  if (v?.gender === "F") return t.female;
  return v?.gender || "";
}

/* ========================= detect weekday from first leg ========================= */
function extractIsoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /(20\d{2})(\d{2})(\d{2})/.exec(s);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function findFirstJourneyKeyDeep(obj, depth = 0) {
  if (!obj || depth > 6) return "";
  if (typeof obj === "string") return /(20\d{2}\d{2}\d{2})/.test(obj) ? obj : "";
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = findFirstJourneyKeyDeep(it, depth + 1);
      if (r) return r;
    }
    return "";
  }
  if (typeof obj === "object") {
    if (typeof obj.journeyKey === "string" && obj.journeyKey) return obj.journeyKey;
    for (const k of Object.keys(obj)) {
      const r = findFirstJourneyKeyDeep(obj[k], depth + 1);
      if (r) return r;
    }
  }
  return "";
}

function getFirstDepartIso({ selectedOffers, rawDetail }) {
  const jk0 = selectedOffers?.[0]?.journeyKey;
  const iso0 = extractIsoFromJourneyKey(jk0);
  if (iso0) return iso0;

  const jkAny = findFirstJourneyKeyDeep(rawDetail);
  const isoAny = extractIsoFromJourneyKey(jkAny);
  if (isoAny) return isoAny;

  return "";
}

/* ========================= Weekday theme ========================= */
function weekdayTheme(dayIdx) {
  switch (dayIdx) {
    case 1:
      return "bg-yellow-100 border-yellow-400 text-yellow-900";
    case 2:
      return "bg-pink-100 border-pink-400 text-pink-900";
    case 3:
      return "bg-green-100 border-green-400 text-green-900";
    case 4:
      return "bg-orange-100 border-orange-400 text-orange-900";
    case 5:
      return "bg-sky-100 border-sky-400 text-sky-900";
    case 6:
      return "bg-purple-100 border-purple-400 text-purple-900";
    case 0:
      return "bg-red-100 border-red-400 text-red-900";
    default:
      return "bg-white border-teal-300 text-teal-700";
  }
}

/**
 * Build booking payload supports ROUND-TRIP via selectedOffers[]
 * includes selectedSeat from Redux savedSeats
 */
function buildBookingPayload({
  agencyCode,
  travellers,
  forms,
  contact,
  selectedOffers,
  fareKey,
  journeyKey,
  savedSeats,
}) {
  const offersArr =
    Array.isArray(selectedOffers) && selectedOffers.length
      ? selectedOffers
      : [{ fareKey: fareKey || "", journeyKey: journeyKey || "" }];

  return {
    agencyCode: agencyCode || "OTATEST",
    actionType: "summary",
    passengerInfos: travellers.map((p, idx) => {
      const v = forms[p.id] || {};
      const passengerType = toPassengerType(p.type);

      const dateOfBirth = normalizeDob(v.dob);
      const age = v.age ?? calcAgeFromDob(dateOfBirth);

      return {
        paxNumber: idx + 1,
        title: v.title || toTitle(v.gender),
        firstName: v.firstName || "",
        lastName: v.lastName || "",
        middleName: v.middleName || "",
        age: Number(age) || 0,
        dateOfBirth,
        passengerType,
        mobilePhone: v.mobilePhone || `${contact?.dialCode || "+66"}${contact?.phone || ""}`,
        email: v.email || contact?.email || "",
        gender: v.gender === "M" ? "Male" : v.gender === "F" ? "Female" : v.gender,
        nationality: v.nationality || "TH",

        flightFareKey: offersArr.map((o) => {
          const jk = o?.journeyKey || "";
          const seat = savedSeats?.[p.id]?.[jk] || null;

          return {
            fareKey: o?.fareKey || "",
            journeyKey: jk,
            extraService: [],
            selectedSeat: seat?.seatCode
              ? [
                  {
                    seatCode: seat.seatCode,
                    amount: Number(seat.amount || 0) || 0,
                    currency: seat.currency || "THB",
                    vat: Number(seat.vat || 0) || 0,
                    serviceCode: seat.serviceCode || "",
                    description: seat.description || "",
                  },
                ]
              : [],
          };
        }),
      };
    }),
  };
}

/* ============================================================
   Fare summary parser for YOUR API response
   ============================================================ */
function calcFareSummaryFromApi(rawAny) {
  const root = rawAny?.detail?.data || rawAny?.data || rawAny?.detail || rawAny || null;

  const currency = root?.currency || "THB";
  const airlines = Array.isArray(root?.airlines) ? root.airlines : [];

  const totalAmountFromApi = Number(root?.totalAmount || 0) || 0;
  const EPS = 1;

  let base_group = 0,
    taxExVat_group = 0,
    vat_group = 0,
    incl_group = 0;
  let base_unit = 0,
    taxExVat_unit = 0,
    vat_unit = 0,
    incl_unit = 0;

  const byType_group = { ADT: 0, CHD: 0, INF: 0 };
  const byType_unit = { ADT: 0, CHD: 0, INF: 0 };

  for (const leg of airlines) {
    const pricingDetails = Array.isArray(leg?.pricingDetails) ? leg.pricingDetails : [];
    for (const pd of pricingDetails) {
      const paxCount = Number(pd?.paxCount || 1) || 1;

      const base = Number(pd?.fareAmount || 0) || 0;
      const incl = Number(pd?.fareAmountIncludingTax || 0) || 0;

      const taxes = Array.isArray(pd?.taxesAndFees) ? pd.taxesAndFees : [];
      let vatInLine = 0;
      let exVatInLine = 0;

      for (const tx of taxes) {
        const amt = Number(tx?.amount || 0) || 0;
        const code = String(tx?.taxCode || "").toUpperCase();
        if (code === "VAT") vatInLine += amt;
        else exVatInLine += amt;
      }

      base_group += base;
      vat_group += vatInLine;
      taxExVat_group += exVatInLine;
      incl_group += incl;

      base_unit += base * paxCount;
      vat_unit += vatInLine * paxCount;
      taxExVat_unit += exVatInLine * paxCount;
      incl_unit += incl * paxCount;

      const pt = String(pd?.paxTypeCode || "").toLowerCase();
      const bucket =
        pt.includes("adult")
          ? "ADT"
          : pt.includes("child")
          ? "CHD"
          : pt.includes("infant")
          ? "INF"
          : null;

      if (bucket) {
        byType_group[bucket] += incl;
        byType_unit[bucket] += incl * paxCount;
      }
    }
  }

  let mode = "group";
  if (totalAmountFromApi > 0) {
    const dGroup = Math.abs(totalAmountFromApi - incl_group);
    const dUnit = Math.abs(totalAmountFromApi - incl_unit);
    mode = dGroup <= dUnit ? "group" : "unit";
  }

  const baseTotal = mode === "group" ? base_group : base_unit;
  const vatTotal = mode === "group" ? vat_group : vat_unit;
  const taxTotalExVat = mode === "group" ? taxExVat_group : taxExVat_unit;

  const computedIncl = mode === "group" ? incl_group : incl_unit;
  const grandTotal =
    totalAmountFromApi > 0 && Math.abs(totalAmountFromApi - computedIncl) <= EPS
      ? totalAmountFromApi
      : totalAmountFromApi > 0
      ? totalAmountFromApi
      : computedIncl;

  const byType = mode === "group" ? byType_group : byType_unit;

  return {
    currency,
    baseTotal,
    taxTotalExVat,
    vatTotal,
    grandTotal,
    byType,
    rawRoot: root,
    meta: { mode, totalAmountFromApi, incl_group, incl_unit },
  };
}

export default function PriceDetailSkyBlue() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  const [params] = useSearchParams();

  const [pnrLoading, setPnrLoading] = useState(false);
  const [pnrError, setPnrError] = useState("");

  // Language
  const [lang, setLang] = useState(state?.lang === "th" ? "th" : "en");
  const t = STR[lang];

  // seats saved by passenger & journeyKey
  const savedSeats = useSelector(selectAllSavedSeats);

  // Debug from navigation state
  const debug = state?.debug || null;

  // Seat-map response for debug
  const seatRaw = state?.seatRaw ?? debug?.seatResponse ?? null;
  const seatError = state?.seatError ?? debug?.seatError ?? null;

  // Debug modals
  const [openPriceReq, setOpenPriceReq] = useState(false);
  const [openSeatReq, setOpenSeatReq] = useState(false);
  const [openSeatResp, setOpenSeatResp] = useState(false);
  const [copied, setCopied] = useState("");

  const onCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      /* no-op */
    }
  };

  // Refs for precise scrolling
  const headerRef = useRef(null);
  const passengerTopRef = useRef(null);

  // Snapshot for Cancel (restore old values)
  const snapshotRef = useRef({});

  // Responsive flags
  const isMobile = useMediaQuery("(max-width: 640px)", false);
  const isLGUp = useMediaQuery("(min-width: 1024px)", false);

  const [headerHeight, setHeaderHeight] = useState(64);
  useEffect(() => {
    const update = () => {
      const el = headerRef.current;
      const rect = el?.getBoundingClientRect?.();
      setHeaderHeight(rect?.height || 64);
    };
    update();
    if (typeof window !== "undefined") window.addEventListener("resize", update);

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      if (headerRef.current) ro.observe(headerRef.current);
    }
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);

  const scrollToPassengerTop = useCallback(() => {
    const sentinel = passengerTopRef.current;
    if (!sentinel || typeof window === "undefined") return;
    const rect = sentinel.getBoundingClientRect();
    const targetTop = Math.max(0, window.scrollY + rect.top - headerHeight - 8);
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [headerHeight]);

  // auto-scroll once on mobile
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    if (!isMobile) return;
    didAutoScrollRef.current = true;
    requestAnimationFrame(() => requestAnimationFrame(scrollToPassengerTop));
  }, [isMobile, scrollToPassengerTop]);

  /* ========================= selectedOffers auto-detect ========================= */
  const selectedOffers = useMemo(() => {
    const arr = Array.isArray(state?.selectedOffers) ? state.selectedOffers : null;
    if (arr && arr.length) {
      return arr
        .map((x) => ({
          fareKey: x?.fareKey || "",
          journeyKey: x?.journeyKey || "",
          securityToken: x?.securityToken || "",
        }))
        .filter((x) => x.fareKey || x.journeyKey || x.securityToken);
    }

    const oneFareKey = state?.fareKey || state?.selectedFareKey || "";
    const oneJourneyKey = state?.journeyKey || state?.selectedJourneyKey || "";
    const oneToken = state?.securityToken || "";
    if (oneFareKey || oneJourneyKey || oneToken) {
      return [{ fareKey: oneFareKey, journeyKey: oneJourneyKey, securityToken: oneToken }];
    }

    const dbg = state?.debug || null;
    const offers =
      dbg?.pricingRequest?.body?.offers ||
      dbg?.pricingRequest?.bodyPreview?.offers ||
      dbg?.bodyPreview?.offers ||
      dbg?.offers ||
      null;

    if (Array.isArray(offers) && offers.length) {
      return offers
        .map((o) => ({
          fareKey: o?.fareKey || "",
          journeyKey: o?.journeyKey || "",
          securityToken: o?.securityToken || oneToken || "",
        }))
        .filter((x) => x.fareKey || x.journeyKey || x.securityToken);
    }

    return [];
  }, [state]);

  const isRoundTripSelected = selectedOffers.length >= 2;

  // View/Hide keys card
  const [showKeys, setShowKeys] = useState(false);

  // Pricing (Redux)
  const requestKey = state?.requestKey || params.get("key") || null;
  const pricedFromStore = useSelector(
    useCallback((s) => (requestKey ? selectPriceFor(requestKey)(s) : null), [requestKey])
  );
  const rawDetail = pricedFromStore ?? state?.priceDetail ?? null;

  // first departure weekday
  const departWeekdayIdx = useMemo(() => {
    const iso = getFirstDepartIso({ selectedOffers, rawDetail });
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.getDay();
  }, [selectedOffers, rawDetail]);

  const fareSummary = useMemo(() => {
    if (!rawDetail) return null;
    return calcFareSummaryFromApi(rawDetail);
  }, [rawDetail]);

  const detail = useMemo(() => {
    if (!rawDetail) return null;
    const currency =
      fareSummary?.currency || rawDetail?.currency || rawDetail?.detail?.data?.currency || "THB";
    return { currency, raw: rawDetail };
  }, [rawDetail, fareSummary?.currency]);

  /* ===== Pax ===== */
  const pax = useMemo(() => {
    const apiCounts = paxFromFirstPricingDetails(detail?.raw ?? rawDetail ?? {});
    if (apiCounts.adult || apiCounts.child || apiCounts.infant) return apiCounts;

    const adtQ = parseInt(params.get("adt") || "", 10);
    const chdQ = parseInt(params.get("chd") || "", 10);
    const infQ = parseInt(params.get("inf") || "", 10);
    const fromState = state?.pax || {};
    return {
      adult: fromState.adult ?? (Number.isFinite(adtQ) ? adtQ : 1),
      child: fromState.child ?? (Number.isFinite(chdQ) ? chdQ : 0),
      infant: fromState.infant ?? (Number.isFinite(infQ) ? infQ : 0),
    };
  }, [detail?.raw, rawDetail, state?.pax, params]);

  // Travellers list
  const travellers = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= pax.adult; i++)
      arr.push({ id: `ADT-${i}`, type: "ADT", label: `${t.adult} ${i}` });
    for (let i = 1; i <= pax.child; i++)
      arr.push({ id: `CHD-${i}`, type: "CHD", label: `${t.child} ${i}` });
    for (let i = 1; i <= pax.infant; i++)
      arr.push({ id: `INF-${i}`, type: "INF", label: `${t.infant} ${i}` });
    return arr;
  }, [pax.adult, pax.child, pax.infant, t.adult, t.child, t.infant]);

  // Forms per traveller
  const [forms, setForms] = useState({});
  const [showForm, setShowForm] = useState({});

  useEffect(() => {
    setForms((prev) => {
      const next = { ...prev };
      for (const p of travellers) {
        if (!next[p.id]) next[p.id] = { gender: "M", country: "Thailand" };
      }
      return next;
    });

    setShowForm((prev) => {
      const next = { ...prev };
      if (travellers[0]?.id && typeof next[travellers[0].id] === "undefined") next[travellers[0].id] = true;
      for (const p of travellers.slice(1)) {
        if (typeof next[p.id] === "undefined") next[p.id] = false;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travellers.map((x) => x.id).join("|")]);

  const updateForm = useCallback((id, v) => setForms((f) => ({ ...f, [id]: { ...(f[id] || {}), ...v } })), []);

  // Complete = used for chip + Continue validation only
  const isComplete = useCallback((v) => Boolean(v?.firstName && v?.lastName && v?.dob), []);

  const firstAdultName = useMemo(() => {
    if (!travellers[0]) return "";
    const v = forms[travellers[0].id] || {};
    return v.firstName && v.lastName ? `${v.firstName} ${v.lastName}` : "";
  }, [travellers, forms]);

  const fmt = useCallback(
    (num, ccy) =>
      `${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`,
    []
  );

  /* ==== Contact information ==== */
  const [contact, setContact] = useState({ dialCode: "+66", phone: "", email: "", optIn: false });
  const [showContactErrors, setShowContactErrors] = useState(false);
  const contactValid = useMemo(() => contact.phone.trim() && contact.email.trim(), [contact.phone, contact.email]);

  const canContinue = useMemo(() => travellers.every((p) => isComplete(forms[p.id])) && contactValid, [
    travellers,
    forms,
    isComplete,
    contactValid,
  ]);

  // Add-ons still zero
  const currency = fareSummary?.currency || detail?.currency || "THB";
  const addOnTotal = 0;
  const grandTotal = (fareSummary?.grandTotal || 0) + addOnTotal;

  const containerPad = "px-3 sm:px-4";

  /* ========================= Ancillary buttons (PER PAX) ========================= */
  const ANCILLARY_TABS = useMemo(
    () => [
      { key: "seat", label: t.ancSeat || "Seat" },
      { key: "bag", label: t.ancBag || "Baggage" },
      { key: "meal", label: t.ancMeal || "Meal" },
      { key: "pb", label: t.ancPb || "Priority Board" },
      { key: "assist", label: t.ancAssist || "Assist" },
    ],
    [t.ancSeat, t.ancBag, t.ancMeal, t.ancPb, t.ancAssist]
  );

  const [activeAncByPax, setActiveAncByPax] = useState({});

  useEffect(() => {
    setActiveAncByPax((prev) => {
      const next = { ...prev };
      for (const p of travellers) {
        if (p.type === "INF") continue;
        if (typeof next[p.id] === "undefined") next[p.id] = null;
      }
      return next;
    });
  }, [travellers]);

  const TONE_CLASS = "brightness-95";

  const ancBtnClass = (active) => {
    if (!active) {
      return [
        "bg-sky-50",
        "border-2 border-sky-200",
        "text-sky-800",
        "hover:bg-sky-100",
        "hover:border-sky-300",
        "shadow-sm",
        TONE_CLASS,
      ].join(" ");
    }
    return `border-2 ${weekdayTheme(departWeekdayIdx)} shadow-sm ${TONE_CLASS}`;
  };

  // optional: if you pass holdResponse from FareSidebar navigate, keep it here later
  const holdResponseForPanel = state?.holdResponse || null;

  return (
    <div className="font-sans bg-gray-50 min-h-screen">
      {/* Header */}
      <PriceHeader
        headerRef={headerRef}
        containerPad={containerPad}
        lang={lang}
        setLang={setLang}
        t={t}
        scrollToPassengerTop={scrollToPassengerTop}
      />

      {/* Main */}
      <div className={`max-w-[1180px] mx-auto my-5 ${containerPad}`}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,70%)_minmax(0,30%)] gap-4">
          {/* LEFT */}
          <div className="space-y-4">
            {/* Flight summary panel on top */}
            <FlightSummaryPanel
              lang={lang}
              t={t}
              holdResponse={holdResponseForPanel}
              rawDetail={rawDetail}
              selectedOffers={selectedOffers}
            />

            <PassengersPanel
              passengerTopRef={passengerTopRef}
              t={t}
              travellers={travellers}
              forms={forms}
              showForm={showForm}
              setShowForm={setShowForm}
              updateForm={updateForm}
              isComplete={isComplete}
              firstAdultName={firstAdultName}
              normalizeDob={normalizeDob}
              formatDobDisplay={formatDobDisplay}
              formatAgeDisplay={formatAgeDisplay}
              titleFromForm={titleFromForm}
              genderLabel={genderLabel}
              snapshotRef={snapshotRef}
              scrollToPassengerTop={scrollToPassengerTop}
              ANCILLARY_TABS={ANCILLARY_TABS}
              activeAncByPax={activeAncByPax}
              setActiveAncByPax={setActiveAncByPax}
              ancBtnClass={ancBtnClass}
              contact={contact}
              setContact={setContact}
              showContactErrors={showContactErrors}
              selectedOffers={selectedOffers}
              rawDetail={rawDetail} // ✅ IMPORTANT for BaggagePanel
            />
          </div>

          {/* RIGHT */}
          <FareSidebar
            t={t}
            lang={lang}
            isLGUp={isLGUp}
            showKeys={showKeys}
            setShowKeys={setShowKeys}
            selectedOffers={selectedOffers}
            params={params}
            state={state}
            fareSummary={fareSummary}
            currency={currency}
            fmt={fmt}
            grandTotal={grandTotal}
            contactValid={contactValid}
            canContinue={canContinue}
            setShowContactErrors={setShowContactErrors}
            setPnrError={setPnrError}
            setPnrLoading={setPnrLoading}
            pnrLoading={pnrLoading}
            pnrError={pnrError}
            buildBookingPayload={buildBookingPayload}
            travellers={travellers}
            forms={forms}
            contact={contact}
            submitHoldBooking={submitHoldBooking}
            navigate={navigate}
            scrollToPassengerTop={scrollToPassengerTop}
            detail={detail}
            rawDetail={rawDetail}
            isRoundTripSelected={isRoundTripSelected}
            savedSeats={savedSeats}
          />
        </div>
      </div>

      {/* Debug modals (keep same behavior) */}
      <Modal open={openPriceReq} onClose={() => setOpenPriceReq(false)}>
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-extrabold">{t.requestPreview} — Price</div>
          <button onClick={() => setOpenPriceReq(false)} className="text-xl leading-none" aria-label={t.close} title={t.close}>
            ×
          </button>
        </div>
        <div className="p-4">
          {debug?.pricingRequest ? (
            <>
              <PrettyBlock
                title="cURL"
                actions={
                  <button
                    onClick={() => onCopy(buildCurl(debug.pricingRequest), "priceCurl")}
                    className="px-2 py-1 rounded border border-slate-300 bg-white text-xs"
                    title={t.copyCurl}
                  >
                    {copied === "priceCurl" ? t.curlCopied : t.copyCurl}
                  </button>
                }
              >
                <pre className="text-xs overflow-auto">{buildCurl(debug.pricingRequest)}</pre>
              </PrettyBlock>
              <div className="h-3" />
              <PrettyBlock title="JSON">
                <pre className="text-xs overflow-auto">{JSON.stringify(debug.pricingRequest, null, 2)}</pre>
              </PrettyBlock>
            </>
          ) : (
            <div className="text-sm text-slate-600">No pricing request available.</div>
          )}
        </div>
      </Modal>

      <Modal open={openSeatReq} onClose={() => setOpenSeatReq(false)}>
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-extrabold">{t.requestPreview} — Seat map</div>
          <button onClick={() => setOpenSeatReq(false)} className="text-xl leading-none" aria-label={t.close} title={t.close}>
            ×
          </button>
        </div>
        <div className="p-4">
          {debug?.seatRequest ? (
            <>
              <PrettyBlock
                title="cURL"
                actions={
                  <button
                    onClick={() => onCopy(buildCurl(debug.seatRequest), "seatCurl")}
                    className="px-2 py-1 rounded border border-slate-300 bg-white text-xs"
                    title={t.copyCurl}
                  >
                    {copied === "seatCurl" ? t.curlCopied : t.copyCurl}
                  </button>
                }
              >
                <pre className="text-xs overflow-auto">{buildCurl(debug.seatRequest)}</pre>
              </PrettyBlock>
              <div className="h-3" />
              <PrettyBlock title="JSON">
                <pre className="text-xs overflow-auto">{JSON.stringify(debug.seatRequest, null, 2)}</pre>
              </PrettyBlock>
            </>
          ) : (
            <div className="text-sm text-slate-600">No seat-map request available.</div>
          )}
        </div>
      </Modal>

      <Modal open={openSeatResp} onClose={() => setOpenSeatResp(false)}>
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-extrabold">{seatRaw ? t.seatRespTitle : t.seatErrorTitle}</div>
          <button onClick={() => setOpenSeatResp(false)} className="text-xl leading-none" aria-label={t.close} title={t.close}>
            ×
          </button>
        </div>
        <div className="p-4">
          {seatRaw ? (
            <PrettyBlock title="JSON">
              <pre className="text-xs overflow-auto">{typeof seatRaw === "string" ? seatRaw : JSON.stringify(seatRaw, null, 2)}</pre>
            </PrettyBlock>
          ) : seatError ? (
            <PrettyBlock title="Error">
              <pre className="text-xs overflow-auto">{String(seatError)}</pre>
            </PrettyBlock>
          ) : (
            <div className="text-sm text-slate-600">{t.noSeatResponse}</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
