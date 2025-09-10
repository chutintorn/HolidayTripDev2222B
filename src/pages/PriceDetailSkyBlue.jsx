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
    memberId: "AirAsia member ID",
    email: "Email address (optional)",
    earnPoints: "Earn AirAsia points for this guest",
    search: "Search",
    save: "Save",
    cancel: "Cancel",
    fillDetails: "Fill details",
    edit: "Edit",
    contact: "Contact details",
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
    memberId: "รหัสสมาชิก AirAsia",
    email: "อีเมล (ไม่บังคับ)",
    earnPoints: "สะสมคะแนน AirAsia สำหรับผู้โดยสารนี้",
    search: "ค้นหา",
    save: "บันทึก",
    cancel: "ยกเลิก",
    fillDetails: "กรอกข้อมูล",
    edit: "แก้ไข",
    contact: "รายละเอียดการติดต่อ",
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
  },
};

/* ========================= Helpers ========================= */
/**
 * Find the FIRST pricingDetails array in the response (not all).
 * This matches websites that apply one set of travellers to all flights.
 */
function firstPricingDetailsBucket(root) {
  if (!root || typeof root !== "object") return null;

  // direct
  if (Array.isArray(root.pricingDetails)) return root.pricingDetails;

  // root.data
  if (root.data && Array.isArray(root.data.pricingDetails))
    return root.data.pricingDetails;

  // airlines[]
  if (Array.isArray(root.airlines) && root.airlines[0]?.pricingDetails)
    return Array.isArray(root.airlines[0].pricingDetails)
      ? root.airlines[0].pricingDetails
      : null;

  // data.airlines[]
  if (root.data && Array.isArray(root.data.airlines) && root.data.airlines[0]?.pricingDetails)
    return Array.isArray(root.data.airlines[0].pricingDetails)
      ? root.data.airlines[0].pricingDetails
      : null;

  return null;
}

/** Convert FIRST pricingDetails bucket to { adult, child, infant } */
function paxFromFirstPricingDetails(detailLike) {
  const arr = firstPricingDetailsBucket(detailLike);
  const out = { adult: 0, child: 0, infant: 0 };
  if (!Array.isArray(arr)) {
    out.adult = 1; // safe minimum when nothing is present
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
            <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{t.required}</div>
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
            <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{t.required}</div>
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
            <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{t.required}</div>
          )}
        </div>
      </div>

      {/* Member & email */}
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
          <div style={{ color: "#0f172a", marginBottom: 8 }}>• {t.earnPoints}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
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
          {t.pointsAfter} <span style={{ fontWeight: 700 }}>{points} {t.points}</span>
        </div>
      </div>

      {showSave && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
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
    const base =
      d?.baseFareAmount ?? d?.baseFare ?? d?.base ?? d?.fareAmount ?? 0;
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
      raw: d, // keep the raw object so we can read pricingDetails
    };
  }, [rawDetail]);

  /* ===== Pax: derive from FIRST pricingDetails; fallback to URL/state if missing ===== */
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

  // Build traveller list (Adult 1 inline, others as rows -> modal)
  const travellers = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= pax.adult; i++) arr.push({ id: `ADT-${i}`, type: "ADT", label: `${t.adult} ${i}` });
    for (let i = 1; i <= pax.child; i++) arr.push({ id: `CHD-${i}`, type: "CHD", label: `${t.child} ${i}` });
    for (let i = 1; i <= pax.infant; i++) arr.push({ id: `INF-${i}`, type: "INF", label: `${t.infant} ${i}` });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pax.adult, pax.child, pax.infant, lang]);

  // Forms per traveller + which modal is open
  const [forms, setForms] = useState({});
  const [openId, setOpenId] = useState(null);

  // Ensure Adult 1 exists with defaults
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

  const fmt = (n, ccy) =>
    `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;

  const allCompleted = travellers.every((p) => isComplete(forms[p.id]));
  const firstAdultName =
    travellers[0] && forms[travellers[0].id]?.firstName && forms[travellers[0].id]?.lastName
      ? `${forms[travellers[0].id].firstName} ${forms[travellers[0].id].lastName}`
      : "";

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
          {/* LEFT: Travellers */}
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

              {/* Other travellers: buttons that open modal */}
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

                {/* Contact details row (static demonstration) */}
                <RowCard
                  left={<div style={{ fontWeight: 700 }}>{STR[lang].contact}</div>}
                  right={STR[lang].completed}
                  onClick={() => {}}
                />
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
                  disabled={!allCompleted}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 999,
                    border: 0,
                    background: allCompleted ? "#00b8ff" : "#9ca3af",
                    color: "#fff",
                    cursor: allCompleted ? "pointer" : "not-allowed",
                    fontWeight: 700,
                  }}
                  onClick={() =>
                    alert(
                      "✅ Continue to seats / add-ons.\n\n" +
                        JSON.stringify({ pax, forms }, null, 2)
                    )
                  }
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
