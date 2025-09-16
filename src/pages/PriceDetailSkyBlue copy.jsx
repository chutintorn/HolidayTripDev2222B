// src/pages/PriceDetailSkyBlue.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectPriceFor } from "../redux/pricingSlice";

/* ========================= Strings ========================= */
const STR = {
  en: {
    title: "Passenger details • SkyBlue",
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
  },
  th: {
    title: "รายละเอียดผู้โดยสาร • SkyBlue",
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
  },
};

/* ========================= Helpers ========================= */
/** Find the FIRST pricingDetails bucket (various API shapes supported) */
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

/* -------- Origin/Destination + Dates extraction (robust fallbacks) -------- */
const up3 = (x) =>
  typeof x === "string" && /^[A-Za-z]{3}$/.test(x) ? x.toUpperCase() : null;

function safeDate(s) {
  if (!s) return null;
  // accept ISO, "YYYY-MM-DD", "YYYY-MM-DDTHH:mm", etc.
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDDMMM(d) {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `${dd}-${mon}`;
}

/** Crawl through any nested shape to collect segment-like items */
function gatherSegments(root, acc = []) {
  if (!root || typeof root !== "object") return acc;
  // segment-like heuristic
  if (
    (root.origin || root.from || root.departureAirport) &&
    (root.destination || root.to || root.arrivalAirport)
  ) {
    acc.push({
      origin:
        up3(root.origin) ||
        up3(root.from) ||
        up3(root.departureAirport) ||
        null,
      destination:
        up3(root.destination) ||
        up3(root.to) ||
        up3(root.arrivalAirport) ||
        null,
      dep:
        safeDate(root.departureDateTime || root.departureTime || root.departure || root.depTime || root.depDate) ||
        safeDate(root.date) ||
        null,
      direction:
        String(root.direction || root.dir || root.bound || "").toLowerCase(),
    });
  }
  Object.values(root).forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => gatherSegments(x, acc));
    else if (typeof v === "object") gatherSegments(v, acc);
  });
  return acc;
}

/** Build routes array from API; fallback to OD (DMK↔HKT default) */
function buildRoutes(detailLike, lang) {
  const segments = gatherSegments(detailLike);
  // Try to detect legs by direction labels in the data
  const out = [];
  const dirGroups = {
    outbound: segments.filter((s) => /out|depart/i.test(s.direction)),
    inbound: segments.filter((s) => /in|return|back/i.test(s.direction)),
  };

  const pushLeg = (id, o, d, date, label) => {
    if (!o || !d) return;
    out.push({
      id,
      leg: `${o}–${d}`,
      label,
      dateLabel: date ? formatDDMMM(date) : "",
    });
  };

  if (dirGroups.outbound.length) {
    const f = dirGroups.outbound[0];
    pushLeg("depart", f.origin, f.destination, f.dep, STR[lang].depart);
  }
  if (dirGroups.inbound.length) {
    const f = dirGroups.inbound[0];
    pushLeg("return", f.origin, f.destination, f.dep, STR[lang].ret);
  }

  // If still empty, attempt a simplistic 1–2 leg inference from segment order
  if (!out.length && segments.length) {
    const first = segments[0];
    pushLeg("depart", first.origin, first.destination, first.dep, STR[lang].depart);

    // try to find a later segment that looks like reverse
    const rev = segments.find(
      (s) => s.origin === first.destination && s.destination === first.origin
    );
    if (rev) {
      pushLeg("return", rev.origin, rev.destination, rev.dep, STR[lang].ret);
    }
  }

  // Fallback hard defaults if nothing detected
  if (!out.length) {
    pushLeg("depart", "DMK", "HKT", null, STR[lang].depart);
  }

  return out;
}

function Chip({ ok, children }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 999,
        background: ok ? "#e6fffa" : "#e6f2fb",
        color: ok ? "#0f766e" : "#0a4a72",
        border: `1px solid ${ok ? "#99f6e4" : "#bfe1fb"}`,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function RowCard({ left, right, onClick }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{left}</div>
      <button
        onClick={onClick}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #06b6d4",
          background: "#fff",
          color: "#0891b2",
          cursor: "pointer",
          fontWeight: 600,
          minWidth: 110,
        }}
      >
        {right}
      </button>
    </div>
  );
}

/* ============== Simple Modal ============== */
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(720px, 92vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ============== Traveller Form ============== */
function TravellerForm({ t, value, onChange, onSave, showSave = true, points = 95 }) {
  const [local, setLocal] = useState(value || {});
  const [errors, setErrors] = useState({});

  useEffect(() => setLocal(value || {}), [value]);

  const set = (k, v) => {
    const next = { ...local, [k]: v };
    setLocal(next);
    onChange?.(next);
  };

  const required = (k) => ((local[k] || "").trim()).length > 0;

  const validate = () => {
    const e = {};
    ["firstName", "lastName", "dob"].forEach((k) => {
      if (!required(k)) e[k] = t.required;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    onSave?.(local);
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Gender */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
          {t.passengerDetails}
        </div>
        <div
          style={{
            display: "inline-flex",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => set("gender", "M")}
            style={{
              padding: "8px 12px",
              border: 0,
              background: local.gender === "M" ? "#e6f8ff" : "#fff",
              color: local.gender === "M" ? "#0369a1" : "#111827",
              cursor: "pointer",
            }}
          >
            {t.male}
          </button>
          <button
            type="button"
            onClick={() => set("gender", "F")}
            style={{
              padding: "8px 12px",
              border: 0,
              background: local.gender === "F" ? "#e6f8ff" : "#fff",
              color: local.gender === "F" ? "#0369a1" : "#111827",
              cursor: "pointer",
              borderLeft: "1px solid #e5e7eb",
            }}
          >
            {t.female}
          </button>
        </div>
      </div>

      {/* Names */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <input
            placeholder={t.firstName}
            value={local.firstName || ""}
            onChange={(e) => set("firstName", e.target.value)}
            style={{
              width: "100%",
              border: `1px solid ${errors.firstName ? "#f87171" : "#e5e7eb"}`,
              borderRadius: 10,
              padding: "12px",
            }}
          />
          {errors.firstName && (
            <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
              {t.required}
            </div>
          )}
        </div>
        <div>
          <input
            placeholder={t.lastName}
            value={local.lastName || ""}
            onChange={(e) => set("lastName", e.target.value)}
            style={{
              width: "100%",
              border: `1px solid ${errors.lastName ? "#f87171" : "#e5e7eb"}`,
              borderRadius: 10,
              padding: "12px",
            }}
          />
          {errors.lastName && (
            <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
              {t.required}
            </div>
          )}
        </div>
      </div>

      {/* Country + DOB */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div>
          <select
            value={local.country || "Thailand"}
            onChange={(e) => set("country", e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "12px",
              background: "#fff",
            }}
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
            style={{
              width: "100%",
              border: `1px solid ${errors.dob ? "#f87171" : "#e5e7eb"}`,
              borderRadius: 10,
              padding: "12px",
            }}
          />
          {errors.dob && (
            <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
              {t.required}
            </div>
          )}
        </div>
      </div>

      {/* Member & email (lookup) */}
      <div style={{ marginTop: 12 }}>
        <input
          placeholder={t.memberId}
          value={local.memberId || ""}
          onChange={(e) => set("memberId", e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "12px",
            marginBottom: 12,
          }}
        />
        <div
          style={{
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#f8fafc",
          }}
        >
          <div style={{ color: "#0f172a", marginBottom: 8 }}>
            • {t.earnPoints}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}
          >
            <input
              placeholder={t.email}
              value={local.email || ""}
              onChange={(e) => set("email", e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "12px",
              }}
            />
            <button
              type="button"
              style={{
                border: "1px solid #06b6d4",
                background: "#fff",
                color: "#0891b2",
                padding: "10px 16px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 600,
              }}
              onClick={() => alert("🔎 Lookup member by email (stub)")}
            >
              {t.search}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#0f172a" }}>
          {t.pointsAfter}{" "}
          <span style={{ fontWeight: 700 }}>{points} {t.points}</span>
        </div>
      </div>

      {showSave && (
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}
        >
          <button
            onClick={save}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#00b8ff",
              border: 0,
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {t.save}
          </button>
        </div>
      )}
    </div>
  );
}

/* ========================= AddOnBundles (inline component) ========================= */
const Suitcase = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const Seat = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 3v8a2 2 0 0 0 2 2h7" />
    <path d="M5 19h12a2 2 0 0 0 2-2v-1H9a3 3 0 0 1-3-3" />
  </svg>
);
const Meal = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 3v7" /><path d="M8 3v7" /><path d="M4 10h4" />
    <path d="M12 3v18" /><path d="M16 7h4" />
  </svg>
);
const Voucher = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 9h10M7 13h6" />
  </svg>
);
const Shield = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
  </svg>
);
const ICONS = { suitcase: Suitcase, seat: Seat, meal: Meal, voucher: Voucher, shield: Shield };

const colorMap = {
  blue:  { border: "border-blue-200",  text: "text-blue-600",  pill: "bg-blue-500",  icon: "text-blue-500"  },
  amber: { border: "border-amber-200", text: "text-amber-600", pill: "bg-amber-500", icon: "text-amber-500" },
  rose:  { border: "border-rose-200",  text: "text-rose-600",  pill: "bg-rose-500",  icon: "text-rose-500"  },
};
function cx(...xs) { return xs.filter(Boolean).join(" "); }

function FeatureCard({ bundle }) {
  const cm = colorMap[bundle.color] ?? colorMap.blue;
  return (
    <article className={cx("rounded-2xl bg-white border shadow-sm relative", cm.border)}>
      <div className={cx("absolute left-0 top-6 bottom-6 w-2 rounded-l-lg", cm.pill)} />
      <div className="p-6 pl-8">
        <h3 className="text-xl font-semibold">{bundle.title}</h3>
        <p className={cx(cm.text, "font-medium mb-5")}>{bundle.saveText}</p>
        <p className="font-medium mb-2">Each guest gets:</p>
        <ul className="space-y-3 text-sm">
          {bundle.features.map((f, idx) => {
            const Icon = ICONS[f.icon] || Suitcase;
            return (
              <li key={idx} className="flex items-center gap-3">
                <Icon className={cx("w-[18px] h-[18px]", cm.icon)} />
                <span>{f.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

function PriceRow({ route, price, isSelected, onSelect }) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      data-selected={isSelected ? "true" : undefined}
      onClick={onSelect}
      className={cx(
        "row w-full flex items-center justify-between rounded-lg border p-3 text-left",
        isSelected ? "bg-blue-50 border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,.12)]" : "border-gray-200"
      )}
      style={{ width: "100%" }}
    >
      <div className="flex-1">
        <div className="uppercase tracking-wide text-gray-700 font-medium">{route.leg}</div>
        <div className="text-xs text-gray-500">{route.label}</div>
        {route.dateLabel && (
          <div className="text-xs text-gray-500 mt-0.5">{route.dateLabel}</div>
        )}
      </div>
      <div className="text-right mr-3">
        <div className="font-semibold">{price?.amount ?? "—"}</div>
        {price?.guests != null && (
          <div className="text-xs text-gray-500">{price.guests} guests</div>
        )}
      </div>
      <div
        className={cx(
          "check w-7 h-7 rounded-full grid place-items-center font-bold",
          isSelected ? "bg-green-600 text-white" : "bg-gray-100 text-transparent"
        )}
        style={{
          width: 28, height: 28, borderRadius: 9999,
          display: "grid", placeItems: "center", fontWeight: 700,
        }}
      >
        ✓
      </div>
    </button>
  );
}

function AddOnBundles({ bundles, routes, prices, defaultSelected, onChange }) {
  const [selected, setSelected] = useState(() => ({ ...(defaultSelected || {}) }));

  const handleSelect = (routeId, bundleId) => {
    setSelected((prev) => {
      const next = { ...prev, [routeId]: bundleId };
      onChange?.({ routeId, bundleId });
      return next;
    });
  };

  return (
    <div className="space-y-8" style={{ marginTop: 12 }}>
      {/* Container 1: Feature Cards */}
      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-green-600 grid place-items-center text-white">★</div>
          <h1 className="text-2xl font-semibold">Add–on bundles</h1>
        </div>
        <p className="text-gray-600">Save more on add–on bundles than buying them individually</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ display: "grid", gap: 16 }}>
          {bundles.map((b) => (
            <FeatureCard key={b.id} bundle={b} />
          ))}
        </div>
      </section>

      {/* Container 2: Prices (one selection per route) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Choose one per route</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ display: "grid", gap: 16 }}>
          {bundles.map((b) => {
            const cm = colorMap[b.color] ?? colorMap.blue;
            return (
              <div key={b.id} className={cx("rounded-2xl bg-white border shadow-sm", cm.border)} style={{ borderRadius: 12 }}>
                <div className="p-3 space-y-3 text-sm" style={{ padding: 12 }}>
                  {routes.map((r) => (
                    <PriceRow
                      key={r.id}
                      route={r}
                      price={prices?.[b.id]?.[r.id]}
                      isSelected={selected[r.id] === b.id}
                      onSelect={() => handleSelect(r.id, b.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ========================= Contact Information (NEW) ========================= */
function ContactInformation({ t, value, onChange, showErrors }) {
  const [local, setLocal] = useState(
    value || { dialCode: "+66", phone: "", email: "", optIn: false }
  );

  useEffect(
    () => setLocal(value || { dialCode: "+66", phone: "", email: "", optIn: false }),
    [value]
  );

  const set = (k, v) => {
    const next = { ...local, [k]: v };
    setLocal(next);
    onChange?.(next);
  };

  const phoneErr = showErrors && !local.phone.trim();
  const emailErr = showErrors && !local.email.trim();

  const label = (text) => (
    <span>
      {text} <span style={{ color: "#ef4444" }}>*</span>
    </span>
  );

  return (
    <div
      style={{
        marginTop: 12,
        background: "#f3f4f6",
        borderRadius: 12,
        padding: 16,
        border: "1px solid #e5e7eb",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{t.contact}</h3>

      {/* Phone row */}
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
            {label("+ Code")}
          </div>
          <select
            value={local.dialCode}
            onChange={(e) => set("dialCode", e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 12px",
              background: "#fff",
            }}
          >
            <option value="+66">+66</option>
            <option value="+60">+60</option>
            <option value="+65">+65</option>
            <option value="+84">+84</option>
            <option value="+62">+62</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
            {label(t.mobilePhone)}
          </div>
          <input
            value={local.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="8x-xxxxxxx"
            style={{
              width: "100%",
              border: `1px solid ${phoneErr ? "#f87171" : "#d1d5db"}`,
              borderRadius: 10,
              padding: "10px 12px",
              background: "#fff",
            }}
          />
          {phoneErr && (
            <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
              {t.required}
            </div>
          )}
        </div>
      </div>

      {/* Email row */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
          {label(t.emailAddress)}
        </div>
        <input
          value={local.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="name@example.com"
          style={{
            width: "100%",
            border: `1px solid ${emailErr ? "#f87171" : "#d1d5db"}`,
            borderRadius: 10,
            padding: "10px 12px",
            background: "#fff",
          }}
        />
        {emailErr && (
          <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
            {t.required}
          </div>
        )}
      </div>

      {/* Opt in */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 10,
          fontSize: 13,
          color: "#374151",
        }}
      >
        <input
          type="checkbox"
          checked={local.optIn || false}
          onChange={(e) => set("optIn", e.target.checked)}
        />
        {t.marketingOptIn}
      </label>
    </div>
  );
}

/* ========================= Page ========================= */
export default function PriceDetailSkyBlue() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  const [params] = useSearchParams();

  // Language
  const [lang, setLang] = useState(state?.lang === "th" ? "th" : "en");
  const t = STR[lang];

  // Pricing (Redux)
  const requestKey = state?.requestKey || params.get("key") || null;
  const pricedFromStore = useSelector((s) =>
    requestKey ? selectPriceFor(requestKey)(s) : null
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
    const totalExplicit =
      d?.totalAmount ?? d?.total ?? d?.grandTotal ?? d?.priceTotal;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pax.adult, pax.child, pax.infant, lang]);

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

  const updateForm = (id, v) =>
    setForms((f) => ({ ...f, [id]: { ...(f[id] || {}), ...v } }));

  const saveModal = (id, v) => {
    updateForm(id, v);
    setOpenId(null);
  };

  const isComplete = (v) => v && v.firstName && v.lastName && v.dob;
  const allCompleted = travellers.every((p) => isComplete(forms[p.id]));
  const firstAdultName =
    travellers[0] &&
    forms[travellers[0].id]?.firstName &&
    forms[travellers[0].id]?.lastName
      ? `${forms[travellers[0].id].firstName} ${forms[travellers[0].id].lastName}`
      : "";

  const fmt = (n, ccy) =>
    `${Number(n).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${ccy}`;

  /* ==== Bundles data & selection ==== */
  const bundles = useMemo(
    () => [
      {
        id: "lite",
        title: "Value Pack Lite",
        color: "blue",
        saveText: lang === "th" ? "ประหยัดสูงสุด 30%" : "Save up to 30%",
        features: [
          { icon: "suitcase", text: lang === "th" ? "สัมภาระขึ้นเครื่อง 7 กก." : "7 kg carry–on baggage" },
          { icon: "suitcase", text: lang === "th" ? "น้ำหนักสัมภาระ 15 กก." : "15 kg baggage allowance" },
          { icon: "seat",     text: lang === "th" ? "ที่นั่งมาตรฐาน" : "Standard seat" },
        ],
      },
      {
        id: "value",
        title: "Value Pack",
        color: "amber",
        saveText: lang === "th" ? "ประหยัดสูงสุด 30%" : "Save up to 30%",
        features: [
          { icon: "suitcase", text: "7kg carry–on baggage" },
          { icon: "suitcase", text: "20kg baggage allowance" },
          { icon: "seat",     text: "Standard seat" },
          { icon: "meal",     text: "1 meal" },
          { icon: "voucher",  text: "Duty Free RM50 Voucher" },
          { icon: "shield",   text: lang === "th" ? "ประกัน Lite (Tune Protect)" : "Lite Insurance (Tune Protect)" },
        ],
      },
      {
        id: "premium",
        title: "Premium Flex",
        color: "rose",
        saveText: lang === "th" ? "ประหยัดสูงสุด 20%" : "Save up to 20%",
        features: [
          { icon: "suitcase", text: "7 kg carry–on baggage" },
          { icon: "suitcase", text: "20 kg baggage allowance" },
          { icon: "seat",     text: "Standard/Hot seat" },
        ],
      },
    ],
    [lang]
  );

  /* ---- ROUTES from API (supports one-way) ---- */
  const routes = useMemo(() => buildRoutes(detail?.raw ?? rawDetail ?? {}, lang), [detail?.raw, rawDetail, lang]);

  /* Demo prices (map every detected route id) */
  const prices = useMemo(() => {
    const guests = pax.adult + pax.child;
    const perRoute = {};
    routes.forEach((r, idx) => {
      perRoute[r.id] = {
        amount: idx === 0 ? "THB 2,482.40" : "THB 2,482.40",
        guests,
      };
    });
    return {
      lite: Object.fromEntries(routes.map((r) => [r.id, { amount: "THB 1,968.80", guests }])),
      value: perRoute,
      premium: Object.fromEntries(routes.map((r) => [r.id, { amount: "THB 4,108.80", guests }])),
    };
  }, [routes, pax.adult, pax.child]);

  const [selectedBundles, setSelectedBundles] = useState({});
  useEffect(() => {
    // initialize selection (value for all routes)
    if (routes.length) {
      setSelectedBundles((prev) => {
        const next = { ...prev };
        routes.forEach((r) => {
          if (!next[r.id]) next[r.id] = "value";
        });
        return next;
      });
    }
  }, [routes]);
  const onBundleChange = ({ routeId, bundleId }) => {
    setSelectedBundles((prev) => ({ ...prev, [routeId]: bundleId }));
  };

  /* ==== Contact information state & validation ==== */
  const [contact, setContact] = useState({ dialCode: "+66", phone: "", email: "", optIn: false });
  const [showContactErrors, setShowContactErrors] = useState(false);
  const contactValid = contact.phone.trim() && contact.email.trim();

  const canContinue = travellers.every((p) => isComplete(forms[p.id])) && contactValid;

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        background: "#fafafa",
        minHeight: "100vh",
        margin: 0,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          background: "#ffffff",
          borderBottom: "1px solid #e9e9e9",
          position: "sticky",
          top: 0,
          zIndex: 5,
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0 }}>{t.title}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setLang("th")}
            style={{
              border: "1px solid #00b8ff",
              padding: "6px 10px",
              borderRadius: 8,
              background: lang === "th" ? "#e6f8ff" : "#fff",
              cursor: "pointer",
            }}
          >
            ไทย
          </button>
          <button
            onClick={() => setLang("en")}
            style={{
              border: "1px solid #00b8ff",
              padding: "6px 10px",
              borderRadius: 8,
              background: lang === "en" ? "#e6f8ff" : "#fff",
              cursor: "pointer",
            }}
          >
            English
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ maxWidth: 1180, margin: "20px auto", padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16 }}>
          {/* LEFT */}
          <div>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <h2 style={{ marginTop: 0 }}>{t.travellers}</h2>

              {/* Adult 1 full form */}
              {travellers[0] && (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    overflow: "hidden",
                    marginTop: 8,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "#fafafa",
                      borderBottom: "1px solid #e5e7eb",
                      fontWeight: 700,
                    }}
                  >
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {travellers.slice(1).map((p) => (
                  <RowCard
                    key={p.id}
                    left={
                      <>
                        <div style={{ fontWeight: 700 }}>{p.label}</div>
                        <Chip ok={isComplete(forms[p.id])}>
                          {isComplete(forms[p.id]) ? STR[lang].completed : STR[lang].incomplete}
                        </Chip>
                        {p.type === "INF" && firstAdultName && (
                          <span style={{ marginLeft: 10, color: "#0a4a72", fontSize: 13 }}>
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

                {/* Add-on bundles */}
                <div style={{ marginTop: 20 }}>
                  <AddOnBundles
                    bundles={bundles}
                    routes={routes}
                    prices={prices}
                    defaultSelected={selectedBundles}
                    onChange={onBundleChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Fare summary */}
          <aside
            style={{
              background: "#fff",
              border: "1px solid #e9e9e9",
              borderRadius: 12,
              padding: 16,
              height: "fit-content",
              position: "sticky",
              top: 76,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>{t.priceSummary}</h3>

            {!requestKey && !state?.priceDetail && (
              <div
                style={{
                  padding: 12,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: 8,
                  color: "#9a3412",
                  marginBottom: 12,
                }}
              >
                {t.noKey}
              </div>
            )}

            {detail ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 8 }}>
                  <div style={{ color: "#555" }}>{t.baseFare}</div>
                  <div>
                    <strong>{fmt(detail.baseFareAmount, detail.currency)}</strong>
                  </div>

                  <div style={{ color: "#555" }}>{t.tax}</div>
                  <div>
                    <strong>{fmt(detail.taxAmount, detail.currency)}</strong>
                  </div>

                  <div style={{ color: "#555" }}>{t.addons}</div>
                  <div>
                    {/* Wire this to selected bundle prices if desired */}
                    <strong>{fmt(0, detail.currency)}</strong>
                  </div>

                  <div
                    style={{ height: 1, background: "#e9e9e9", gridColumn: "1 / -1", margin: "6px 0" }}
                  />

                  <div style={{ color: "#0a5c57", fontWeight: 700 }}>{t.total}</div>
                  <div style={{ fontSize: 20, color: "#0077aa", fontWeight: 800 }}>
                    {fmt(detail.totalAmount, detail.currency)}
                  </div>
                </div>

                <button
                  disabled={!canContinue}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 999,
                    border: 0,
                    background: canContinue ? "#00b8ff" : "#9ca3af",
                    color: "#fff",
                    cursor: canContinue ? "pointer" : "not-allowed",
                    fontWeight: 700,
                  }}
                  onClick={() => {
                    if (!contactValid) setShowContactErrors(true);
                    if (!canContinue) return;
                    alert(
                      "✅ Continue to seats / add-ons.\n\n" +
                        JSON.stringify({ pax, forms, contact, selectedBundles }, null, 2)
                    );
                  }}
                >
                  {t.continue}
                </button>

                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => navigate(-1)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    {t.back}
                  </button>
                </div>

                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", color: "#666" }}>{t.raw}</summary>
                  <pre
                    style={{
                      background: "#f7f7f7",
                      border: "1px solid #eee",
                      borderRadius: 8,
                      padding: 10,
                      overflowX: "auto",
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(detail.raw, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              (requestKey || state?.priceDetail) && (
                <div
                  style={{
                    padding: 12,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    color: "#991b1b",
                  }}
                >
                  {t.noDetail}
                </div>
              )
            )}
          </aside>
        </div>
      </div>

      {/* Modal for secondary travellers */}
      <Modal open={!!openId} onClose={() => setOpenId(null)}>
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 800 }}>{t.passengerDetails}</div>
          <button
            onClick={() => setOpenId(null)}
            style={{
              border: 0,
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
            }}
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
            points={95}
          />
        )}
      </Modal>
    </div>
  );
}
