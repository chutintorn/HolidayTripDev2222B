import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props:
 *  - anchorDate
 *  - isLoading
 *  - lang
 *  - onNavigate
 *  - minDate
 *  - minTotal
 *  - currency
 *  - onClearSelection
 *  - onViewSelection
 *  - clearDisabled
 *  - viewDisabled
 */
export default function DateNavigatorOneWay({
  anchorDate,
  isLoading = false,
  lang = "en",
  onNavigate,
  minDate,
  minTotal = null,
  currency = "THB",

  // ✅ NEW
  onClearSelection,
  onViewSelection,
  clearDisabled = false,
  viewDisabled = false,
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

  const dow = getDow(activeDate, lang);
  const dowStyle = getDowStyleByRuleVivid(activeDate);

  const { day: dDay, mon: dMon } = fmtDayMon(activeDate);

  const minRowTint = useMemo(() => {
    return getLightFromVivid(getDowStyleByRuleVivid(activeDate));
  }, [activeDate]);

  return (
    <section style={styles.wrap} aria-label="Date navigator">

      {/* NAVIGATION ROW */}
      <div style={styles.navRow}>
        <button
          type="button"
          style={{ ...styles.btn, ...(prevWeekDisabled ? styles.btnDisabled : null) }}
          disabled={prevWeekDisabled}
          onClick={() => doNavigate(addDays(activeDate, -7))}
        >
          ⏪
        </button>

        <button
          type="button"
          style={{ ...styles.btn, ...(prevDayDisabled ? styles.btnDisabled : null) }}
          disabled={prevDayDisabled}
          onClick={() => doNavigate(addDays(activeDate, -1))}
        >
          ◀
        </button>

        <div style={styles.center}>
          <div style={styles.bigDate}>
            <span style={styles.dayNum}>{dDay}</span>
            <span style={styles.monTxt}>{dMon}</span>
          </div>
          <div style={{ ...styles.dowPill, ...dowStyle }}>{dow}</div>
        </div>

        <button
          type="button"
          style={{ ...styles.btn, ...(nextDayDisabled ? styles.btnDisabled : null) }}
          disabled={nextDayDisabled}
          onClick={() => doNavigate(addDays(activeDate, +1))}
        >
          ▶
        </button>

        <button
          type="button"
          style={{ ...styles.btn, ...(nextWeekDisabled ? styles.btnDisabled : null) }}
          disabled={nextWeekDisabled}
          onClick={() => doNavigate(addDays(activeDate, +7))}
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
          onClick={() => {
            const a = anchorRef.current || startOfToday();
            doNavigate(a);
          }}
        >
          ●
        </button>
      </div>

      {/* MINIMUM PRICE */}
      <div
        style={{
          ...styles.minRow,
          background: minRowTint.background,
          borderColor: minRowTint.borderColor,
        }}
      >
        <div style={styles.minLabel}>
          {lang === "th" ? "ราคาต่ำสุด" : "Minimum price"}
        </div>

        <div style={styles.minValue}>
          {minTotal === null ? "—" : `${fmtMoney(minTotal)} `}
          <span style={styles.minChip}>{currency}</span>
        </div>
      </div>

      {/* ✅ ACTION BUTTONS UNDER MIN PRICE */}
      <div style={styles.actionRow}>
        <button
          type="button"
          onClick={() => onClearSelection && onClearSelection()}
          disabled={isLoading || clearDisabled}
          style={{
            ...styles.actionBtn,
            ...(isLoading || clearDisabled ? styles.btnDisabled : null),
          }}
        >
          {lang === "th" ? "ล้างที่เลือก" : "Clear selection"}
        </button>

        <button
          type="button"
          onClick={() => onViewSelection && onViewSelection()}
          disabled={isLoading || viewDisabled}
          style={{
            ...styles.actionBtn,
            ...styles.viewBtn,
            ...(isLoading || viewDisabled ? styles.btnDisabled : null),
          }}
        >
          {lang === "th" ? "ดูที่เลือก" : "View selection"}
        </button>
      </div>

      <div style={styles.toast} id="dn_toast" />
    </section>
  );
}

/* ------------------ helpers ------------------ */

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
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
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
  if (day === 1) return { background: "#f1f3e3", borderColor: "#f0ec17", color: "#a1a908" };
  if (day === 2) return { background: "#f4e5f0", borderColor: "#f62fc1", color: "#f424e6" };
  if (day === 3) return { background: "#a9f9d0", borderColor: "#10b981", color: "#0dbf8c" };
  if (day === 4) return { background: "#f5e9d7", borderColor: "#f0954b", color: "#e08d06" };
  if (day === 5) return { background: "#d3e4fa", borderColor: "#3b82f6", color: "#1b8df8" };
  return { background: "#e2d0f5", borderColor: "#8b5cf6", color: "#752cf4" };
}
function getLightFromVivid(vivid) {
  return {
    background: vivid.background + "55",
    borderColor: vivid.borderColor + "88",
  };
}
function toast(msg) {
  const el = document.getElementById("dn_toast");
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = "1";
  setTimeout(() => (el.style.opacity = "0"), 1200);
}

/* ------------------ styles ------------------ */

const styles = {
  wrap: {
    marginTop: 12,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "10px 12px 14px",
  },
  navRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  btn: {
    width: 36,
    height: 32,
    borderRadius: 6,
    border: "1px solid #0ea5e9",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    color: "#0ea5e9",
  },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  center: { flex: 1, display: "flex", justifyContent: "center", gap: 8 },
  bigDate: { display: "flex", gap: 4 },
  dayNum: { fontWeight: 800 },
  monTxt: { fontWeight: 800, color: "#0ea5e9" },
  dowPill: { padding: "2px 6px", borderRadius: 8, border: "1px solid" },
  resetBtn: { background: "#e0f2fe" },

  minRow: {
    marginTop: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid transparent",
    display: "flex",
    justifyContent: "space-between",
  },
  minLabel: { fontSize: 12 },
  minValue: { fontWeight: 800 },
  minChip: {
    marginLeft: 6,
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 999,
    background: "#e9f2ff",
    border: "1px solid #c8defa",
  },

  actionRow: {
  marginTop: 10,
  display: "flex",
  gap: 10,
},

actionBtn: {
  flex: 1,
  height: 32,
  borderRadius: 6,
  border: "1px solid #d1d5db",     // light gray border
  background: "#ffffff",           // white background
  fontSize: 12,
  fontWeight: 400,                 // NOT bold
  color: "#475569",                // soft slate gray text
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "all 0.15s ease",
},

viewBtn: {
  background: "#ffffff",           // same white
  border: "1px solid #cbd5e1",     // slightly cooler gray
  color: "#475569",
},
};