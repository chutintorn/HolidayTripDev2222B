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
 *  - hasSelection
 *  - isViewActive
 */
export default function DateNavigatorOneWay({
  anchorDate,
  isLoading = false,
  lang = "en",
  onNavigate,
  minDate,
  minTotal = null,
  currency = "THB",

  onClearSelection,
  onViewSelection,
  clearDisabled = false,
  viewDisabled = false,

  hasSelection = false,
  isViewActive = false,
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

  const dowDisplay =
    lang === "th" ? dow : String(dow).toUpperCase().split("").join(" ");

  const { day: dDay, mon: dMon } = fmtDayMon(activeDate);

  const minRowTint = useMemo(() => {
    return getLightFromVivid(getDowStyleByRuleVivid(activeDate));
  }, [activeDate]);

  const viewBtnStyle = isViewActive
    ? styles.viewBtnActive
    : hasSelection
    ? styles.viewBtnHighlight
    : styles.viewBtnIdle;

  return (
    <section style={styles.wrap} aria-label="Date navigator">
      <div style={styles.actionRowTop}>
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
          disabled={isLoading}
          style={{
            ...styles.actionBtn,
            ...viewBtnStyle,
            ...(isLoading ? styles.btnDisabled : null),
          }}
        >
          {lang === "th" ? "ดูที่เลือก" : "View selection"}
        </button>
      </div>

      <div style={styles.navRow}>
        <button
          type="button"
          style={{
            ...styles.btn,
            ...styles.btnWeek,
            ...(prevWeekDisabled ? styles.btnDisabled : null),
          }}
          disabled={prevWeekDisabled}
          onClick={() => doNavigate(addDays(activeDate, -7))}
          aria-label="Back 7 days"
          title={lang === "th" ? "ย้อนกลับ 7 วัน" : "Back 7 days"}
        >
          «
        </button>

        <button
          type="button"
          style={{
            ...styles.btn,
            ...styles.btnDay,
            ...(prevDayDisabled ? styles.btnDisabled : null),
          }}
          disabled={prevDayDisabled}
          onClick={() => doNavigate(addDays(activeDate, -1))}
          aria-label="Back 1 day"
          title={lang === "th" ? "ย้อนกลับ 1 วัน" : "Back 1 day"}
        >
          ‹
        </button>

        <div style={styles.center}>
          <div style={styles.bigDate}>
            <span style={styles.dayNum}>{dDay}</span>
            <span style={styles.monTxt}>{dMon}</span>
          </div>

          <div style={{ ...styles.dowPill, ...dowStyle }}>{dowDisplay}</div>
        </div>

        <button
          type="button"
          style={{
            ...styles.btn,
            ...styles.btnDay,
            ...(nextDayDisabled ? styles.btnDisabled : null),
          }}
          disabled={nextDayDisabled}
          onClick={() => doNavigate(addDays(activeDate, +1))}
          aria-label="Forward 1 day"
          title={lang === "th" ? "ไปข้างหน้า 1 วัน" : "Forward 1 day"}
        >
          ›
        </button>

        <button
          type="button"
          style={{
            ...styles.btn,
            ...styles.btnWeek,
            ...(nextWeekDisabled ? styles.btnDisabled : null),
          }}
          disabled={nextWeekDisabled}
          onClick={() => doNavigate(addDays(activeDate, +7))}
          aria-label="Forward 7 days"
          title={lang === "th" ? "ไปข้างหน้า 7 วัน" : "Forward 7 days"}
        >
          »
        </button>


      </div>

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

      <div style={styles.toast} id="dn_toast" />
    </section>
  );
}

/* helpers */

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
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return {
    day: String(d.getDate()).padStart(2, "0"),
    mon: months[d.getMonth()],
  };
}

function getDow(d, lang) {
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const th = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  return lang === "th" ? th[d.getDay()] : en[d.getDay()];
}

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function getDowStyleByRuleVivid(d) {
  const day = d.getDay();
  if (day === 0)
    return { background: "#edddde", borderColor: "#f58293", color: "#f7084c" };
  if (day === 1)
    return { background: "#f1f3e3", borderColor: "#f0ec17", color: "#a1a908" };
  if (day === 2)
    return { background: "#f4e5f0", borderColor: "#f62fc1", color: "#f424e6" };
  if (day === 3)
    return { background: "#a9f9d0", borderColor: "#10b981", color: "#0dbf8c" };
  if (day === 4)
    return { background: "#f5e9d7", borderColor: "#f0954b", color: "#e08d06" };
  if (day === 5)
    return { background: "#d3e4fa", borderColor: "#3b82f6", color: "#1b8df8" };
  return { background: "#e2d0f5", borderColor: "#8b5cf6", color: "#752cf4" };
}

function getLightFromVivid(vivid) {
  return {
    background: vivid.background + "44",
    borderColor: vivid.borderColor + "77",
  };
}

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

/* styles */

const styles = {
  wrap: {
    marginTop: 10,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "8px 10px 10px",
    boxShadow: "0 6px 14px rgba(2,6,23,.05)",
  },

  actionRowTop: {
    display: "flex",
    gap: 8,
    marginBottom: 8,
  },

  actionBtn: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    background: "#F8FAFC",
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "all 0.15s ease",
    padding: "0 10px",
  },

  viewBtnIdle: {
    background: "#FFFFFF",
    border: "1px solid #C7D9FF",
    color: "#1E40AF",
  },

  viewBtnHighlight: {
    background: "#EAF2FF",
    border: "1px solid #C7D9FF",
    color: "#1E40AF",
  },

  viewBtnActive: {
    background: "#2563EB",
    border: "1px solid #2563EB",
    color: "#FFFFFF",
  },

  navRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    padding: "2px 0",
    minHeight: 34,
  },

  btn: {
    width: 38,
    height: 32,
    borderRadius: 10,
    border: "1px solid #EEF2F7",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    color: "#94A3B8",
    fontSize: 18,
    lineHeight: "1",
    userSelect: "none",
    transition: "all 0.15s ease",
    padding: 0,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
  },

btnDay: {
  fontSize: 22,
  color: "rgba(100,116,139,0.8)",
},

btnWeek: {
  fontSize: 20,
  color: "rgba(168,179,195,0.8)",
  letterSpacing: 0,
},

  resetBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid #EEF2F7",
    background: "#F8FAFC",
    color: "#64748B",
    fontSize: 10,
    lineHeight: "1",
  },

  btnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },

  center: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  bigDate: {
    display: "flex",
    gap: 4,
    alignItems: "baseline",
    whiteSpace: "nowrap",
  },

  dayNum: {
    fontWeight: 700,
    fontSize: 17,
    color: "#0F172A",
    lineHeight: 1,
  },

  monTxt: {
    fontWeight: 700,
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 1,
    letterSpacing: "0.4px",
  },

  dowPill: {
    padding: "2px 7px",
    borderRadius: 3,
    border: "1px solid",
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: 1.6,
    lineHeight: "1",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 18,
  },

  minRow: {
    marginTop: 6,
    padding: "7px 10px",
    borderRadius: 12,
    border: "1px solid transparent",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  minLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: 650,
  },

  minValue: {
    fontWeight: 900,
    fontSize: 16,
    color: "#111827",
    whiteSpace: "nowrap",
  },

  minChip: {
    marginLeft: 6,
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #E9EDF3",
    fontWeight: 900,
  },

  toast: {
    marginTop: 6,
    fontSize: 11,
    color: "#0f172a",
    opacity: 0,
    transition: "opacity 0.2s ease",
  },
};