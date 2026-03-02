// src/components/TripFormBasic.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { DateRangePicker, CustomProvider } from "rsuite";
import enGB from "rsuite/locales/en_GB";
import thTH from "rsuite/locales/th_TH";
import useT from "../i18n/useT";

// 🔌 Redux
import { useDispatch, useSelector } from "react-redux";
import { fetchSearchResults, selectSearch } from "../redux/searchSlice";

// ✅ clear old selection before new search (safety)
import { clearSelectedOfferLegs } from "../redux/offerSelectionSlice";

// ✅ minimum price calculator
import { getMinPriceSummary } from "../utils/minPrice";

import JourneyTable from "./JourneyTable";
import RoundTripResultsLite from "./RoundTripResultsLite";

// 🛫 Airport dropdown component (reads from airportsSlice)
import AirportSelect from "./AirportSelect";

// ✅ Date navigator (one-way)
import DateNavigatorOneWay from "./DateNavigatorOneWay";

// ✅ Date navigator (round-trip)
import DateNavigatorRoundTrip from "./DateNavigatorRoundTrip";

// ✅ TG-style shared depart/return calendar (round-trip only)
import DepartReturnDateBox from "./DepartReturnDateBox";

/* ---------------------------------------------
 * Helpers
 * -------------------------------------------*/
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** UI date formatter: 31-Aug-SUN (or Su) */
const formatUiDate = (date, style = "SUN") => {
  if (!date) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const MMM = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][date.getMonth()];
  const DOW3 = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()];
  const DOW2 = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][date.getDay()];
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
 * Responsive single-date picker (one-way)
 *  - Uses DateRangePicker in "single date" mode
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
  forceOneCalendar, // true | false | undefined
}) {
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const onResize = () =>
      setIsMobile(typeof window !== "undefined" ? window.innerWidth < 768 : false);
    if (typeof window !== "undefined") window.addEventListener("resize", onResize);
    return () => {
      if (typeof window !== "undefined")
        window.removeEventListener("resize", onResize);
    };
  }, []);

  const showOne =
    typeof forceOneCalendar === "boolean" ? forceOneCalendar : isMobile;

  return (
    <DateRangePicker
      oneTap
      isoWeek
      showOneCalendar={showOne}
      size={showOne ? "md" : "lg"}
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
    t?.lang === "th" || t?.locale === "th" || t?.locale === "th-TH"
      ? thTH
      : enGB;

  const weekdayStyle = "SUN";
  const isTH = t?.lang === "th" || t?.locale === "th" || t?.locale === "th-TH";
  const lang = isTH ? "th" : "en";

  // ---- Redux (search) ----
  const dispatch = useDispatch();
  const { status, error, results } = useSelector(selectSearch);

  // ---- local state ----
  const [tripType, setTripType] = useState("oneway"); // "oneway" | "roundtrip"
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const [depart, setDepart] = useState(startOfToday());
  const [ret, setRet] = useState(null);

  const [adult, setAdult] = useState(1);
  const [child, setChild] = useState(0);
  const [infant, setInfant] = useState(0);

  // Nok Air: single cabin concept (display-only)
  const cabin = "ECONOMY";

  const [showPax, setShowPax] = useState(false);
  const paxRef = useRef(null);

  const today = useMemo(startOfToday, []);

  // ✅ One-way: anchor date (first search date) for navigator
  const [anchorYMD, setAnchorYMD] = useState(null);
  const lastPayloadRef = useRef(null);

  // ✅ Round-trip: anchors + last payload for navigator
  const [rtAnchor, setRtAnchor] = useState(() => ({
    departYMD: null,
    returnYMD: null,
  }));
  const lastPayloadRTRef = useRef(null);

  // ✅ Round-trip: active tab
  const [rtActiveTab, setRtActiveTab] = useState("depart");

  // ✅ bridge control for JourneyTable (one-way only)
  const [owTab, setOwTab] = useState("list");
  const [owClearTick, setOwClearTick] = useState(0);

  // ---- helpers ----
  const clampInt = (val, min, max = Infinity) =>
    Math.max(min, Math.min(max, Number.parseInt(val ?? 0, 10) || 0));

  const switchTripType = (type) => {
    setTripType(type);
    if (type === "oneway") setRet(null);

    // reset both navigators when switching mode
    setAnchorYMD(null);
    lastPayloadRef.current = null;

    setRtAnchor({ departYMD: null, returnYMD: null });
    lastPayloadRTRef.current = null;
    setRtActiveTab("depart");

    // reset one-way bridge controls
    setOwTab("list");
    setOwClearTick(0);
  };

  // infants ≤ adults
  useEffect(() => {
    setInfant((x) => Math.min(x ?? 0, adult ?? 0));
  }, [adult]);

  const paxSummary = useMemo(() => {
    const parts = [];
    if (adult)
      parts.push(
        `${adult} ${
          adult > 1 ? t.form?.adults ?? "adults" : t.form?.adult ?? "adult"
        }`
      );
    if (child) parts.push(`${child} ${t.form?.children ?? "children"}`);
    if (infant) parts.push(`${infant} ${t.form?.infants ?? "infants"}`);
    const cabinText = t.form?.economy ?? (isTH ? "ชั้นประหยัด" : "Economy");
    return `${parts.length ? parts.join(", ") : "0"}, ${cabinText}`;
  }, [adult, child, infant, t, isTH]);

  // close pax dropdown on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!paxRef.current) return;
      if (!paxRef.current.contains(e.target)) setShowPax(false);
    };
    if (showPax) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showPax]);

  // ---- submit ----
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!origin || !destination || !depart) {
      alert(
        t?.form?.pleaseFill ??
          (isTH
            ? "กรุณาเลือกต้นทาง ปลายทาง และวันเดินทาง"
            : "Please select origin, destination, and departure date.")
      );
      return;
    }

    if (tripType === "roundtrip" && !ret) {
      alert(isTH ? "กรุณาเลือกวันกลับ" : "Please select return date.");
      return;
    }

    const payload = {
      origin: origin.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      depart: toYMDLocal(depart),
      ret: tripType === "roundtrip" ? toYMDLocal(ret) : null,
      adult: clampInt(adult, 1),
      child: clampInt(child, 0),
      infant: clampInt(Math.min(infant ?? 0, adult ?? 0), 0),
      cabin,
      promoCode: null,
    };

    if (onSubmit) onSubmit(payload);

    // ✅ Save payload for date navigation
    if (payload.ret == null) {
      lastPayloadRef.current = payload;
      setAnchorYMD(payload.depart);

      lastPayloadRTRef.current = null;
      setRtAnchor({ departYMD: null, returnYMD: null });
      setRtActiveTab("depart");

      setOwTab("list");
    } else {
      lastPayloadRTRef.current = payload;
      setRtAnchor({ departYMD: payload.depart, returnYMD: payload.ret });
      setRtActiveTab("depart");

      lastPayloadRef.current = null;
      setAnchorYMD(null);

      setOwTab("list");
      setOwClearTick(0);
    }

    dispatch(clearSelectedOfferLegs());
    dispatch(fetchSearchResults(payload));
    setShowPax(false);
  };

  // ✅ One-way: arrow navigation handler
  const handleNavigateDate = (targetDate) => {
    const last = lastPayloadRef.current;
    if (!last) return;
    if (status === "loading") return;

    const ymd = toYMDLocal(targetDate);
    setDepart(targetDate);

    const payload2 = { ...last, depart: ymd };
    lastPayloadRef.current = payload2;

    dispatch(clearSelectedOfferLegs());
    setOwTab("list");
    dispatch(fetchSearchResults(payload2));
  };

  // ✅ Round-trip: arrow navigation handler
  const handleNavigateRoundTrip = ({ departDate, returnDate }) => {
    const last = lastPayloadRTRef.current;
    if (!last) return;
    if (status === "loading") return;

    setDepart(departDate);
    setRet(returnDate);

    const payload2 = {
      ...last,
      depart: toYMDLocal(departDate),
      ret: toYMDLocal(returnDate),
    };

    lastPayloadRTRef.current = payload2;
    setRtAnchor({ departYMD: payload2.depart, returnYMD: payload2.ret });

    dispatch(clearSelectedOfferLegs());
    dispatch(fetchSearchResults(payload2));
  };

  // ✅ FORCE From/To to be full width on mobile (different line)
  const fromSpan =
    "col-span-12 " +
    (tripType === "roundtrip" ? "md:col-span-3" : "md:col-span-4");
  const toSpan =
    "col-span-12 " +
    (tripType === "roundtrip" ? "md:col-span-3" : "md:col-span-4");

  const departSpan = "col-span-12 md:col-span-3";

  const showNavigator = tripType === "oneway" && !!anchorYMD;
  const showRTNavigator =
    tripType === "roundtrip" && !!rtAnchor.departYMD && !!rtAnchor.returnYMD;

  const minSummary = useMemo(() => {
    if (!results) return null;
    return getMinPriceSummary(results, {
      tripType,
      origin: origin.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
    });
  }, [results, tripType, origin, destination]);

  const canUseSelectionActions = !!results && status !== "loading";

  const handleClearSelectionFromNav = () => {
    dispatch(clearSelectedOfferLegs());
    setOwClearTick((x) => x + 1);
    setOwTab("list");
  };

  const handleViewSelectionFromNav = () => {
    setOwTab("view");
  };

  return (
    <CustomProvider locale={calendarLocale}>
      {/* ✅ Mobile compact only (desktop unchanged) */}
      <div className="px-2 sm:px-4 md:px-8 lg:px-12 max-w-5xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="
            bg-white/90
            rounded-xl sm:rounded-2xl
            shadow-md sm:shadow-lg
            px-3 sm:px-6 md:px-8
            py-3 sm:py-5 md:py-6
            space-y-3 sm:space-y-4
          "
        >
          {/* ✅ Segmented buttons: compact only on mobile */}
          <div className="w-full">
            <div className="flex w-full rounded-[999px] bg-slate-200 p-[2px]">
              <button
                type="button"
                onClick={() => switchTripType("roundtrip")}
                className={
                  "w-1/2 h-10 sm:h-12 rounded-[999px] text-sm font-semibold transition-all " +
                  (tripType === "roundtrip"
                    ? "bg-sky-600 text-white shadow-md"
                    : "bg-transparent text-slate-700")
                }
              >
                {t.form?.roundtrip ?? (isTH ? "ไป-กลับ" : "Round-trip")}
              </button>

              <button
                type="button"
                onClick={() => switchTripType("oneway")}
                className={
                  "w-1/2 h-10 sm:h-12 rounded-[999px] text-sm font-semibold transition-all " +
                  (tripType === "oneway"
                    ? "bg-sky-600 text-white shadow-md"
                    : "bg-transparent text-slate-700")
                }
              >
                {t.form?.oneway ?? (isTH ? "เที่ยวเดียว" : "One-way")}
              </button>
            </div>
          </div>

          {/* MAIN ROWS */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
            {/* From (full line on mobile) */}
            <div className={fromSpan}>
              <AirportSelect
                value={origin}
                onChange={setOrigin}
                placeholder={t.placeholders?.from ?? (isTH ? "ต้นทาง" : "From")}
              />
            </div>

            {/* To (full line on mobile) */}
            <div className={toSpan}>
              <AirportSelect
                value={destination}
                onChange={setDestination}
                placeholder={t.placeholders?.to ?? (isTH ? "ปลายทาง" : "To")}
              />
            </div>

            {/* Dates */}
            {tripType === "roundtrip" ? (
              <div className="col-span-12 md:col-span-6">
                <DepartReturnDateBox
                  tripType={tripType}
                  depart={depart}
                  ret={ret}
                  minDate={today}
                  locale={calendarLocale}
                  placement="bottomEnd"
                  formatUiDate={(d) => formatUiDate(d, weekdayStyle)}
                  labels={{
                    departLabel: t.form?.depart ?? (isTH ? "วันไป" : "Depart"),
                    returnLabel: t.form?.return ?? (isTH ? "วันกลับ" : "Return"),
                  }}
                  onCommit={({ depart: d0, ret: d1 }) => {
                    setDepart(d0);
                    setRet(d1);
                  }}
                />
              </div>
            ) : (
              <div className={departSpan}>
                <div className="w-full">
                  <TwoMonthSingleDatePicker
                    value={depart}
                    onChange={(val) => {
                      setDepart(val);
                      if (ret && val && ret < val) setRet(val);
                    }}
                    minDate={today}
                    placeholder={t.form?.depart ?? (isTH ? "วันไป" : "Depart")}
                    renderValue={(v) => (v ? formatUiDate(v, weekdayStyle) : "")}
                    className="ibe-datepicker ibe-datepicker-tall w-full"
                    style={{ width: "100%" }}
                    locale={calendarLocale}
                    placement="bottomEnd"
                  />
                </div>
              </div>
            )}
          </div>

          {/* passenger + cabin summary */}
          <div className="relative" ref={paxRef}>
            <button
              type="button"
              onClick={() => setShowPax((s) => !s)}
              className="
                w-full md:w-auto
                h-12 sm:h-14
                rounded-xl sm:rounded-2xl
                border border-slate-200 bg-white
                px-3 sm:px-4
                text-[15px] sm:text-[16px]
                shadow-sm hover:bg-slate-50
                flex items-center gap-2
              "
            >
              <span aria-hidden>👤</span>
              <span className="font-medium text-slate-800">{paxSummary}</span>
            </button>

            {showPax && (
              <div className="absolute z-50 mt-2 w-full md:w-[640px] left-0 rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* LEFT: Cabin */}
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 flex items-center gap-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-300 text-sky-700">
                        ✓
                      </span>
                      <div>
                        <div className="font-semibold text-slate-900">
                          {t.form?.economy ?? (isTH ? "ชั้นประหยัด" : "Economy")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Passengers */}
                  <div className="space-y-4">
                    <Row
                      label={
                        t.form?.adult ??
                        t.form?.adults ??
                        (isTH ? "ผู้ใหญ่" : "Adult")
                      }
                    >
                      <Stepper
                        value={adult}
                        setValue={(v) => {
                          const nv = clampInt(v, 1);
                          setAdult(nv);
                          setInfant((x) => Math.min(x ?? 0, nv));
                        }}
                        min={1}
                        tall
                      />
                    </Row>

                    <Row
                      label={
                        t.form?.child ??
                        t.form?.children ??
                        (isTH ? "เด็ก" : "Child")
                      }
                      hint={
                        t.form?.childrenAgeHint ??
                        (isTH ? "อายุ 2–11 ปี" : "2–11 years")
                      }
                    >
                      <Stepper
                        value={child}
                        setValue={(v) => setChild(clampInt(v, 0))}
                        min={0}
                        tall
                      />
                    </Row>

                    <Row
                      label={
                        t.form?.infant ??
                        t.form?.infants ??
                        (isTH ? "ทารก" : "Infant")
                      }
                      hint={
                        t.form?.infantsAgeHint ??
                        (isTH ? "อายุต่ำกว่า 2 ปี" : "Under 2 years")
                      }
                    >
                      <Stepper
                        value={infant}
                        setValue={(v) => setInfant(clampInt(v, 0, adult))}
                        min={0}
                        max={adult}
                        tall
                      />
                    </Row>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
                  <button
                    type="button"
                    className="h-11 px-4 rounded-xl border border-slate-300 hover:bg-slate-50"
                    onClick={() => setShowPax(false)}
                  >
                    {t.form?.cancel ?? (isTH ? "ยกเลิก" : "Cancel")}
                  </button>

                  <button
                    type="button"
                    className="h-11 px-6 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 shadow"
                    onClick={() => setShowPax(false)}
                  >
                    {t.form?.confirm ?? (isTH ? "ยืนยัน" : "Confirm")}
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
              className="
                h-12 px-8 rounded-xl
                bg-sky-600 text-white font-semibold
                hover:bg-sky-700 shadow
                disabled:opacity-60
                w-full sm:w-auto
              "
            >
              {status === "loading"
                ? t.form?.searching ?? (isTH ? "กำลังค้นหา..." : "Searching...")
                : t.form?.search ?? (isTH ? "ค้นหา" : "Search")}
            </button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </form>

        {/* ✅ One-way navigator */}
        {showNavigator && (
          <div className="mt-2 sm:mt-3">
            <DateNavigatorOneWay
              anchorDate={anchorYMD}
              minDate={toYMDLocal(today)}
              isLoading={status === "loading"}
              lang={lang}
              onNavigate={handleNavigateDate}
              minTotal={minSummary?.minTotal ?? null}
              currency={minSummary?.currency ?? "THB"}
              onClearSelection={handleClearSelectionFromNav}
              onViewSelection={handleViewSelectionFromNav}
              clearDisabled={!canUseSelectionActions}
              viewDisabled={!canUseSelectionActions}
            />
          </div>
        )}

        {/* ✅ Round-trip navigator */}
        {showRTNavigator && (
          <div className="mt-2 sm:mt-3">
            <DateNavigatorRoundTrip
              anchorDepart={rtAnchor.departYMD}
              anchorReturn={rtAnchor.returnYMD}
              activeTab={rtActiveTab}
              minDate={toYMDLocal(today)}
              isLoading={status === "loading"}
              lang={lang}
              onNavigate={handleNavigateRoundTrip}
              minTotal={minSummary?.minTotal ?? null}
              minDepart={minSummary?.minDepart ?? null}
              minReturn={minSummary?.minReturn ?? null}
              currency={minSummary?.currency ?? "THB"}
            />
          </div>
        )}

        {/* Results */}
        {results &&
          (Array.isArray(results?.data) && results.data.length > 1 ? (
            <RoundTripResultsLite />
          ) : (
            <JourneyTable
              showNextButton
              externalTab={owTab}
              onExternalTabChange={setOwTab}
              externalClearSignal={owClearTick}
            />
          ))}
      </div>
    </CustomProvider>
  );
}

/* Stepper extracted (same behavior) */
function Stepper({ value, setValue, min, max = Infinity, tall = false }) {
  const clampInt = (val, minV, maxV = Infinity) =>
    Math.max(minV, Math.min(maxV, Number.parseInt(val ?? 0, 10) || 0));

  const btnBase =
    (tall ? "h-10 w-10" : "h-9 w-9") +
    " rounded-full border border-slate-300 hover:bg-slate-50 text-xl leading-none";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setValue(clampInt((value ?? 0) - 1, min, max))}
        className={btnBase + " text-slate-500"}
        aria-label="decrease"
      >
        −
      </button>
      <span className="w-8 text-center font-semibold text-slate-900">
        {value}
      </span>
      <button
        type="button"
        onClick={() => setValue(clampInt((value ?? 0) + 1, min, max))}
        className={btnBase + " text-sky-600"}
        aria-label="increase"
      >
        +
      </button>
    </div>
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