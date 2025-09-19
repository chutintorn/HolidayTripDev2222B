// src/pages/PriceDetailSkyBlue.jsx
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  memo,
  useRef,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectPriceFor } from "../redux/pricingSlice";

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
  },
};

/* ========================= Helpers ========================= */
function firstPricingDetailsBucket(root) {
  if (!root || typeof root !== "object") return null;
  if (Array.isArray(root.pricingDetails)) return root.pricingDetails;
  if (root.data && Array.isArray(root.data.pricingDetails))
    return root.data.pricingDetails;
  if (Array.isArray(root.airlines) && root.airlines[0]?.pricingDetails)
    return Array.isArray(root.airlines[0].pricingDetails)
      ? root.airlines[0].pricingDetails
      : null;
  if (
    root.data &&
    Array.isArray(root.data.airlines) &&
    root.data.airlines[0]?.pricingDetails
  )
    return Array.isArray(root.data.airlines[0].pricingDetails)
      ? root.data.airlines[0].pricingDetails
      : null;
  return null;
}

function paxFromFirstPricingDetails(detailLike) {
  const arr = firstPricingDetailsBucket(detailLike);
  const out = { adult: 0, child: 0, infant: 0 };
  if (!Array.isArray(arr)) {
    out.adult = 1;
    return out;
  }
  arr.forEach((p) => {
    const code = String(p?.paxTypeCode ?? p?.pax_type ?? "").toLowerCase();
    const n = Number(p?.paxCount ?? p?.count ?? 0) || 0;
    if (/^(adult|adt)$/.test(code)) out.adult += n;
    else if (/^(child|chd)$/.test(code)) out.child += n;
    else if (/^(infant|inf)$/.test(code)) out.infant += n;
  });
  if (!out.adult) out.adult = 1;
  return out;
}

function safeDate(s) {
  if (!s) return null;
  const str = typeof s === "string" ? s.replace(" ", "T") : s;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDDMMM(d) {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = [
    "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
  ][d.getMonth()];
  return `${dd}-${mon}`;
}

function hhmm(d) {
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/* ====== Segment extraction ====== */
function looksLikeSegment(x) {
  if (!x || typeof x !== "object") return false;
  const o = x.origin || x.from || x.depAirport || x.departureAirport;
  const d = x.destination || x.to || x.arrAirport || x.arrivalAirport;
  const dep =
    x.departureTime ||
    x.departureDateTime ||
    x.dep ||
    x.depTime ||
    x.std ||
    x.offBlockTime;
  return Boolean(o && d && dep);
}

function deepCollectSegments(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const v of node) deepCollectSegments(v, out);
    return out;
  }
  if (typeof node === "object") {
    if (looksLikeSegment(node)) out.push(node);
    for (const k of Object.keys(node)) deepCollectSegments(node[k], out);
    return out;
  }
  return out;
}

function normalizeSegment(x) {
  return {
    origin: x.origin || x.from || x.depAirport || x.departureAirport || "",
    destination: x.destination || x.to || x.arrAirport || x.arrivalAirport || "",
    depTime: safeDate(
      x.departureTime ||
        x.departureDateTime ||
        x.depTime ||
        x.dep ||
        x.std ||
        x.offBlockTime
    ),
    arrTime: safeDate(
      x.arrivalTime ||
        x.arrivalDateTime ||
        x.arrTime ||
        x.arr ||
        x.sta ||
        x.onBlockTime
    ),
    fn: x.flightNumber || x.flightNo || x.fn || x.marketingFlightNumber || "",
    dir: (x.direction || x.dir || "").toString().toUpperCase(),
  };
}

function extractLegs(raw) {
  if (!raw) return [];

  const roots = Array.isArray(raw) ? raw : [raw];
  const bucket = new Map();

  for (const root of roots) {
    const segs = deepCollectSegments(root);
    const maybeRootSeg = looksLikeSegment(root) ? [root] : [];
    const all = [...segs, ...maybeRootSeg];

    for (const s of all) {
      const n = normalizeSegment(s);
      if (!n.fn || !n.depTime || !n.origin || !n.destination) continue;
      const key = `${n.origin}|${n.destination}|${n.depTime.toISOString()}`;
      if (!bucket.has(key)) bucket.set(key, n);
    }
  }

  const cleaned = [...bucket.values()].sort((a, b) => a.depTime - b.depTime);

  return cleaned.map((n, i) => {
    const inferred =
      n.dir === "OUT" || n.dir === "IN"
        ? n.dir
        : i === 0
        ? "OUT"
        : i === 1
        ? "IN"
        : `SEG-${i + 1}`;
    return {
      key: `${inferred}-${i + 1}`,
      origin: n.origin,
      destination: n.destination,
      depTime: n.depTime,
      arrTime: n.arrTime,
      fn: n.fn,
      dir: inferred,
    };
  });
}

/* ===== UI bits ===== */
const Chip = memo(function Chip({ ok, children }) {
  return (
    <span
      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
        ok
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-sky-50 text-sky-800 border border-sky-200"
      }`}
    >
      {children}
    </span>
  );
});

const RowCard = memo(function RowCard({ left, right, onClick }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white flex items-center justify-between">
      <div className="flex items-center gap-3">{left}</div>
      <button
        onClick={onClick}
        className="px-3 py-2 rounded-lg border border-cyan-500 text-cyan-700 font-semibold min-w-[110px]"
      >
        {right}
      </button>
    </div>
  );
});

/* ============== Simple Modal ============== */
const Modal = memo(function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 will-change-transform"
      onClick={onClose}
    >
      <div
        className="w-[92vw] max-w-3xl max-h-[90vh] overflow-auto bg-white rounded-xl border border-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
});

/* ============== Traveller Form ============== */
const TravellerForm = memo(function TravellerForm({
  t,
  value,
  onChange,
  onSave,
  showSave = true,
  points = 95,
}) {
  const [local, setLocal] = useState(value || {});
  const [errors, setErrors] = useState({});

  useEffect(() => setLocal(value || {}), [value]);

  const set = useCallback((k, v) => {
    const next = { ...local, [k]: v };
    setLocal(next);
    onChange?.(next);
  }, [local, onChange]);

  const required = useCallback(
    (k) => ((local[k] || "").trim()).length > 0,
    [local]
  );

  const validate = useCallback(() => {
    const e = {};
    ["firstName", "lastName", "dob"].forEach((k) => {
      if (!required(k)) e[k] = t.required;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [required, t.required]);

  const save = useCallback(() => {
    if (!validate()) return;
    onSave?.(local);
  }, [local, onSave, validate]);

  return (
    <div className="p-4">
      {/* Gender */}
      <div className="mb-3">
        <div className="text-sm text-slate-600 mb-1">{t.passengerDetails}</div>
        <div className="inline-flex border border-slate-300 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => set("gender", "M")}
            className={`px-3 py-2 text-sm ${
              local.gender === "M" ? "bg-sky-50 text-sky-700" : "bg-white text-slate-800"
            }`}
          >
            {t.male}
          </button>
          <button
            type="button"
            onClick={() => set("gender", "F")}
            className={`px-3 py-2 text-sm border-l border-slate-300 ${
              local.gender === "F" ? "bg-sky-50 text-sky-700" : "bg-white text-slate-800"
            }`}
          >
            {t.female}
          </button>
        </div>
      </div>

      {/* Names */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <input
            placeholder={t.firstName}
            value={local.firstName || ""}
            onChange={(e) => set("firstName", e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              errors.firstName ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.firstName && (
            <div className="text-red-600 text-xs mt-1">{t.required}</div>
          )}
        </div>
        <div>
          <input
            placeholder={t.lastName}
            value={local.lastName || ""}
            onChange={(e) => set("lastName", e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              errors.lastName ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.lastName && (
            <div className="text-red-600 text-xs mt-1">{t.required}</div>
          )}
        </div>
      </div>

      {/* Country + DOB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div>
          <select
            value={local.country || "Thailand"}
            onChange={(e) => set("country", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option>Thailand</option>
            <option>Singapore</option>
            <option>Malaysia</option>
            <option>Vietnam</option>
            <option>Indonesia</option>
          </select>
        </div>
        <div>
          <input
            placeholder={t.dob}
            value={local.dob || ""}
            onChange={(e) => set("dob", e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              errors.dob ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.dob && (
            <div className="text-red-600 text-xs mt-1">{t.required}</div>
          )}
        </div>
      </div>

      {/* Member & email (lookup) */}
      <div className="mt-3">
        <input
          placeholder={t.memberId}
          value={local.memberId || ""}
          onChange={(e) => set("memberId", e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3"
        />
        <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
          <div className="text-slate-900 mb-2">• {t.earnPoints}</div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <input
              placeholder={t.email}
              value={local.email || ""}
              onChange={(e) => set("email", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-cyan-500 text-cyan-700 font-semibold bg-white"
              onClick={() => alert("🔎 Lookup member by email (stub)")}
            >
              {t.search}
            </button>
          </div>
        </div>

        <div className="mt-3 text-slate-900">
          {t.pointsAfter} <span className="font-bold">95 {t.points}</span>
        </div>
      </div>

      {showSave && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={save}
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold"
          >
            {t.save}
          </button>
        </div>
      )}
    </div>
  );
});

/* ========================= Bundle Selector ========================= */
const BundleCard = memo(function BundleCard({
  name,
  checked,
  onChange,
  title,
  subtitle,
  features,
  priceLabel,
  accent = "#3b82f6",
}) {
  return (
    <label
      className={`flex items-start gap-3 border-2 rounded-xl p-3 cursor-pointer w-full ${
        checked ? "bg-sky-50" : "bg-white"
      }`}
      style={{ borderColor: checked ? accent : "#e5e7eb" }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1"
      />
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-extrabold">{title}</div>
            <div className="text-blue-600 text-xs font-semibold">{subtitle}</div>
          </div>
          {priceLabel && (
            <div className="font-bold whitespace-nowrap">{priceLabel}</div>
          )}
        </div>
        <ul className="mt-2 ml-5 text-slate-700 text-sm list-disc">
          {features.map((f, i) => (
            <li key={i} className="mb-1">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </label>
  );
});

/* ========================= Contact Information ========================= */
const ContactInformation = memo(function ContactInformation({
  t,
  value,
  onChange,
  showErrors,
}) {
  const [local, setLocal] = useState(
    value || { dialCode: "+66", phone: "", email: "", optIn: false }
  );

  useEffect(
    () => setLocal(value || { dialCode: "+66", phone: "", email: "", optIn: false }),
    [value]
  );

  const set = useCallback((k, v) => {
    const next = { ...local, [k]: v };
    setLocal(next);
    onChange?.(next);
  }, [local, onChange]);

  const phoneErr = showErrors && !local.phone.trim();
  const emailErr = showErrors && !local.email.trim();

  const label = useCallback(
    (text) => (
      <span>
        {text} <span className="text-red-500">*</span>
      </span>
    ),
    []
  );

  return (
    <div className="mt-3 bg-slate-100 rounded-xl p-4 border border-slate-300">
      <h3 className="mt-0 text-base font-semibold">{t.contact}</h3>

      <div className="grid grid-cols-[140px_1fr] max-[480px]:grid-cols-1 gap-2">
        <div>
          <div className="text-xs text-slate-600 mb-1">{label("+ Code")}</div>
          <select
            value={local.dialCode}
            onChange={(e) => set("dialCode", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="+66">+66</option>
            <option value="+60">+60</option>
            <option value="+65">+65</option>
            <option value="+84">+84</option>
            <option value="+62">+62</option>
          </select>
        </div>

        <div>
          <div className="text-xs text-slate-600 mb-1">{label(t.emailAddress)}</div>
          <input
            value={local.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="name@example.com"
            className={`w-full rounded-lg border px-3 py-2 bg-white ${
              emailErr ? "border-red-400" : "border-slate-300"
            }`}
          />
          {emailErr && (
            <div className="text-red-600 text-xs mt-1">{t.required}</div>
          )}
        </div>
      </div>

      <div className="mt-2">
        <div className="text-xs text-slate-600 mb-1">{label(t.mobilePhone)}</div>
        <input
          value={local.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="8x-xxxxxxx"
          className={`w-full rounded-lg border px-3 py-2 bg-white ${
            phoneErr ? "border-red-400" : "border-slate-300"
          }`}
        />
        {phoneErr && (
          <div className="text-red-600 text-xs mt-1">{t.required}</div>
        )}
      </div>

      <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={local.optIn || false}
          onChange={(e) => set("optIn", e.target.checked)}
        />
        {t.marketingOptIn}
      </label>
    </div>
  );
});

/* ========================= Page ========================= */
export default function PriceDetailSkyBlue() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  const [params] = useSearchParams();

  // Language
  const [lang, setLang] = useState(state?.lang === "th" ? "th" : "en");
  const t = STR[lang];

  // Refs for precise scrolling
  const headerRef = useRef(null);
  const passengerTopRef = useRef(null);

  // Mobile flag (stable)
  const isMobile = useMemo(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia("(max-width: 640px)").matches
        : false,
    []
  );

  /* ===== Smooth, header-aware scroll helper =====
     We compute the target Y so the sentinel sits JUST below the sticky header.
     Always uses behavior: 'smooth' for animated movement. */
  const [headerHeight, setHeaderHeight] = useState(64);
  useEffect(() => {
    const update = () => {
      const el = headerRef.current;
      const rect = el?.getBoundingClientRect?.();
      setHeaderHeight(rect?.height || 64);
    };
    update();
    // Keep header height fresh on resize
    window.addEventListener("resize", update);
    // Observe header size changes if supported
    let ro;
    if (window.ResizeObserver) {
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

    // Compute absolute Y position accounting for header height + small gap
    const rect = sentinel.getBoundingClientRect();
    const targetTop = Math.max(0, window.scrollY + rect.top - headerHeight - 8);

    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [headerHeight]);

  // 🔝 On mount: scroll smoothly to the passenger box (especially for mobile)
  useEffect(() => {
    // Defer a tick so layout is settled
    requestAnimationFrame(() => {
      if (isMobile) scrollToPassengerTop();
    });
  }, [scrollToPassengerTop, isMobile]);

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
      // After closing modal, jump back to top of passenger box smoothly
      requestAnimationFrame(() => scrollToPassengerTop());
    },
    [updateForm, scrollToPassengerTop]
  );

  const isComplete = useCallback(
    (v) => v && v.firstName && v.lastName && v.dob,
    []
  );

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
        features: [
          "7 kg carry-on baggage",
          "20 kg baggage allowance",
          "Standard/Hot seat",
        ],
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
          {
            key: "OUT-1",
            origin: "",
            destination: "",
            depTime: null,
            arrTime: null,
            fn: "",
            dir: "OUT",
          },
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
  const [contact, setContact] = useState({
    dialCode: "+66",
    phone: "",
    email: "",
    optIn: false,
  });
  const [showContactErrors, setShowContactErrors] = useState(false);
  const contactValid = useMemo(
    () => contact.phone.trim() && contact.email.trim(),
    [contact.phone, contact.email]
  );
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
      {/* Nok Holiday themed header (no rainbow) */}
      <div
        ref={headerRef}
        className="sticky top-0 z-20 w-full border-b bg-[#e3f8ff]"
        style={{ minHeight: 64 }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <span className="font-bold text-[170%] text-blue-600 tracking-tight transition-colors duration-300 group-hover:text-[#ffe657]">
              Nok Holiday
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setLang("th");
                requestAnimationFrame(() => scrollToPassengerTop());
              }}
              className={`px-3 py-1 border rounded ${
                lang === "th"
                  ? "bg-blue-600 text-white"
                  : "border-blue-600 text-blue-600"
              }`}
            >
              ไทย
            </button>
            <button
              onClick={() => {
                setLang("en");
                requestAnimationFrame(() => scrollToPassengerTop());
              }}
              className={`px-3 py-1 border rounded ${
                lang === "en"
                  ? "bg-blue-600 text-white"
                  : "border-blue-600 text-blue-600"
              }`}
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
                      {isComplete(forms[travellers[0].id])
                        ? t.completed
                        : t.incomplete}
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
                <ContactInformation
                  t={t}
                  value={contact}
                  onChange={setContact}
                  showErrors={showContactErrors}
                />

                {/* ===== Bundle groups: one per segment ===== */}
                <div className="mt-5">
                  {legs.map((leg, idx) => {
                    const labelGuess =
                      leg.dir === "IN"
                        ? t.ret
                        : leg.dir === "OUT"
                        ? t.depart
                        : `${t.segment} ${idx + 1}`;

                    const name = `bundle-${leg.key}`;
                    const headerText = [
                      leg.origin && leg.destination
                        ? `${leg.origin} → ${leg.destination}`
                        : null,
                      leg.fn ? leg.fn : null,
                      leg.depTime ? `${formatDDMMM(leg.depTime)} ${hhmm(leg.depTime)}` : null,
                      leg.arrTime ? `→ ${hhmm(leg.arrTime)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" • ");

                    return (
                      <div
                        key={leg.key}
                        className="mb-4 p-3 rounded-xl border border-slate-200 bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-green-600 text-white grid place-items-center font-extrabold flex-shrink-0">
                            ★
                          </div>
                          <div className="text-base font-extrabold">
                            {labelGuess} {headerText ? `• ${headerText}` : ""}
                          </div>
                        </div>

                        <div className="text-slate-600 text-sm mt-2 mb-3">
                          {t.selectOneBundle}
                        </div>

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
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 mb-3">
                {t.noKey}
              </div>
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
                  <div className="text-xl text-sky-700 font-extrabold">
                    {fmt(grandTotal, currency)}
                  </div>
                </div>

                <button
                  disabled={!canContinue}
                  className={`mt-4 w-full px-4 py-3 rounded-full font-bold text-white ${
                    canContinue
                      ? "bg-sky-500 hover:bg-sky-600"
                      : "bg-gray-400 cursor-not-allowed"
                  }`}
                  onClick={() => {
                    if (!contactValid) setShowContactErrors(true);
                    if (!canContinue) return;
                    alert(
                      "✅ Continue to seats / add-ons.\n\n" +
                        JSON.stringify(
                          { pax, forms, contact, selectedBundles, legs },
                          null,
                          2
                        )
                    );
                    // After continue, force scroll passenger top again (UX consistency)
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
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800">
                  {t.noDetail}
                </div>
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
    </div>
  );
}
