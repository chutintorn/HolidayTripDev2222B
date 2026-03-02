import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props:
 *  - anchorDate
 *  - isLoading
 *  - lang
 *  - onNavigate
 *  - minDate
 *  - minTotal ✅
 *  - currency ✅
 */
export default function DateNavigatorOneWay({
  anchorDate,
  isLoading = false,
  lang = "en",
  onNavigate,
  minDate,
  minTotal = null,
  currency = "THB",
}) {
  const [activeDate, setActiveDate] = useState(
    () => toDate(anchorDate) || startOfToday()
  );
  const anchorRef = useRef(toDate(anchorDate) || startOfToday());

  useEffect(() => {
    const a = toDate(anchorDate);
    if (a) {
      anchorRef.current = startOfDay(a);
      setActiveDate(startOfDay(a));
    }
  }, [anchorDate]);

  const minAllowed = useMemo(() => {
    const m = toDate(minDate);
    return startOfDay(m || startOfToday());
  }, [minDate]);

  const canGoTo = (d) => startOfDay(d) >= minAllowed;

  const doNavigate = (target) => {
    const t = startOfDay(target);
    if (!canGoTo(t)) {
      toast(lang === "th" ? "ไม่ค้นหาวันย้อนหลัง" : "Past date blocked");
      return;
    }
    setActiveDate(t);
    if (typeof onNavigate === "function") onNavigate(t);
  };

  const prevDayDisabled = isLoading || !canGoTo(addDays(activeDate, -1));
  const prevWeekDisabled = isLoading || !canGoTo(addDays(activeDate, -7));
  const nextDayDisabled = isLoading;
  const nextWeekDisabled = isLoading;
  const resetDisabled = isLoading;

  const [animDir, setAnimDir] = useState("none");
  const prevActiveRef = useRef(activeDate);

  useEffect(() => {
    const prev = prevActiveRef.current;
    if (prev?.getTime && activeDate?.getTime) {
      if (activeDate.getTime() > prev.getTime()) setAnimDir("right");
      else if (activeDate.getTime() < prev.getTime()) setAnimDir("left");
      else setAnimDir("none");
    }
    prevActiveRef.current = activeDate;
  }, [activeDate]);

  const dow = getDow(activeDate, lang);
  const dowStyle = getDowStyleByRuleVivid(activeDate);

  // ✅ split day/month for SkyBlue theme (like RoundTrip)
  const { day: dDay, mon: dMon } = fmtDayMon(activeDate);

  // ✅ NEW: tint for Minimum price row (very light) based on DOW
  const minRowTint = useMemo(() => {
    return getLightFromVivid(getDowStyleByRuleVivid(activeDate));
  }, [activeDate]);

  return (
    <section style={styles.wrap} aria-label="Date navigator">
      {/* TOP: navigation row */}
      <div style={styles.navRow}>
        <button
          type="button"
          style={{ ...styles.btn, ...(prevWeekDisabled ? styles.btnDisabled : null) }}
          disabled={prevWeekDisabled}
          aria-label="Back 1 week"
          onClick={() => {
            setAnimDir("left");
            doNavigate(addDays(activeDate, -7));
          }}
        >
          ⏪
        </button>

        <button
          type="button"
          style={{ ...styles.btn, ...(prevDayDisabled ? styles.btnDisabled : null) }}
          disabled={prevDayDisabled}
          aria-label="Back 1 day"
          onClick={() => {
            setAnimDir("left");
            doNavigate(addDays(activeDate, -1));
          }}
        >
          ◀
        </button>

        <div style={styles.center} aria-label="Active date">
          <div
            style={{
              ...styles.bigDate,
              ...(animDir === "right"
                ? styles.slideRight
                : animDir === "left"
                ? styles.slideLeft
                : null),
            }}
            key={activeDate.toISOString()}
          >
            <span className="dn1w-day" style={styles.dayNum}>
              {dDay}
            </span>
            <span className="dn1w-mon" style={styles.monTxt}>
              {dMon}
            </span>
          </div>

          <div style={{ ...styles.dowPill, ...dowStyle }}>{dow}</div>
        </div>

        <button
          type="button"
          style={{ ...styles.btn, ...(nextDayDisabled ? styles.btnDisabled : null) }}
          disabled={nextDayDisabled}
          aria-label="Next 1 day"
          onClick={() => {
            setAnimDir("right");
            doNavigate(addDays(activeDate, +1));
          }}
        >
          ▶
        </button>

        <button
          type="button"
          style={{ ...styles.btn, ...(nextWeekDisabled ? styles.btnDisabled : null) }}
          disabled={nextWeekDisabled}
          aria-label="Next 1 week"
          onClick={() => {
            setAnimDir("right");
            doNavigate(addDays(activeDate, +7));
          }}
        >
          ⏩
        </button>

        <button
          type="button"
          style={{
            ...styles.btn,
            ...styles.resetBtn,
            ...(resetDisabled ? styles.btnDisabled : null),
          }}
          disabled={resetDisabled}
          aria-label={lang === "th" ? "รีเซ็ต" : "Reset"}
          onClick={() => {
            const a = anchorRef.current || startOfToday();
            setAnimDir("none");
            doNavigate(a);
          }}
          title={lang === "th" ? "รีเซ็ต" : "Reset"}
        >
          <span style={styles.resetBullet}>●</span>
        </button>
      </div>

      {/* BOTTOM: minimum price (clean, tinted by DOW) */}
      <div
        style={{
          ...styles.minRow,
          background: minRowTint.background,
          borderColor: minRowTint.borderColor,
        }}
        aria-label="Minimum price"
      >
        <div style={styles.minLabel}>
          {lang === "th" ? "ราคาต่ำสุด" : "Minimum price"}
        </div>

        <div style={styles.minValue}>
          {minTotal === null ? "—" : `${fmtMoney(minTotal)} `}
          <span style={styles.minChip}>{currency}</span>
        </div>
      </div>

      <div style={styles.toast} id="dn_toast" role="status" aria-live="polite" />
    </section>
  );
}

/* ========================= helpers ========================= */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (!m) return null;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const dd = Number(m[3]);
    const d = new Date(yyyy, mm, dd);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function fmtDayMon(d) {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return {
    day: String(d.getDate()).padStart(2, "0"),
    mon: months[d.getMonth()],
  };
}
function getDow(d, lang) {
  const en = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const th = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];
  return lang === "th" ? th[d.getDay()] : en[d.getDay()];
}
function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function getDowStyleByRuleVivid(d) {
  const day = d.getDay();
  if (day === 0) return { background: "#edddde", borderColor: "#f58293", color: "#f7084c" };
  if (day === 1) return { background: "#f1f3e3", borderColor: "#f0ec17", color: "#a1a908d3" };
  if (day === 2) return { background: "#f4e5f0", borderColor: "#f62fc1", color: "#f424e6" };
  if (day === 3) return { background: "#a9f9d0", borderColor: "#10b981", color: "#0dbf8c" };
  if (day === 4) return { background: "#f5e9d7", borderColor: "#f0954b", color: "#e08d06" };
  if (day === 5) return { background: "#d3e4fa", borderColor: "#3b82f6", color: "#1b8df8" };
  return { background: "#e2d0f5", borderColor: "#8b5cf6", color: "#752cf4" };
}

// ✅ NEW: convert vivid color to very light tint (for min price row)
function getLightFromVivid(vivid) {
  return {
    background: withAlpha(vivid.background, 0.35),
    borderColor: withAlpha(vivid.borderColor, 0.55),
  };
}
function withAlpha(hex, alpha) {
  if (typeof hex === "string" && hex.startsWith("#")) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

/* ========================= toast ========================= */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("dn_toast");
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = "0";
  }, 1200);
}

/* ========================= styles ========================= */
const SKY = "#0ea5e9";
const SKY_BG = "#e0f2fe";
const SKY_BORDER = "#bae6fd";

const styles = {
  wrap: {
    marginTop: 12,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    boxShadow: "0 10px 20px rgba(2,6,23,.08)",
    padding: "10px 10px 12px",
    overflow: "hidden",
  },
  navRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
  },
  btn: {
    width: 40,
    height: 36,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    userSelect: "none",
    fontSize: 16,
    lineHeight: "1",
    display: "grid",
    placeItems: "center",
    color: SKY,
  },
  btnDisabled: { opacity: 0.45, cursor: "not-allowed" },

  center: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  // ✅ bigDate becomes "DD + MMM" container (like RoundTrip)
  bigDate: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap",
    letterSpacing: ".2px",
    fontVariantNumeric: "tabular-nums",
  },

  // ✅ DD premium
  dayNum: {
    width: 26,
    textAlign: "right",
    fontSize: 16,
    fontWeight: 800,
    color: "rgba(15,23,42,0.88)",
  },

  // ✅ MMM maximum SkyBlue theme
  monTxt: {
    width: 40,
    textAlign: "left",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.8px",
    color: "#0ea5e9",
    // ถ้าอยากให้เดือน "ธีมจัด" เป็น capsule เปิดได้:
    // padding: "2px 6px",
    // borderRadius: 8,
    // background: "rgba(14,165,233,0.12)",
  },

  dowPill: {
    fontSize: 13,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 9,
    border: "1px solid",
    whiteSpace: "nowrap",
    lineHeight: "1",
    minWidth: 32,
    textAlign: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  resetBtn: { background: SKY_BG, borderColor: SKY_BORDER },
  resetBullet: {
    color: SKY,
    fontSize: 24,
    lineHeight: "1",
    display: "inline-block",
    transform: "translateY(-1px)",
  },

  slideRight: { animation: "dn_slide_right 220ms ease" },
  slideLeft: { animation: "dn_slide_left 220ms ease" },

  // ✅ min price row
  minRow: {
    marginTop: 10,
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    transition: "background 180ms ease, border-color 180ms ease",
  },
  minLabel: { fontSize: 12, color: "rgba(15,23,42,0.70)", fontWeight: 600 },
  minValue: { fontSize: 14, color: "#0b4f8a", fontWeight: 800, whiteSpace: "nowrap" },
  minChip: {
    marginLeft: 6,
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#e9f2ff",
    border: "1px solid #c8defa",
    color: "#0b4f8a",
    fontWeight: 700,
  },

  toast: {
    marginTop: 10,
    width: "100%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 900,
    color: "#fff",
    background: "rgba(15,23,42,.92)",
    borderRadius: 999,
    padding: "8px 10px",
    opacity: 0,
    transition: "opacity 180ms ease",
  },
};

if (typeof document !== "undefined") {
  let style = document.getElementById("dn_keyframes");
  if (!style) {
    style = document.createElement("style");
    style.id = "dn_keyframes";
    document.head.appendChild(style);
  }
  style.textContent = `
    @keyframes dn_slide_right { from { transform: translateX(10px); opacity: .6; } to { transform: translateX(0); opacity: 1; } }
    @keyframes dn_slide_left  { from { transform: translateX(-10px); opacity: .6; } to { transform: translateX(0); opacity: 1; } }

    @media (max-width: 420px) {
      [aria-label="Date navigator"] button {
        width: 34px !important;
        height: 32px !important;
        font-size: 14px !important;
        border-radius: 10px !important;
      }
      /* keep DD/MMM readable on very narrow phones */
      [aria-label="Date navigator"] .dn1w-day { font-size: 15px !important; }
      [aria-label="Date navigator"] .dn1w-mon { font-size: 12px !important; }
    }
  `;
}