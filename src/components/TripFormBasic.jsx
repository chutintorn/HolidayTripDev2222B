// src/components/TripFormBasic.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { DateRangePicker, CustomProvider } from "rsuite";
import enGB from "rsuite/locales/en_GB";
import thTH from "rsuite/locales/th_TH";
import useT from "../i18n/useT";
import MultiCityPopup from "./MultiCityPopup";

// 🔌 Redux
import { useDispatch, useSelector } from "react-redux";
import { fetchSearchResults, selectSearch } from "../redux/searchSlice";
import JourneyTable from "./JourneyTable";
import RoundTripResultsLite from "./RoundTripResultsLite"; // ⬅️ Supports depart/return split

// 🛫 Airport dropdown component (reads from airportsSlice)
import AirportSelect from "./AirportSelect";

/* ---------------------------------------------
 * Helpers
 * -------------------------------------------*/

/** Responsive hook: treat viewport < 768px as "mobile" */
function useIsMobile(breakpoint = 768) {
  const get = () =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false;

  const [isMobile, setIsMobile] = useState(get());

  useEffect(() => {
    const onResize = () => setIsMobile(get());
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onResize);
      }
    };
  }, [breakpoint]);

  return isMobile;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** UI date formatter: 31-Aug-SUN (or Su) */
const formatUiDate = (date, style = "SUN") => {
  if (!date) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const MMM = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()];
  const DOW3 = ["SUN","MON","TUE","WED","THU","FRI","SAT"][date.getDay()];
  const DOW2 = ["Su","Mo","Tu","We","Th","Fr","Sa"][date.getDay()];
  const dow = style === "Su" ? DOW2 : DOW3;
  return `${dd}-${MMM}-${dow}`;
};

/** Serialize to YYYY-MM-DD in *local time* (avoids off-by-one UTC issues) */
const toYMDLocal = (d) => {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/* ---------------------------------------------
 * Responsive single-date picker
 *  - Mobile: one calendar
 *  - Desktop: two calendars
 * -------------------------------------------*/
function TwoMonthSingleDatePicker({
  value,
  onChange,
  minDate,
  placeholder,
  renderValue,
  className,
  style,
  locale,
  placement = "bottomEnd",
  /** Optional override to force behavior regardless of screen */
  forceOneCalendar, // true | false | undefined
}) {
  const isMobile = useIsMobile();
  const showOne = typeof forceOneCalendar === "boolean" ? forceOneCalendar : isMobile;

  return (
    <DateRangePicker
      oneTap
      isoWeek
      showOneCalendar={showOne}     // one panel on mobile, two on desktop
      size={showOne ? "md" : "lg"}  // slightly smaller on mobile
      format="yyyy-MM-dd"
      value={value ? [value, value] : null}
      onChange={(range) => onChange(range && range[0] ? range[0] : null)}
      placeholder={placeholder}
      className={className}
      style={style || { width: "100%" }}
      locale={locale}
      placement={placement}
      disabledDate={(d) => !!(minDate && d < minDate)}
      renderValue={(range) => {
        const v = Array.isArray(range) && range[0] ? range[0] : null;
        return renderValue ? renderValue(v) : "";
      }}
    />
  );
}

/* ---------------------------------------------
 * Component
 * -------------------------------------------*/
export default function TripFormBasic({ onSubmit }) {
  const t = useT();
  const calendarLocale =
    t?.lang === "th" || t?.locale === "th" || t?.locale === "th-TH" ? thTH : enGB;
  const weekdayStyle = "SUN";

  // ---- Redux (search) ----
  const dispatch = useDispatch();
  const { status, error, results } = useSelector(selectSearch);

  // ---- local state ----
  const [tripType, setTripType] = useState("oneway"); // "oneway" | "roundtrip" | "multicity"

  // 🛫 Use IATA codes from the dropdowns (e.g., "DMK", "BKK", "CNX")
  const [origin, setOrigin] = useState("");       // was "Bangkok"
  const [destination, setDestination] = useState(""); // was "Chiang Mai"

  const [depart, setDepart] = useState(startOfToday());
  const [ret, setRet] = useState(null);

  const [adult, setAdult] = useState(1);
  const [child, setChild] = useState(0);
  const [infant, setInfant] = useState(0);
  const [cabin, setCabin] = useState("ECONOMY");

  // Multi-city
  const [mcOpen, setMcOpen] = useState(false);
  const [mcSegments, setMcSegments] = useState([
    { from: "", to: "", date: startOfToday() },
    { from: "", to: "", date: null },
  ]);

  const [showPax, setShowPax] = useState(false);
  const paxRef = useRef(null);

  const today = useMemo(startOfToday, []);

  // ---- helpers ----
  const clampInt = (val, min, max = Infinity) =>
    Math.max(min, Math.min(max, Number.parseInt(val ?? 0, 10) || 0));

  const switchTripType = (type) => {
    setTripType(type);
    if (type === "oneway") setRet(null);
  };

  const swapFromTo = () => {
    setOrigin((prev) => {
      const o = prev;
      setDestination(o);
      return destination;
    });
  };

  // infants ≤ adults
  useEffect(() => {
    setInfant((x) => Math.min(x ?? 0, adult ?? 0));
  }, [adult]);

  const paxSummary = useMemo(() => {
    const parts = [];
    if (adult) parts.push(`${adult} ${adult > 1 ? (t.form?.adults ?? "adults") : (t.form?.adult ?? "adult")}`);
    if (child) parts.push(`${child} ${t.form?.children ?? "children"}`);
    if (infant) parts.push(`${infant} ${t.form?.infants ?? "infants"}`);
    const cabinText = cabin === "BUSINESS" ? (t.form?.business ?? "Business") : (t.form?.economy ?? "Economy");
    return `${parts.length ? parts.join(", ") : "0"}, ${cabinText}`;
  }, [adult, child, infant, cabin, t]);

  // close pax dropdown on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!paxRef.current) return;
      if (!paxRef.current.contains(e.target)) setShowPax(false);
    };
    if (showPax) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showPax]);

  // ---- submit (uses Redux thunk) ----
  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic validation
    if (!origin || !destination || !depart) {
      alert(t?.form?.pleaseFill ?? "Please select origin, destination, and departure date.");
      return;
    }

    // Multicity (not yet wired to Redux)
    if (tripType === "multicity") {
      const payload = {
        tripType,
        segments: mcSegments
          .filter((s) => s.from && s.to && s.date)
          .map((s) => ({
            origin: s.from.trim().toUpperCase(),
            destination: s.to.trim().toUpperCase(),
            date: toYMDLocal(s.date), // <-- local-safe
          })),
        pax: {
          adult: clampInt(adult, 1),
          child: clampInt(child, 0),
          infant: clampInt(Math.min(infant ?? 0, adult ?? 0), 0),
        },
        cabin,
        currency: "THB",
        promoCode: null,
      };
      if (onSubmit) onSubmit(payload);
      else alert("Multicity payload (not yet integrated to Redux):\n" + JSON.stringify(payload, null, 2));
      return;
    }

    // Oneway / Roundtrip → dispatch search thunk
    const payload = {
      origin: origin.trim().toUpperCase(),           // e.g., DMK
      destination: destination.trim().toUpperCase(), // e.g., CNX
      depart: toYMDLocal(depart),                    // <-- local-safe
      ret: tripType === "roundtrip" ? toYMDLocal(ret) : null, // <-- local-safe
      adult: clampInt(adult, 1),
      child: clampInt(child, 0),
      infant: clampInt(Math.min(infant ?? 0, adult ?? 0), 0),
      cabin,
      promoCode: null,
    };
    dispatch(fetchSearchResults(payload));
    setShowPax(false);
  };

  // ---- styles ----
  const pill =
    "w-full h-14 rounded-2xl border border-slate-200 bg-white px-4 " +
    "text-[16px] shadow-sm focus-within:ring focus-within:ring-sky-200/70 focus-within:border-sky-500 " +
    "flex items-center justify-between";
  const chipBtn = (active) =>
    `h-10 px-4 rounded-full text-sm font-medium transition ${
      active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    }`;
  const iconBtn =
    "h-12 w-12 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm";

  const Stepper = ({ value, setValue, min, max = Infinity }) => (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setValue(clampInt((value ?? 0) - 1, min, max))}
        className="h-9 w-9 rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 text-xl leading-none"
        aria-label="decrease"
      >
        −
      </button>
      <span className="w-6 text-center font-medium text-slate-800">{value}</span>
      <button
        type="button"
        onClick={() => setValue(clampInt((value ?? 0) + 1, min, max))}
        className="h-9 w-9 rounded-full border border-slate-300 text-sky-600 hover:bg-slate-50 text-xl leading-none"
        aria-label="increase"
      >
        +
      </button>
    </div>
  );

  // dynamic spans
  const fromSpan = tripType === "roundtrip" ? "md:col-span-3" : "md:col-span-4";
  const toSpan = tripType === "roundtrip" ? "md:col-span-3" : "md:col-span-4";
  const departSpan = tripType === "roundtrip" ? "md:col-span-2" : "md:col-span-3";
  const returnSpan = "md:col-span-3";

  return (
    <CustomProvider locale={calendarLocale}>
      <form onSubmit={handleSubmit} className="bg-white/90 rounded-3xl shadow-lg p-4 md:p-6 space-y-4">
        {/* trip type */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => switchTripType("roundtrip")} className={chipBtn(tripType === "roundtrip")}>
              {t.form?.roundtrip ?? "Round-trip"}
            </button>
            <button type="button" onClick={() => switchTripType("oneway")} className={chipBtn(tripType === "oneway")}>
              {t.form?.oneway ?? "One-way"}
            </button>
            <button
              type="button"
              onClick={() => { setTripType("multicity"); setMcOpen(true); }}
              className={chipBtn(tripType === "multicity")}
            >
              {t.form?.multicity ?? "Multi-city"}
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
            {t.form?.nonstop ?? "Nonstop"}
          </label>
        </div>

        {/* MAIN ROWS */}
        {tripType !== "multicity" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* From (Dropdown) */}
              <div className={fromSpan}>
                <AirportSelect
                  value={origin}
                  onChange={setOrigin}
                  placeholder={t.placeholders?.from ?? "From"}
                />
                <div className="px-1 pt-1 text-xs text-slate-500">{t.form?.allAirports ?? "All airports"}</div>
              </div>

              {/* swap */}
              <div className="md:col-span-1 flex justify-center">
                <button type="button" onClick={swapFromTo} className={iconBtn} title={t.form?.swap ?? "Swap"}>
                  ↔
                </button>
              </div>

              {/* To (Dropdown) */}
              <div className={toSpan}>
                <AirportSelect
                  value={destination}
                  onChange={setDestination}
                  placeholder={t.placeholders?.to ?? "To"}
                />
                <div className="px-1 pt-1 text-xs text-slate-500">{t.form?.allAirports ?? "All airports"}</div>
              </div>

              {/* Depart */}
              <div className={departSpan}>
                <div className="w-full">
                  <TwoMonthSingleDatePicker
                    value={depart}
                    onChange={(val) => {
                      setDepart(val);
                      if (ret && val && ret < val) setRet(val);
                    }}
                    minDate={today}
                    placeholder={t.form?.depart ?? "Depart"}
                    renderValue={(v) => (v ? formatUiDate(v, weekdayStyle) : "")}
                    className="ibe-datepicker w-full"
                    style={{ width: "100%" }}
                    locale={calendarLocale}
                    placement="bottomEnd"
                  />
                </div>
              </div>

              {/* Return */}
              {tripType === "roundtrip" && (
                <div className={returnSpan}>
                  <div className="w-full">
                    <TwoMonthSingleDatePicker
                      value={ret}
                      onChange={setRet}
                      minDate={depart || today}
                      placeholder={t.form?.return ?? "Return"}
                      renderValue={(v) => (v ? formatUiDate(v, weekdayStyle) : "")}
                      className="ibe-datepicker w-full"
                      style={{ width: "100%"}}
                      locale={calendarLocale}
                      placement="bottomEnd"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          // Multi-city mode: show compact summary + “Edit itinerary”
          <div className="flex items-center justify-between gap-3">
            <div className="text-slate-700">
              {mcSegments
                .map((s, i) => `${i + 1}. ${s.from || "—"} → ${s.to || "—"} ${s.date ? "(" + formatUiDate(s.date, weekdayStyle) + ")" : ""}`)
                .join("   ")}
            </div>
            <button
              type="button"
              onClick={() => setMcOpen(true)}
              className="h-11 px-4 rounded-xl border border-slate-300 hover:bg-slate-50"
            >
              Edit itinerary
            </button>
          </div>
        )}

        {/* passenger + cabin summary */}
        <div className="relative" ref={paxRef}>
          <button
            type="button"
            onClick={() => setShowPax((s) => !s)}
            className="w-full md:w-auto h-14 rounded-2xl border border-slate-200 bg-white px-4 text-[16px] shadow-sm hover:bg-slate-50 flex items-center gap-2"
          >
            <span aria-hidden>👤</span>
            <span className="font-medium text-slate-800">{paxSummary}</span>
          </button>

          {showPax && (
            <div className="absolute z-50 mt-2 w-full md:w-[520px] right-0 rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="text-slate-700 font-semibold">
                  {t.form?.passengersTitle ?? "Please select the exact number of passengers to view the best prices"}
                </div>
              </div>

              <div className="px-5 py-4 space-y-4">
                <Row label={t.form?.adults ?? "Adults"}>
                  <Stepper
                    value={adult}
                    setValue={(v) => {
                      const nv = clampInt(v, 1);
                      setAdult(nv);
                      setInfant((x) => Math.min(x ?? 0, nv));
                    }}
                    min={1}
                  />
                </Row>

                <Row label={t.form?.children ?? "Children"} hint={t.form?.childrenAgeHint ?? "2–11 years old"}>
                  <Stepper value={child} setValue={(v) => setChild(clampInt(v, 0))} min={0} />
                </Row>

                <Row label={t.form?.infants ?? "Infants on lap"} hint={t.form?.infantsAgeHint ?? "Under 2 years old"}>
                  <Stepper value={infant} setValue={(v) => setInfant(clampInt(v, 0, adult))} min={0} max={adult} />
                </Row>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">{t.form?.cabin ?? "Cabin"}</label>
                  <select
                    value={cabin}
                    onChange={(e) => setCabin(e.target.value)}
                    className="w-full h-12 rounded-xl border border-slate-300 px-3 text-[16px] focus:border-sky-500 focus:ring focus:ring-sky-200/60"
                  >
                    <option value="ECONOMY">{t.form?.economy ?? "Economy"}</option>
                    <option value="BUSINESS">{t.form?.business ?? "Business"}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
                <button
                  type="button"
                  className="h-11 px-4 rounded-xl border border-slate-300 hover:bg-slate-50"
                  onClick={() => setShowPax(false)}
                >
                  {t.form?.done ?? "Done"}
                </button>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="h-11 px-6 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 shadow disabled:opacity-60"
                  onClick={() => setShowPax(false)}
                >
                  {status === "loading" ? (t.form?.searching ?? "Searching...") : (t.form?.search ?? "Search")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* bottom submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={status === "loading"}
            className="h-12 px-6 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 shadow disabled:opacity-60"
          >
            {status === "loading" ? (t.form?.searching ?? "Searching...") : (t.form?.search ?? "Search")}
          </button>
        </div>

        {/* error from Redux */}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>

      {/* Multi-city popup */}
      <MultiCityPopup
        open={mcOpen}
        onClose={() => setMcOpen(false)}
        onApply={(rows) => {
          setMcSegments(rows);
          setMcOpen(false);
        }}
        initialSegments={mcSegments}
        locale={calendarLocale}
        weekdayStyle={weekdayStyle}
        today={today}
      />

      {/* Results: show 2 boxes when multiple legs, else one-way table */}
      {results && (
        Array.isArray(results?.data) && results.data.length > 1 ? (
          <RoundTripResultsLite />
        ) : (
          <JourneyTable showNextButton />
        )
      )}
    </CustomProvider>
  );
}

/* small layout helper for pax rows */
function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold text-slate-800">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
