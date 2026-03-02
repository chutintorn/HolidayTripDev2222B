import React, { useEffect, useMemo, useRef, useState } from "react";

export default function DateNavigatorRoundTrip({
  anchorDepart,
  anchorReturn,
  activeTab = "depart",
  isLoading = false,
  lang = "en",
  minDate,
  onNavigate,

  // ✅ min price props (keep compatible)
  minTotal = null,
  minDepart = null,
  minReturn = null,
  currency = "THB",

  // ✅ NEW (optional): put actions on TOP like one-way
  onClearSelection,
  onViewSelection,
  clearDisabled = false,
  viewDisabled = false,
}) {
  const [activeDepart, setActiveDepart] = useState(
    () => toDate(anchorDepart) || startOfToday()
  );

  const anchorDepartRef = useRef(toDate(anchorDepart) || startOfToday());
  const anchorReturnRef = useRef(toDate(anchorReturn) || addDays(startOfToday(), 1));
  const gapRef = useRef(calcGapDays(anchorDepartRef.current, anchorReturnRef.current));

  useEffect(() => {
    const d0 = toDate(anchorDepart);
    const r0 = toDate(anchorReturn);

    if (d0) anchorDepartRef.current = startOfDay(d0);
    if (r0) anchorReturnRef.current = startOfDay(r0);

    gapRef.current = calcGapDays(anchorDepartRef.current, anchorReturnRef.current);

    if (d0) setActiveDepart(startOfDay(d0));
  }, [anchorDepart, anchorReturn]);

  const minAllowed = useMemo(() => {
    const m = toDate(minDate);
    return startOfDay(m || startOfToday());
  }, [minDate]);

  const gapDays = gapRef.current;
  const activeReturn = useMemo(() => addDays(activeDepart, gapDays), [activeDepart, gapDays]);

  const canGoToDepart = (d) => startOfDay(d) >= minAllowed;

  const doNavigate = (targetDepart) => {
    const d = startOfDay(targetDepart);

    if (!canGoToDepart(d)) {
      toast(lang === "th" ? "ไม่ค้นหาวันย้อนหลัง" : "Past date blocked");
      return;
    }

    const r = addDays(d, gapDays);
    setActiveDepart(d);
    if (typeof onNavigate === "function") onNavigate({ departDate: d, returnDate: r });
  };

  const basePrevDayDisabled = isLoading || !canGoToDepart(addDays(activeDepart, -1));
  const basePrevWeekDisabled = isLoading || !canGoToDepart(addDays(activeDepart, -7));

  const prevDayDisabled = activeTab === "return" ? true : basePrevDayDisabled;
  const prevWeekDisabled = activeTab === "return" ? true : basePrevWeekDisabled;

  const nextDayDisabled = isLoading;
  const nextWeekDisabled = isLoading;
  const resetDisabled = isLoading;

  const [animDir, setAnimDir] = useState("none");
  const prevActiveRef = useRef(activeDepart);

  useEffect(() => {
    const prev = prevActiveRef.current;
    if (prev?.getTime && activeDepart?.getTime) {
      if (activeDepart.getTime() > prev.getTime()) setAnimDir("right");
      else if (activeDepart.getTime() < prev.getTime()) setAnimDir("left");
      else setAnimDir("none");
    }
    prevActiveRef.current = activeDepart;
  }, [activeDepart]);

  // DOW + style
  const departDowRaw = getDow(activeDepart, lang);
  const returnDowRaw = getDow(activeReturn, lang);

  // ✅ Sun -> S U N (EN only)
  const departDow =
    lang === "th" ? departDowRaw : String(departDowRaw).toUpperCase().split("").join(" ");
  const returnDow =
    lang === "th" ? returnDowRaw : String(returnDowRaw).toUpperCase().split("").join(" ");

  const departDowStyle = getDowStyleByRuleVivid(activeDepart);
  const returnDowStyle = getDowStyleByRuleVivid(activeReturn);

  // split for perfect alignment
  const dDay = fmtDayNum(activeDepart);
  const dMon = fmtMon3(activeDepart);
  const rDay = fmtDayNum(activeReturn);
  const rMon = fmtMon3(activeReturn);

  // light tint for minimum price row (depart day)
  const minRowTint = useMemo(() => {
    return getLightFromVivid(getDowStyleByRuleVivid(activeDepart));
  }, [activeDepart]);

  // ✅ Top actions: show ONLY when handlers provided
  const hasClear = typeof onClearSelection === "function";
  const hasView = typeof onViewSelection === "function";
  const showTopActions = hasClear || hasView;

  const clearBtnDisabled = isLoading || clearDisabled || !hasClear;
  const viewBtnDisabled = isLoading || viewDisabled || !hasView;

  return (
    <section style={styles.wrap} aria-label="Date navigator">
      {/* ✅ TOP ACTIONS (like one-way) */}
      {showTopActions && (
        <div style={styles.actionRowTop}>
          <button
            type="button"
            onClick={() => onClearSelection && onClearSelection()}
            disabled={clearBtnDisabled}
            style={{
              ...styles.actionBtn,
              ...(clearBtnDisabled ? styles.btnDisabled : null),
            }}
          >
            {lang === "th" ? "ล้างที่เลือก" : "Clear selection"}
          </button>

          <button
            type="button"
            onClick={() => onViewSelection && onViewSelection()}
            disabled={viewBtnDisabled}
            style={{
              ...styles.actionBtn,
              ...styles.viewBtn,
              ...(viewBtnDisabled ? styles.btnDisabled : null),
            }}
          >
            {lang === "th" ? "ดูที่เลือก" : "View selection"}
          </button>
        </div>
      )}

      {/* NAVIGATION ROW */}
      <div style={styles.navRow}>
        {/* LEFT */}
        <div style={styles.sideLeft}>
          <button
            type="button"
            style={{ ...styles.btn, ...(prevWeekDisabled ? styles.btnDisabled : null) }}
            disabled={prevWeekDisabled}
            aria-label="Back 1 week"
            onClick={() => {
              setAnimDir("left");
              doNavigate(addDays(activeDepart, -7));
            }}
          >
            «
          </button>

          <button
            type="button"
            style={{ ...styles.btn, ...(prevDayDisabled ? styles.btnDisabled : null) }}
            disabled={prevDayDisabled}
            aria-label="Back 1 day"
            onClick={() => {
              setAnimDir("left");
              doNavigate(addDays(activeDepart, -1));
            }}
          >
            ‹
          </button>
        </div>

        {/* CENTER */}
        <div style={styles.center} aria-label="Active date">
          <div className="dnrt-lines" style={styles.lines}>
            {/* depart */}
            <div className="dnrt-line" style={styles.line}>
              <div
                className="dnrt-date"
                style={{
                  ...styles.dateWrap,
                  ...(animDir === "right"
                    ? styles.slideRight
                    : animDir === "left"
                    ? styles.slideLeft
                    : null),
                }}
                key={`d-${activeDepart.toISOString()}`}
              >
                <span className="dnrt-day" style={styles.dayNum}>
                  {dDay}
                </span>
                <span className="dnrt-mon" style={styles.monTxt}>
                  {dMon}
                </span>
              </div>

              <span className="dnrt-dow" style={{ ...styles.dowPill, ...departDowStyle }}>
                {departDow}
              </span>
            </div>

            {/* return */}
            <div className="dnrt-line" style={styles.line}>
              <div
                className="dnrt-date"
                style={{
                  ...styles.dateWrapBold,
                  ...(animDir === "right"
                    ? styles.slideRight
                    : animDir === "left"
                    ? styles.slideLeft
                    : null),
                }}
                key={`r-${activeReturn.toISOString()}`}
              >
                <span className="dnrt-day" style={styles.dayNum}>
                  {rDay}
                </span>
                <span className="dnrt-mon" style={styles.monTxt}>
                  {rMon}
                </span>
              </div>

              <span className="dnrt-dow" style={{ ...styles.dowPill, ...returnDowStyle }}>
                {returnDow}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={styles.sideRight}>
          <button
            type="button"
            style={{ ...styles.btn, ...(nextDayDisabled ? styles.btnDisabled : null) }}
            disabled={nextDayDisabled}
            aria-label="Next 1 day"
            onClick={() => {
              setAnimDir("right");
              doNavigate(addDays(activeDepart, +1));
            }}
          >
            ›
          </button>

          <button
            type="button"
            style={{ ...styles.btn, ...(nextWeekDisabled ? styles.btnDisabled : null) }}
            disabled={nextWeekDisabled}
            aria-label="Next 1 week"
            onClick={() => {
              setAnimDir("right");
              doNavigate(addDays(activeDepart, +7));
            }}
          >
            »
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
              const a = anchorDepartRef.current || startOfToday();
              setAnimDir("none");
              doNavigate(a);
            }}
          >
            •
          </button>
        </div>
      </div>

      {/* MINIMUM PRICE */}
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
          {minTotal === null ? "—" : fmtMoney(minTotal)}{" "}
          <span style={styles.minChip}>{currency}</span>
        </div>
      </div>

      <div style={styles.toast} id="dn_toast_rt" role="status" aria-live="polite" />
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
function calcGapDays(depart, ret) {
  const d = startOfDay(depart);
  const r = startOfDay(ret);
  const diff = Math.round((r.getTime() - d.getTime()) / 86400000);
  return diff >= 1 ? diff : 1;
}
function fmtDayNum(d) {
  return String(d.getDate()).padStart(2, "0");
}
function fmtMon3(d) {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return months[d.getMonth()];
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
  if (day === 1) return { background: "#f1f3e3", borderColor: "#f0ec17", color: "#8a9307" };
  if (day === 2) return { background: "#f4e5f0", borderColor: "#f62fc1", color: "#d81fd0" };
  if (day === 3) return { background: "#a9f9d0", borderColor: "#10b981", color: "#0a9a71" };
  if (day === 4) return { background: "#f5e9d7", borderColor: "#f0954b", color: "#c87905" };
  if (day === 5) return { background: "#d3e4fa", borderColor: "#3b82f6", color: "#1b6fe6" };
  return { background: "#e2d0f5", borderColor: "#8b5cf6", color: "#6b28d9" };
}
function getLightFromVivid(vivid) {
  return {
    background: withAlpha(vivid.background, 0.22),
    borderColor: withAlpha(vivid.borderColor, 0.35),
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
  const el = document.getElementById("dn_toast_rt");
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = "0";
  }, 1200);
}

/* ========================= styles ========================= */
/**
 * เป้าหมาย UX:
 * - โทนอ่อน ไม่รก
 * - ลูกศรสีอ่อน (light gray)
 * - DOW เป็นสี่เหลี่ยมมุมโค้งเล็ก
 * - วัน/เดือนขนาดเล็กลง (ใกล้ 60%)
 */
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

  // ✅ top actions
  actionRowTop: {
    display: "flex",
    gap: 10,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    background: "#F8FAFC",
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  viewBtn: {
    background: "#EAF2FF",
    border: "1px solid #C7D9FF",
    color: "#1E40AF",
  },

  navRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    columnGap: 8,
    whiteSpace: "nowrap",
  },

  sideLeft: { justifySelf: "start", display: "flex", alignItems: "center", gap: 6 },
  sideRight: { justifySelf: "end", display: "flex", alignItems: "center", gap: 6 },

  // ✅ lighter arrows
  btn: {
    width: 40,
    height: 36,
    borderRadius: 12,
    border: "1px solid #EEF2F7",
    background: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    userSelect: "none",
    fontSize: 18,
    lineHeight: "1",
    display: "grid",
    placeItems: "center",
    color: "#94A3B8",
  },
  resetBtn: {
    background: "#F1F5F9",
    border: "1px solid #E2E8F0",
    color: "#64748B",
  },
  btnDisabled: { opacity: 0.55, cursor: "not-allowed" },

  center: { justifySelf: "center", display: "flex", alignItems: "center", justifyContent: "center" },

  lines: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },

  line: {
    display: "grid",
    gridTemplateColumns: "68px auto",
    alignItems: "center",
    columnGap: 8,
    justifyContent: "center",
  },

  dateWrap: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 5,
    whiteSpace: "nowrap",
    color: "rgba(15,23,42,0.78)",
    fontWeight: 400,
    letterSpacing: ".2px",
    fontVariantNumeric: "tabular-nums",
  },
  dateWrapBold: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 5,
    whiteSpace: "nowrap",
    color: "rgba(15,23,42,0.78)",
    fontWeight: 600,
    letterSpacing: ".2px",
    fontVariantNumeric: "tabular-nums",
  },

  // ✅ ลดขนาดลง (ใกล้ 60%)
  dayNum: {
    width: 24,
    textAlign: "right",
    fontSize: 13,
    fontWeight: 700,
    color: "rgba(15,23,42,0.88)",
  },
  monTxt: {
    width: 38,
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.8px",
    color: "rgba(14,165,233,0.95)",
  },

  // ✅ DOW rectangle tiny corner
  dowPill: {
    fontSize: 10,
    fontWeight: 900,
    padding: "2px 8px",
    borderRadius: 3,
    border: "1px solid",
    whiteSpace: "nowrap",
    lineHeight: "1",
    minWidth: 34,
    textAlign: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  slideRight: { animation: "dnrt_slide_right 220ms ease" },
  slideLeft: { animation: "dnrt_slide_left 220ms ease" },

  minRow: {
    marginTop: 10,
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  minLabel: { fontSize: 12, color: "rgba(15,23,42,0.70)", fontWeight: 600 },
  minValue: { fontSize: 14, color: "#0b4f8a", fontWeight: 900, whiteSpace: "nowrap" },
  minChip: {
    marginLeft: 6,
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#e9f2ff",
    border: "1px solid #c8defa",
    color: "#0b4f8a",
    fontWeight: 800,
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

/* ✅ keyframes */
if (typeof document !== "undefined") {
  const css = `
    @keyframes dnrt_slide_right { from { transform: translateX(10px); opacity: .6; } to { transform: translateX(0); opacity: 1; } }
    @keyframes dnrt_slide_left  { from { transform: translateX(-10px); opacity: .6; } to { transform: translateX(0); opacity: 1; } }
  `;
  let styleEl = document.getElementById("dnrt_keyframes");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "dnrt_keyframes";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}