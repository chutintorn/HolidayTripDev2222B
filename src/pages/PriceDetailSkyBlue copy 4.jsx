// src/pages/PriceDetailSkyBlue.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectPriceFor } from "../redux/pricingSlice";

// Components
import TravellerForm from "../components/TravellerForm";
import BundleCard from "../components/BundleCard";
import ContactInformation from "../components/ContactInformation";
import RowCard from "../components/RowCard";
import Chip from "../components/Chip";
import Modal from "../components/Modal";
import PrettyBlock from "../components/PrettyBlock";

// Utils
import { paxFromFirstPricingDetails, extractLegs, hhmm, formatDDMMM } from "../utils/pricingHelpers";

/* ========================= Strings ========================= */
const STR = {
  en: {
    title: "Passenger details",
    travellers: "Travellers",
    adult: "Adult",
    child: "Child",
    infant: "Infant",
    completed: "Completed",
    incomplete: "Incomplete",
    passengerDetails: "Passenger details",
    male: "Male",
    female: "Female",
    firstName: "First/Given name",
    lastName: "Family name/Surname",
    country: "Country/Region",
    dob: "Date of birth (DD/MM/YYYY)",
    memberId: "Nok Holiday member ID",
    email: "Email address (optional)",
    earnPoints: "Earn Nok Holiday points for this guest",
    search: "Search",
    save: "Save",
    cancel: "Cancel",
    fillDetails: "Fill details",
    edit: "Edit",
    contact: "Contact Information",
    travellingWith: "Travelling with",
    // right
    priceSummary: "Fare summary",
    baseFare: "Base fare",
    tax: "Taxes, fees & surcharges",
    addons: "Add-ons",
    total: "Total amount",
    continue: "Continue",
    back: "Back",
    noKey: "No request key. Please go back and select a fare.",
    noDetail: "No price detail found. Please select an offer again.",
    raw: "Show raw response",
    required: "This field is required",
    pointsAfter: "Points rewarded after flight:",
    points: "points",
    mobilePhone: "Mobile Phone",
    emailAddress: "E-mail",
    marketingOptIn:
      "I would like to receive news and special offers from Nok Holiday and accept the privacy policy.",
    depart: "Depart",
    ret: "Return",
    addOnBundles: "Add-on bundles",
    selectOneBundle: "Select one of the bundles",
    included: "Included",
    segment: "Segment",
    // debug
    viewPriceReq: "View price request",
    viewSeatReq: "View seat-map request",
    viewSeatResp: "View seat-map response",
    seatRespTitle: "Seat-map response",
    seatErrorTitle: "Seat-map error",
    close: "Close",
    requestPreview: "Request preview",
    copyCurl: "Copy cURL",
    curlCopied: "Copied!",
    noSeatResponse: "No seat-map response available.",
  },
  th: {
    title: "รายละเอียดผู้โดยสาร",
    travellers: "ผู้โดยสาร",
    adult: "ผู้ใหญ่",
    child: "เด็ก",
    infant: "ทารก",
    completed: "เสร็จสิ้น",
    incomplete: "ไม่สมบูรณ์",
    passengerDetails: "รายละเอียดผู้โดยสาร",
    male: "ชาย",
    female: "หญิง",
    firstName: "ชื่อ",
    lastName: "นามสกุล",
    country: "ประเทศ/ภูมิภาค",
    dob: "วันเกิด (วัน/เดือน/ปี)",
    memberId: "รหัสสมาชิก Nok Holiday",
    email: "อีเมล (ไม่บังคับ)",
    earnPoints: "สะสมคะแนน Nok Holiday สำหรับผู้โดยสารนี้",
    search: "ค้นหา",
    save: "บันทึก",
    cancel: "ยกเลิก",
    fillDetails: "กรอกข้อมูล",
    edit: "แก้ไข",
    contact: "ข้อมูลการติดต่อ",
    travellingWith: "เดินทางกับ",
    // right
    priceSummary: "สรุปค่าโดยสาร",
    baseFare: "ค่าโดยสารพื้นฐาน",
    tax: "ภาษีและค่าธรรมเนียม",
    addons: "ส่วนเสริม",
    total: "ยอดรวม",
    continue: "ดำเนินการต่อ",
    back: "ย้อนกลับ",
    noKey: "ไม่พบรหัสคำขอ กรุณาย้อนกลับและเลือกค่าโดยสารอีกครั้ง",
    noDetail: "ไม่พบรายละเอียดราคา กรุณาเลือกเที่ยวบินอีกครั้ง",
    raw: "แสดงข้อมูลดิบ",
    required: "ต้องระบุ",
    pointsAfter: "คะแนนที่จะได้รับหลังเดินทาง:",
    points: "คะแนน",
    mobilePhone: "เบอร์มือถือ",
    emailAddress: "อีเมล",
    marketingOptIn:
      "ฉันต้องการรับข่าวสารและข้อเสนอพิเศษจาก Nok Holiday และยอมรับนโยบายความเป็นส่วนตัว",
    depart: "ขาไป",
    ret: "ขากลับ",
    addOnBundles: "แพ็กเกจเสริม",
    selectOneBundle: "เลือก 1 แพ็กเกจ",
    included: "รวมในราคา",
    segment: "ช่วงบิน",
    // debug
    viewPriceReq: "ดูคำขอราคาค่าโดยสาร",
    viewSeatReq: "ดูคำขอแผนผังที่นั่ง",
    viewSeatResp: "ดูผลลัพธ์แผนผังที่นั่ง",
    seatRespTitle: "ผลลัพธ์แผนผังที่นั่ง",
    seatErrorTitle: "ข้อผิดพลาดแผนผังที่นั่ง",
    close: "ปิด",
    requestPreview: "พรีวิวคำขอ",
    copyCurl: "คัดลอก cURL",
    curlCopied: "คัดลอกแล้ว!",
    noSeatResponse: "ไม่มีผลลัพธ์แผนผังที่นั่ง",
  },
};

/* ===== Debug helpers (for viewing requests) ===== */
function buildCurl({ url, method = "POST", headers = {}, body = null }) {
  const h = Object.entries(headers)
    .map(([k, v]) => `-H ${JSON.stringify(`${k}: ${v}`)}`)
    .join(" ");
  const d = body ? `--data '${JSON.stringify(body)}'` : "";
  return `curl -X ${method} ${h} ${d} ${JSON.stringify(url)}`;
}

/* ========================= Page ========================= */
export default function PriceDetailSkyBlue() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  const [params] = useSearchParams();

  // Language
  const [lang, setLang] = useState(state?.lang === "th" ? "th" : "en");
  const t = STR[lang];

  // Debug from navigation state
  const debug = state?.debug || null;

  // ----- Seat-map response (success or error) -----
  const seatRaw = state?.seatRaw ?? debug?.seatResponse ?? null;
  const seatError = state?.seatError ?? debug?.seatError ?? null;
  const hasSeatResult = Boolean(seatRaw || seatError);

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

  // Mobile / Desktop-TV flags (stable)
  const isMobile = useMemo(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia("(max-width: 640px)").matches
        : false,
    []
  );
  const isDesktopOrTV = useMemo(() => {
    if (typeof window === "undefined") return false;
    const mqDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const looksTV = /Tizen|SmartTV|AppleTV|HbbTV|Web0S|WebOS|NetCast|Roku/i.test(ua);
    const mqTV = window.matchMedia("(min-width: 1600px)").matches || looksTV;
    return mqDesktop || mqTV;
  }, []);
  const didAutoScrollRef = useRef(false);

  /* ===== Smooth, header-aware scroll helper ===== */
  const [headerHeight, setHeaderHeight] = useState(64);
  useEffect(() => {
    const update = () => {
      const el = headerRef.current;
      const rect = el?.getBoundingClientRect?.();
      setHeaderHeight(rect?.height || 64);
    };
    update();
    window.addEventListener("resize", update);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      if (headerRef.current) ro.observe(headerRef.current);
    }
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);

  const scrollToPassengerTop = useCallback(() => {
    const sentinel = passengerTopRef.current;
    if (!sentinel) return;
    const rect = sentinel.getBoundingClientRect();
    const targetTop = Math.max(0, window.scrollY + rect.top - headerHeight - 8);
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [headerHeight]);

  // 🔝 On mount: scroll smoothly to the passenger box for mobile **and** desktop/TV
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    if (!(isMobile || isDesktopOrTV)) return;

    didAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToPassengerTop();
      });
    });
  }, [isMobile, isDesktopOrTV, scrollToPassengerTop]);

  // Pricing (Redux)
  const requestKey = state?.requestKey || params.get("key") || null;
  const pricedFromStore = useSelector(
    useCallback(
      (s) => (requestKey ? selectPriceFor(requestKey)(s) : null),
      [requestKey]
    )
  );
  const rawDetail = pricedFromStore ?? state?.priceDetail ?? null;

  // Normalize pricing for the summary
  const detail = useMemo(() => {
    if (!rawDetail) return null;
    const d = Array.isArray(rawDetail) ? rawDetail[0] : rawDetail;
    const currency =
      d?.currency || d?.currencyCode || d?.totalCurrency || d?.priceCurrency || "THB";
    const base = d?.baseFareAmount ?? d?.baseFare ?? d?.base ?? d?.fareAmount ?? 0;
    const tax = d?.taxAmount ?? d?.tax ?? d?.taxes ?? 0;
    const totalExplicit = d?.totalAmount ?? d?.total ?? d?.grandTotal ?? d?.priceTotal;
    const total =
      typeof totalExplicit === "number" ? totalExplicit : Number(base) + Number(tax);
    return {
      baseFareAmount: Number(base) || 0,
      taxAmount: Number(tax) || 0,
      totalAmount: Number(total) || 0,
      currency,
      raw: d,
    };
  }, [rawDetail]);

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

  // Forms per traveller + which modal is open
  const [forms, setForms] = useState({});
  const [openId, setOpenId] = useState(null);

  // Ensure Adult 1 has defaults
  useEffect(() => {
    if (travellers[0] && !forms[travellers[0].id]) {
      setForms((f) => ({
        ...f,
        [travellers[0].id]: { gender: "M", country: "Thailand" },
      }));
    }
  }, [travellers, forms]);

  const updateForm = useCallback(
    (id, v) => setForms((f) => ({ ...f, [id]: { ...(f[id] || {}), ...v } })),
    []
  );

  const saveModal = useCallback(
    (id, v) => {
      updateForm(id, v);
      setOpenId(null);
      requestAnimationFrame(() => scrollToPassengerTop());
    },
    [updateForm, scrollToPassengerTop]
  );

  const isComplete = useCallback((v) => v && v.firstName && v.lastName && v.dob, []);

  const firstAdultName = useMemo(
    () =>
      travellers[0] &&
      forms[travellers[0].id]?.firstName &&
      forms[travellers[0].id]?.lastName
        ? `${forms[travellers[0].id].firstName} ${forms[travellers[0].id].lastName}`
        : "",
    [travellers, forms]
  );

  const fmt = useCallback(
    (n, ccy) =>
      `${Number(n).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${ccy}`,
    []
  );

  /* ==== Bundles ==== */
  const [selectedBundles, setSelectedBundles] = useState({});
  const bundles = useMemo(
    () => [
      {
        id: "lite",
        title: "Value Pack Lite",
        subtitle: lang === "th" ? "ประหยัดสูงสุด 30%" : "Save up to 30%",
        features: [
          lang === "th" ? "สัมภาระขึ้นเครื่อง 7 กก." : "7 kg carry-on baggage",
          lang === "th" ? "น้ำหนักสัมภาระ 15 กก." : "15 kg baggage allowance",
          lang === "th" ? "ที่นั่งมาตรฐาน" : "Standard seat",
        ],
        addOnAmount: 0,
        accent: "#3b82f6",
      },
      {
        id: "value",
        title: "Value Pack",
        subtitle: lang === "th" ? "ประหยัดสูงสุด 30%" : "Save up to 30%",
        features: [
          "7 kg carry-on baggage",
          "20 kg baggage allowance",
          "Standard seat",
          "1 meal",
          "Duty Free RM50 Voucher",
          lang === "th" ? "ประกัน Lite (Tune Protect)" : "Lite Insurance (Tune Protect)",
        ],
        addOnAmount: 250.0,
        accent: "#f59e0b",
      },
      {
        id: "premium",
        title: "Premium Flex",
        subtitle: lang === "th" ? "ประหยัดสูงสุด 20%" : "Save up to 20%",
        features: ["7 kg carry-on baggage", "20 kg baggage allowance", "Standard/Hot seat"],
        addOnAmount: 450.0,
        accent: "#f43f5e",
      },
    ],
    [lang]
  );

  // 🔎 Legs from detail.raw / whole API
  const legs = useMemo(() => {
    const d = detail?.raw || {};
    const found = extractLegs(d);
    return found.length
      ? found
      : [
          { key: "OUT-1", origin: "", destination: "", depTime: null, arrTime: null, fn: "", dir: "OUT" },
        ];
  }, [detail?.raw]);

  useEffect(() => {
    setSelectedBundles((prev) => {
      const next = { ...prev };
      for (const leg of legs) if (!next[leg.key]) next[leg.key] = "value";
      return next;
    });
  }, [legs]);

  const setBundleForLeg = useCallback(
    (legKey, bundleId) => setSelectedBundles((s) => ({ ...s, [legKey]: bundleId })),
    []
  );

  /* ==== Contact information ==== */
  const [contact, setContact] = useState({ dialCode: "+66", phone: "", email: "", optIn: false });
  const [showContactErrors, setShowContactErrors] = useState(false);
  const contactValid = useMemo(() => contact.phone.trim() && contact.email.trim(), [contact.phone, contact.email]);
  const canContinue = useMemo(
    () => travellers.every((p) => isComplete(forms[p.id])) && contactValid,
    [travellers, forms, isComplete, contactValid]
  );

  // totals: sum add-on across legs
  const currency = detail?.currency || "THB";
  const addOnTotal = useMemo(
    () =>
      legs.reduce((sum, leg) => {
        const bId = selectedBundles[leg.key];
        const b = bundles.find((x) => x.id === bId);
        return sum + (b?.addOnAmount || 0);
      }, 0),
    [legs, selectedBundles, bundles]
  );
  const grandTotal = detail ? detail.totalAmount + addOnTotal : addOnTotal;

  /* ====================================================
     UI
  ==================================================== */
  return (
    <div className="font-sans bg-gray-50 min-h-screen">
      {/* Nok Holiday themed header */}
      <div ref={headerRef} className="sticky top-0 z-20 w-full border-b bg-[#e3f8ff]" style={{ minHeight: 64 }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          {/* Brand + logo */}
          <div className="flex items-center gap-3">
            <Link to="/" className="group flex items-center gap-3" aria-label="Go to homepage">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHBKoufNO6L_f1AvGmnvXR7b5TfMiDQGjH6w&s"
                alt="Nok Holiday logo"
                className="h-8 w-8 rounded"
                width={32}
                height={32}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="font-bold text-[170%] text-blue-600 tracking-tight transition-colors duration-300 group-hover:text-[#ffe657]">
                Nok Holiday
              </span>
            </Link>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setLang("th");
                requestAnimationFrame(() => scrollToPassengerTop());
              }}
              className={`px-3 py-1 border rounded ${lang === "th" ? "bg-blue-600 text-white" : "border-blue-600 text-blue-600"}`}
            >
              ไทย
            </button>
            <button
              onClick={() => {
                setLang("en");
                requestAnimationFrame(() => scrollToPassengerTop());
              }}
              className={`px-3 py-1 border rounded ${lang === "en" ? "bg-blue-600 text-white" : "border-blue-600 text-blue-600"}`}
            >
              English
            </button>
          </div>
        </div>

        {/* Page title row */}
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <h1 className="text-xl font-bold text-blue-600">{t.title}</h1>
        </div>
      </div>

      {/* Main layout */}
      <div className="max-w-[1180px] mx-auto my-5 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-4">
          {/* LEFT */}
          <div>
            {/* Sentinel for precise "scroll to top of passenger box" */}
            <div ref={passengerTopRef} className="h-0" />

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h2 className="text-lg font-semibold mb-3">{t.travellers}</h2>

              {/* Adult 1 block */}
              {travellers[0] && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold">
                    <div>{travellers[0].label}</div>
                    <Chip ok={isComplete(forms[travellers[0].id])}>
                      {isComplete(forms[travellers[0].id]) ? t.completed : t.incomplete}
                    </Chip>
                  </div>

                  <TravellerForm
                    t={t}
                    value={forms[travellers[0].id]}
                    onChange={(v) => updateForm(travellers[0].id, v)}
                    onSave={(v) => updateForm(travellers[0].id, v)}
                    showSave={false}
                    points={95}
                  />
                </div>
              )}

              {/* Other travellers */}
              <div className="flex flex-col gap-2">
                {travellers.slice(1).map((p) => (
                  <RowCard
                    key={p.id}
                    left={
                      <>
                        <div className="font-bold">{p.label}</div>
                        <Chip ok={isComplete(forms[p.id])}>
                          {isComplete(forms[p.id]) ? STR[lang].completed : STR[lang].incomplete}
                        </Chip>
                        {p.type === "INF" && firstAdultName && (
                          <span className="ml-2 text-sky-900 text-sm">
                            {STR[lang].travellingWith} {firstAdultName}
                          </span>
                        )}
                      </>
                    }
                    right={isComplete(forms[p.id]) ? STR[lang].edit : STR[lang].fillDetails}
                    onClick={() => setOpenId(p.id)}
                  />
                ))}

                {/* Contact Information */}
                <ContactInformation t={t} value={contact} onChange={setContact} showErrors={showContactErrors} />

                {/* ===== Bundle groups: one per segment ===== */}
                <div className="mt-5">
                  {legs.map((leg, idx) => {
                    const labelGuess = leg.dir === "IN" ? t.ret : leg.dir === "OUT" ? t.depart : `${t.segment} ${idx + 1}`;

                    const name = `bundle-${leg.key}`;
                    const headerText = [
                      leg.origin && leg.destination ? `${leg.origin} → ${leg.destination}` : null,
                      leg.fn ? leg.fn : null,
                      leg.depTime ? `${formatDDMMM(leg.depTime)} ${hhmm(leg.depTime)}` : null,
                      leg.arrTime ? `→ ${hhmm(leg.arrTime)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" • ");

                    return (
                      <div key={leg.key} className="mb-4 p-3 rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-green-600 text-white grid place-items-center font-extrabold flex-shrink-0">
                            ★
                          </div>
                          <div className="text-base font-extrabold">
                            {labelGuess} {headerText ? `• ${headerText}` : ""}
                          </div>
                        </div>

                        <div className="text-slate-600 text-sm mt-2 mb-3">{t.selectOneBundle}</div>

                        <div className="flex flex-col gap-2">
                          {bundles.map((b) => (
                            <BundleCard
                              key={`${leg.key}-${b.id}`}
                              name={name}
                              checked={selectedBundles[leg.key] === b.id}
                              onChange={() => setBundleForLeg(leg.key, b.id)}
                              title={b.title}
                              subtitle={b.subtitle}
                              features={b.features}
                              priceLabel={
                                b.addOnAmount > 0
                                  ? `${fmt(b.addOnAmount, detail?.currency || "THB")}`
                                  : lang === "th"
                                  ? STR.th.included
                                  : STR.en.included
                              }
                              accent={b.accent}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Fare summary */}
          <aside className="bg-white border border-slate-200 rounded-2xl p-4 h-fit sticky top-20">
            <h3 className="text-lg font-semibold mb-3">{t.priceSummary}</h3>

            {!requestKey && !state?.priceDetail && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 mb-3">{t.noKey}</div>
            )}

            {detail ? (
              <>
                <div className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                  <div className="text-slate-600">{t.baseFare}</div>
                  <div className="font-semibold">{fmt(detail.baseFareAmount, currency)}</div>

                  <div className="text-slate-600">{t.tax}</div>
                  <div className="font-semibold">{fmt(detail.taxAmount, currency)}</div>

                  <div className="text-slate-600">{t.addons}</div>
                  <div className="font-semibold">{fmt(addOnTotal, currency)}</div>

                  <div className="h-px bg-slate-200 col-span-full my-1" />

                  <div className="text-emerald-900 font-bold">{t.total}</div>
                  <div className="text-xl text-sky-700 font-extrabold">{fmt(grandTotal, currency)}</div>
                </div>

                {(debug || hasSeatResult) && (
                  <div className="mt-4 grid gap-2">
                    <PrettyBlock title="Debug">
                      <div className="flex flex-col sm:flex-row gap-2">
                        {debug?.pricingRequest && (
                          <button
                            onClick={() => setOpenPriceReq(true)}
                            className="px-3 py-2 rounded-md border border-slate-300 hover:border-blue-400 hover:text-blue-700 bg-white text-sm"
                          >
                            {t.viewPriceReq}
                          </button>
                        )}
                        {debug?.seatRequest && (
                          <button
                            onClick={() => setOpenSeatReq(true)}
                            className="px-3 py-2 rounded-md border border-slate-300 hover:border-blue-400 hover:text-blue-700 bg-white text-sm"
                          >
                            {t.viewSeatReq}
                          </button>
                        )}
                        {hasSeatResult && (
                          <button
                            onClick={() => setOpenSeatResp(true)}
                            className="px-3 py-2 rounded-md border border-slate-300 hover:border-blue-400 hover:text-blue-700 bg-white text-sm"
                          >
                            {t.viewSeatResp}
                          </button>
                        )}
                      </div>
                    </PrettyBlock>
                  </div>
                )}

                <button
                  disabled={!canContinue}
                  className={`mt-4 w-full px-4 py-3 rounded-full font-bold text-white ${
                    canContinue ? "bg-sky-500 hover:bg-sky-600" : "bg-gray-400 cursor-not-allowed"
                  }`}
                  onClick={() => {
                    if (!contactValid) setShowContactErrors(true);
                    if (!canContinue) return;
                    alert(
                      "✅ Continue to seats / add-ons.\n\n" +
                        JSON.stringify({ pax, forms, contact, selectedBundles, legs }, null, 2)
                    );
                    requestAnimationFrame(() => scrollToPassengerTop());
                  }}
                >
                  {t.continue}
                </button>

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      navigate(-1);
                      requestAnimationFrame(() => scrollToPassengerTop());
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    {t.back}
                  </button>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-slate-600">{t.raw}</summary>
                  <pre className="bg-slate-100 border border-slate-200 rounded p-2 overflow-x-auto text-xs mt-2">
                    {JSON.stringify(detail.raw, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              (requestKey || state?.priceDetail) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800">{t.noDetail}</div>
              )
            )}
          </aside>
        </div>
      </div>

      {/* Modal for secondary travellers */}
      <Modal
        open={!!openId}
        onClose={() => {
          setOpenId(null);
          requestAnimationFrame(() => scrollToPassengerTop());
        }}
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-extrabold">{t.passengerDetails}</div>
          <button
            onClick={() => {
              setOpenId(null);
              requestAnimationFrame(() => scrollToPassengerTop());
            }}
            className="text-xl leading-none"
            aria-label={t.cancel}
            title={t.cancel}
          >
            ×
          </button>
        </div>
        {openId && (
          <TravellerForm
            t={t}
            value={forms[openId] || { gender: "M", country: "Thailand" }}
            onChange={(v) => updateForm(openId, v)}
            onSave={(v) => saveModal(openId, v)}
            showSave={true}
          />
        )}
      </Modal>

      {/* ===== Debug: Price request modal ===== */}
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

      {/* ===== Debug: Seat-map request modal ===== */}
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

      {/* ===== Debug: Seat-map RESPONSE modal ===== */}
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
