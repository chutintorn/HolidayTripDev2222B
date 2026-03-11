// src/components/TripFormBasic.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { DateRangePicker, CustomProvider } from "rsuite";
import enGB from "rsuite/locales/en_GB";
import thTH from "rsuite/locales/th_TH";
import useT from "../i18n/useT";

// 🔌 Redux
import { useDispatch, useSelector } from "react-redux";
import { fetchSearchResults, selectSearch, clearResults } from "../redux/searchSlice";

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

/** normalize airport code for comparison */
const normAirport = (v) => String(v || "").trim().toUpperCase();

/* ---------------------------------------------
 * Responsive single-date picker (one-way)
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
  forceOneCalendar,
}) {
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const onResize = () =>
      setIsMobile(typeof window !== "undefined" ? window.innerWidth < 768 : false);
    if (typeof window !== "undefined") window.addEventListener("resize", onResize);
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onResize);
      }
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
  const [owHasSelection, setOwHasSelection] = useState(false);

  // ---- helpers ----
  const clampInt = (val, min, max = Infinity) =>
    Math.max(min, Math.min(max, Number.parseInt(val ?? 0, 10) || 0));

  /** show message */
  const sameAirportMsg = () =>
    t?.form?.sameAirport ??
    (isTH
      ? "สนามบินต้นทางและปลายทางต้องไม่เหมือนกัน"
      : "Departure and arrival airports cannot be the same.");

  /** validate current origin/destination */
  const isSameAirport = (o, d) => {
    const oc = normAirport(o);
    const dc = normAirport(d);
    return !!oc && !!dc && oc === dc;
  };

  const switchTripType = (type) => {
    setTripType(type);
    if (type === "oneway") setRet(null);

    setAnchorYMD(null);
    lastPayloadRef.current = null;

    setRtAnchor({ departYMD: null, returnYMD: null });
    lastPayloadRTRef.current = null;
    setRtActiveTab("depart");

    setOwTab("list");
    setOwClearTick(0);
    setOwHasSelection(false);

    dispatch(clearSelectedOfferLegs());
  };

  // ✅ Clear Search = refresh screen
  const handleClearSearch = () => {
    setOrigin("");
    setDestination("");
    setDepart(startOfToday());
    setRet(null);

    setAdult(1);
    setChild(0);
    setInfant(0);

    setShowPax(false);

    setAnchorYMD(null);
    lastPayloadRef.current = null;

    setRtAnchor({ departYMD: null, returnYMD: null });
    lastPayloadRTRef.current = null;
    setRtActiveTab("depart");

    setOwTab("list");
    setOwClearTick((x) => x + 1);
    setOwHasSelection(false);

    dispatch(clearSelectedOfferLegs());
    dispatch(clearResults());
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

    if (isSameAirport(origin, destination)) {
      alert(sameAirportMsg());
      return;
    }

    if (tripType === "roundtrip" && !ret) {
      alert(isTH ? "กรุณาเลือกวันกลับ" : "Please select return date.");
      return;
    }

    const payload = {
      origin: normAirport(origin),
      destination: normAirport(destination),
      depart: toYMDLocal(depart),
      ret: tripType === "roundtrip" ? toYMDLocal(ret) : null,
      adult: clampInt(adult, 1),
      child: clampInt(child, 0),
      infant: clampInt(Math.min(infant ?? 0, adult ?? 0), 0),
      cabin,
      promoCode: null,
    };

    if (onSubmit) onSubmit(payload);

    if (payload.ret == null) {
      lastPayloadRef.current = payload;
      setAnchorYMD(payload.depart);

      lastPayloadRTRef.current = null;
      setRtAnchor({ departYMD: null, returnYMD: null });
      setRtActiveTab("depart");

      setOwTab("list");
      setOwHasSelection(false);
    } else {
      lastPayloadRTRef.current = payload;
      setRtAnchor({ departYMD: payload.depart, returnYMD: payload.ret });
      setRtActiveTab("depart");

      lastPayloadRef.current = null;
      setAnchorYMD(null);

      setOwTab("list");
      setOwClearTick(0);
      setOwHasSelection(false);
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
    setOwHasSelection(false);
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
    "col-span-12 " + (tripType === "roundtrip" ? "md:col-span-3" : "md:col-span-4");
  const toSpan =
    "col-span-12 " + (tripType === "roundtrip" ? "md:col-span-3" : "md:col-span-4");
  const departSpan = "col-span-12 md:col-span-3";

  const showNavigator = tripType === "oneway" && !!anchorYMD;
  const showRTNavigator =
    tripType === "roundtrip" && !!rtAnchor.departYMD && !!rtAnchor.returnYMD;

  const minSummary = useMemo(() => {
    if (!results) return null;
    return getMinPriceSummary(results, {
      tripType,
      origin: normAirport(origin),
      destination: normAirport(destination),
    });
  }, [results, tripType, origin, destination]);

  const canUseSelectionActions = !!results && status !== "loading";

  const handleOriginChange = (next) => {
    const nextO = normAirport(next);
    const curD = normAirport(destination);
    if (nextO && curD && nextO === curD) {
      alert(sameAirportMsg());
      return;
    }
    setOrigin(next);
  };

  const handleDestinationChange = (next) => {
    const curO = normAirport(origin);
    const nextD = normAirport(next);
    if (curO && nextD && curO === nextD) {
      alert(sameAirportMsg());
      return;
    }
    setDestination(next);
  };

  return (
    <CustomProvider locale={calendarLocale}>
      <div className="px-[2px] sm:px-4 md:px-8 lg:px-10 xl:px-12 max-w-7xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="
            bg-white/90 rounded-2xl shadow-lg
            px-4 py-2 sm:px-3 md:px-8 md:py-4
            space-y-3
            text-[13px] sm:text-sm
          "
        >
          <div className="w-full flex justify-start">
            <div className="w-full md:w-1/2 lg:w-[58.333333%] rounded-[999px] bg-slate-200 p-[4px] overflow-hidden">
              <div className="flex w-full h-9 md:h-[44px]">
                <button
                  type="button"
                  onClick={() => switchTripType("roundtrip")}
                  className={
                    "w-1/2 h-10 md:h-[44px] rounded-l-[999px] text-[13px] sm:text-sm font-medium transition-all " +
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
                    "w-1/2 h-10 md:h-[44px] rounded-r-[999px] text-[13px] sm:text-sm font-medium transition-all " +
                    (tripType === "oneway"
                      ? "bg-sky-600 text-white shadow-md"
                      : "bg-transparent text-slate-700")
                  }
                >
                  {t.form?.oneway ?? (isTH ? "เที่ยวเดียว" : "One-way")}
                </button>
              </div>
            </div>
          </div>

          <div className="h-0 md:h-1" />

          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-1 md:gap-y-2 gap-x-2 md:gap-x-4 lg:gap-x-6 xl:gap-x-8 items-center">
            <div className={fromSpan}>
              <AirportSelect
                value={origin}
                onChange={handleOriginChange}
                placeholder={t.placeholders?.from ?? (isTH ? "ต้นทาง" : "From")}
              />
            </div>

            <div className={toSpan}>
              <AirportSelect
                value={destination}
                onChange={handleDestinationChange}
                placeholder={t.placeholders?.to ?? (isTH ? "ปลายทาง" : "To")}
              />
            </div>

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

          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-1 md:gap-y-2 gap-x-3 md:gap-x-4 !items-end">
            <div className="md:col-span-6 lg:col-span-5 relative" ref={paxRef}>
              <button
                type="button"
                onClick={() => setShowPax((s) => !s)}
                className="
                  w-full
                  h-12
                  rounded-xl
                  border border-slate-200 bg-white
                  px-4
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
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 flex items-center gap-3">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sky-300 text-sky-700 text-xs">
                          ✓
                        </span>
                        <div className="font-medium text-slate-900 text-sm">
                          {t.form?.economy ?? (isTH ? "ชั้นประหยัด" : "Economy")}
                        </div>
                      </div>
                    </div>

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
                      className="h-10 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 font-medium"
                      onClick={() => setShowPax(false)}
                    >
                      {t.form?.cancel ?? (isTH ? "ยกเลิก" : "Cancel")}
                    </button>

                    <button
                      type="button"
                      className="h-10 px-6 rounded-xl bg-sky-600 text-white font-medium hover:bg-sky-700 shadow"
                      onClick={() => setShowPax(false)}
                    >
                      {t.form?.confirm ?? (isTH ? "ยืนยัน" : "Confirm")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-6 lg:col-span-7 mt-2 md:mt-5 lg:mt-4">
              <div className="w-full rounded-[999px] bg-slate-200 p-[4px] overflow-hidden">
                <div className="flex w-full h-10">
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="
                      w-1/2
                      h-10 md:h-[44px]
                      rounded-l-[999px]
                      bg-transparent
                      text-slate-700
                      font-medium
                      hover:bg-white/60
                      transition
                    "
                  >
                    {isTH ? "ล้าง" : "Clear"}
                  </button>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="
                      w-1/2
                      h-10 md:h-[44px]
                      rounded-r-[999px]
                      bg-sky-600
                      text-white
                      font-semibold
                      hover:bg-sky-700
                      transition
                      disabled:opacity-60
                    "
                  >
                    {status === "loading"
                      ? t.form?.searching ?? (isTH ? "กำลังค้นหา..." : "Searching...")
                      : t.form?.search ?? (isTH ? "ค้นหา" : "Search Flights")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </form>

        {showNavigator && (
          <div className="mt-1 md:mt-2">
            <DateNavigatorOneWay
              anchorDate={anchorYMD}
              minDate={toYMDLocal(today)}
              isLoading={status === "loading"}
              lang={lang}
              onNavigate={handleNavigateDate}
              minTotal={minSummary?.minTotal ?? null}
              currency={minSummary?.currency ?? "THB"}
              onClearSelection={() => {
                dispatch(clearSelectedOfferLegs());
                setOwClearTick((x) => x + 1);
                setOwTab("list");
                setOwHasSelection(false);
              }}
              onViewSelection={() => setOwTab("view")}
              clearDisabled={!canUseSelectionActions}
              viewDisabled={!canUseSelectionActions}
              hasSelection={owHasSelection}
              isViewActive={owTab === "view"}
            />
          </div>
        )}

        {showRTNavigator && (
          <div className="mt-1 md:mt-2">
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

        {results &&
          (Array.isArray(results?.data) && results.data.length > 1 ? (
            <RoundTripResultsLite />
          ) : (
            <JourneyTable
              showNextButton
              externalTab={owTab}
              onExternalTabChange={setOwTab}
              externalClearSignal={owClearTick}
              onSelectionChange={(flag) => setOwHasSelection(!!flag)}
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
      <span className="w-8 text-center font-medium text-slate-900">{value}</span>
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
        <div className="font-medium text-slate-800">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}