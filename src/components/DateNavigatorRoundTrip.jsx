// src/components/DateNavigatorRoundTrip.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function DateNavigatorRoundTrip({
  anchorDepart,
  anchorReturn,
  activeTab = "depart",
  isLoading = false,
  lang = "en",
  minDate,
  onNavigate,

  // ✅ NEW: min price props
  minTotal = null,
  minDepart = null,
  minReturn = null,
  currency = "THB",
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

  const departDow = getDow(activeDepart, lang);
  const departDowStyle = getDowStyleByRuleVivid(activeDepart);

  const returnDow = getDow(activeReturn, lang);
  const returnDowStyle = getDowStyleByRuleVivid(activeReturn);

  // split for perfect vertical alignment
  const dDay = fmtDayNum(activeDepart);
  const dMon = fmtMon3(activeDepart);

  const rDay = fmtDayNum(activeReturn);
  const rMon = fmtMon3(activeReturn);

  // ✅ NEW: light highlight for minimum price row (use DEPART day only)
  const minRowTint = useMemo(() => {
    return getLightFromVivid(getDowStyleByRuleVivid(activeDepart));
  }, [activeDepart]);

  return (
    <section style={styles.wrap} aria-label="Date navigator">
      {/* ✅ Perfect centering: 1fr | center(auto) | 1fr */}
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
            ⏪
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
            ◀
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
            ▶
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
              const a = anchorDepartRef.current || startOfToday();
              setAnimDir("none");
              doNavigate(a);
            }}
          >
            <span style={styles.resetBullet}>●</span>
          </button>
        </div>
      </div>

      {/* ✅ NEW: Minimum price row (clean & soft highlight by Depart DOW) */}
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
  if (day === 1) return { background: "#f1f3e3", borderColor: "#f0ec17", color: "#a1a908d3" };
  if (day === 2) return { background: "#f4e5f0", borderColor: "#f62fc1", color: "#f424e6" };
  if (day === 3) return { background: "#a9f9d0", borderColor: "#10b981", color: "#0dbf8c" };
  if (day === 4) return { background: "#f5e9d7", borderColor: "#f0954b", color: "#e08d06" };
  if (day === 5) return { background: "#d3e4fa", borderColor: "#3b82f6", color: "#1b8df8" };
  return { background: "#e2d0f5", borderColor: "#8b5cf6", color: "#752cf4" };
}

// ✅ convert vivid color to a very light background tint
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
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    columnGap: 8,
    whiteSpace: "nowrap",
  },

  sideLeft: { justifySelf: "start", display: "flex", alignItems: "center", gap: 6 },
  sideRight: { justifySelf: "end", display: "flex", alignItems: "center", gap: 6 },

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

  center: { justifySelf: "center", display: "flex", alignItems: "center", justifyContent: "center" },

  lines: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },

  line: {
    display: "grid",
    gridTemplateColumns: "74px auto",
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
    color: "rgba(15,23,42,0.70)",
    fontWeight: 300,
    letterSpacing: ".2px",
    fontVariantNumeric: "tabular-nums",
  },
  dateWrapBold: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 5,
    whiteSpace: "nowrap",
    color: "rgba(15,23,42,0.70)",
    fontWeight: 700,
    letterSpacing: ".2px",
    fontVariantNumeric: "tabular-nums",
  },
dayNum: {
  width: 26,
  textAlign: "right",
  fontSize: 16,                  // เด่นกว่า month
  fontWeight: 800,
  color: "rgba(15,23,42,0.88)",  // deep slate (premium)
},

monTxt: {
  width: 40,
  textAlign: "left",
  fontSize: 13,                  // เล็กกว่า day ให้เห็น hierarchy
  fontWeight: 800,
  letterSpacing: "0.8px",
  color: "rgba(14,165,233,0.95)", // SkyBlue (tailwind sky-500 느낌)
  /* ถ้าอยากให้เดือน “เป็นธีม skyblue มากขึ้น” เปิด 3 บรรทัดนี้ */
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
  resetBullet: { color: SKY, fontSize: 22, lineHeight: "1", transform: "translateY(-1px)" },

  slideRight: { animation: "dnrt_slide_right 220ms ease" },
  slideLeft: { animation: "dnrt_slide_left 220ms ease" },

  // ✅ NEW: minimum price row
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

/* ✅ Always update style tag */
if (typeof document !== "undefined") {
  const css = `
    @keyframes dnrt_slide_right {
      from { transform: translateX(10px); opacity: .6; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes dnrt_slide_left {
      from { transform: translateX(-10px); opacity: .6; }
      to { transform: translateX(0); opacity: 1; }
    }

    [aria-label="Date navigator"] .dnrt-dow {
      border-radius: 6px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    @media (max-width: 420px) {
      [aria-label="Date navigator"] button {
        width: 34px !important;
        height: 32px !important;
        font-size: 14px !important;
        border-radius: 10px !important;
      }
      [aria-label="Date navigator"] .dnrt-day,
      [aria-label="Date navigator"] .dnrt-mon { font-size: 9px !important; }

      [aria-label="Date navigator"] .dnrt-dow {
        font-size: 8px !important;
        padding: 1px 5px !important;
        border-radius: 6px !important;
        min-width: 26px !important;
      }
    }

    @media (min-width: 640px) {
      [aria-label="Date navigator"] .dnrt-lines {
        flex-direction: row !important;
        gap: 18px !important;
      }
      [aria-label="Date navigator"] .dnrt-line {
        grid-template-columns: auto auto !important;
      }
      [aria-label="Date navigator"] .dnrt-day,
      [aria-label="Date navigator"] .dnrt-mon { width: auto !important; }
    }
  `;

  let styleEl = document.getElementById("dnrt_keyframes");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "dnrt_keyframes";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}