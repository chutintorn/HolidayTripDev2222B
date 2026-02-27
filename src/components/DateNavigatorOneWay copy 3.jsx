// src/components/DateNavigatorOneWay.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * DateNavigatorOneWay
 * UI: ⏪ ◀ [DATE + DOW] ▶ ⏩ ●
 *
 * Props:
 *  - anchorDate: Date | string (YYYY-MM-DD)
 *  - isLoading: boolean
 *  - lang: "en" | "th" (default "en")
 *  - onNavigate: (targetDate: Date) => void
 *  - minDate: Date | string (YYYY-MM-DD) (default today)
 */
export default function DateNavigatorOneWay({
  anchorDate,
  isLoading = false,
  lang = "en",
  onNavigate,
  minDate,
}) {
  const [activeDate, setActiveDate] = useState(() => toDate(anchorDate) || startOfToday());
  const anchorRef = useRef(toDate(anchorDate) || startOfToday());

  // When anchorDate changes (after first search), reset both anchor+active
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

  // Buttons disabled logic
  const prevDayDisabled = isLoading || !canGoTo(addDays(activeDate, -1));
  const prevWeekDisabled = isLoading || !canGoTo(addDays(activeDate, -7));
  const nextDayDisabled = isLoading;
  const nextWeekDisabled = isLoading;
  const resetDisabled = isLoading;

  // ---- Smooth animation direction
  const [animDir, setAnimDir] = useState("none"); // "left" | "right" | "none"
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

  return (
    <section style={styles.wrap} aria-label="Date navigator">
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
            {fmtMonDay(activeDate)}
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

        {/* Reset button: light skyblue bg + skyblue bullet */}
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

      {/* small toast */}
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
function fmtMonDay(d) {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}`;
}
function getDow(d, lang) {
  const en = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const th = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];
  return lang === "th" ? th[d.getDay()] : en[d.getDay()];
}

// vivid weekday colors
function getDowStyleByRuleVivid(d) {
  const day = d.getDay();
  if (day === 0) return { background: "#edddde", borderColor: "#f58293", color: "#f7084c" }; // Sun red
  if (day === 1) return { background: "#f1f3e3", borderColor: "#f0ec17", color: "#a1a908d3" }; // Mon yellow
  if (day === 2) return { background: "#f4e5f0", borderColor: "#f62fc1", color: "#f424e6" }; // Tue pink
  if (day === 3) return { background: "#a9f9d0", borderColor: "#10b981", color: "#0dbf8c" }; // Wed green
  if (day === 4) return { background: "#f5e9d7", borderColor: "#f0954b", color: "#e08d06" }; // Thu orange
  if (day === 5) return { background: "#d3e4fa", borderColor: "#3b82f6", color: "#1b8df8" }; // Fri blue
  return { background: "#e2d0f5", borderColor: "#8b5cf6", color: "#752cf4" }; // Sat purple
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
const SKY = "#0ea5e9"; // skyblue
const SKY_BG = "#e0f2fe"; // light skyblue
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
  // ✅ keep one line always
  navRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
  },

  // ✅ arrows skyblue + smaller (50% of your previous big)
  // ✅ button box stays, but we also shrink slightly for mobile via media query (see injected css below)
  btn: {
    width: 40,
    height: 36,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    userSelect: "none",
    fontSize: 16, // 👈 smaller
    lineHeight: "1",
    display: "grid",
    placeItems: "center",
    color: SKY, // ✅ skyblue icon
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },

  // center compact
  center: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  // ✅ date: not bold + reduced size (50%)
  bigDate: {
    fontWeight: 300, // not bold
    letterSpacing: ".2px",
    fontSize: 12, // 👈 reduced ~50% from 28
    whiteSpace: "nowrap",
    color: "rgba(15,23,42,0.70)",
  },

  // ✅ dow text bigger 200% BUT compact padding so it fits one line on mobile
  dowPill: {
    fontSize: 15, // big but less than 24 to avoid wrap
    fontWeight: 300,
    padding: "4px 10px",
    borderRadius: 999,
    border: "0.5px solid",
    whiteSpace: "nowrap",
    lineHeight: "1",
  },

  // Reset background + bullet style
  resetBtn: {
    background: SKY_BG,
    borderColor: SKY_BORDER,
  },
  resetBullet: {
    color: SKY,
    fontSize: 24, // bigger bullet (150%)
    lineHeight: "1",
    display: "inline-block",
    transform: "translateY(-1px)",
  },

  slideRight: {
    animation: "dn_slide_right 220ms ease",
  },
  slideLeft: {
    animation: "dn_slide_left 220ms ease",
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

// Inject keyframes + small responsive tweak (mobile: slightly smaller buttons & tighter gap)
if (typeof document !== "undefined" && !document.getElementById("dn_keyframes")) {
  const style = document.createElement("style");
  style.id = "dn_keyframes";
  style.textContent = `
    @keyframes dn_slide_right {
      from { transform: translateX(10px); opacity: .6; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes dn_slide_left {
      from { transform: translateX(-10px); opacity: .6; }
      to { transform: translateX(0); opacity: 1; }
    }
    /* ✅ responsive: keep 1 line and smaller overall */
    @media (max-width: 420px) {
      [aria-label="Date navigator"] button {
        width: 34px !important;
        height: 32px !important;
        font-size: 14px !important;
        border-radius: 10px !important;
      }
    }
  `;
  document.head.appendChild(style);
}