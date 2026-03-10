// src/components/TravellerForm.jsx
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseDob(dobStr) {
  // expects "DD/MM/YYYY"
  if (!dobStr || typeof dobStr !== "string") return { dd: "", mm: "", yyyy: "" };
  const parts = dobStr.split("/");
  if (parts.length !== 3) return { dd: "", mm: "", yyyy: "" };
  const [dd, mm, yyyy] = parts;
  return { dd: dd || "", mm: mm || "", yyyy: yyyy || "" };
}

function maxDaysInMonth(mm, yyyy) {
  const m = Number(mm);
  const y = Number(yyyy);
  if (!m) return 31;

  // If year not selected yet, assume non-leap for Feb (28)
  if (!y) return m === 2 ? 28 : new Date(2021, m, 0).getDate();

  // JS trick: day 0 of next month = last day of this month
  return new Date(y, m, 0).getDate();
}

function isValidDateParts(dd, mm, yyyy) {
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (!d || !m || !y) return false;
  if (m < 1 || m > 12) return false;

  const maxD = maxDaysInMonth(mm, yyyy);
  if (d < 1 || d > maxD) return false;

  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function weekdayInfo(dateObj, lang) {
  // 0 Sun ... 6 Sat
  const day = dateObj.getDay();
  const namesEN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const namesTH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

  const label = lang === "th" ? namesTH[day] : namesEN[day];

  // Soft colors you requested
  const clsByDay = {
    1: "bg-yellow-100 text-yellow-900", // Mon
    2: "bg-pink-100 text-pink-900", // Tue
    3: "bg-green-100 text-green-900", // Wed
    4: "bg-orange-100 text-orange-900", // Thu
    5: "bg-blue-100 text-blue-900", // Fri
    6: "bg-purple-100 text-purple-900", // Sat
    0: "bg-red-100 text-red-900", // Sun
  };

  return { label, className: clsByDay[day] || "bg-slate-100 text-slate-900" };
}

/**
 * TravellerForm
 * - Validates firstName, lastName, dob (required + real date)
 * - DOB uses 3 dropdowns: DD / MMM / YYYY
 *
 * FIX:
 * - DD shows 01..31 ALWAYS (no filtering by month)
 * - DD selection works even before month/year
 * - Don't reset dd/mm/yyyy from local.dob when local.dob is "" (partial selection)
 * - Validate later (when all 3 selected)
 */
function TravellerFormBase({ t, value, onChange, onSave, showSave = true }) {
  const [local, setLocal] = useState(value || {});
  const [errors, setErrors] = useState({});

  // Keep in sync when parent `value` changes
  useEffect(() => {
    setLocal(value || {});
  }, [value]);

  const set = useCallback(
    (k, v) => {
      const next = { ...local, [k]: v };
      setLocal(next);
      onChange?.(next);
    },
    [local, onChange]
  );

  const requiredOk = useCallback(
    (k) => ((local?.[k] || "").toString().trim()).length > 0,
    [local]
  );

  // Detect language from t (your page passes STR[lang] as t)
  const lang = useMemo(
    () => (t?.title === "รายละเอียดผู้โดยสาร" ? "th" : "en"),
    [t?.title]
  );

  // DOB dropdown state derived from local.dob (DD/MM/YYYY)
  const dobParts = useMemo(() => parseDob(local.dob), [local.dob]);
  const [dd, setDd] = useState(dobParts.dd);
  const [mm, setMm] = useState(dobParts.mm);
  const [yyyy, setYyyy] = useState(dobParts.yyyy);

  /**
   * ✅ FIX #1: Don't reset dropdowns when local.dob becomes "" due to partial selection.
   * Only sync from local.dob if it actually has something parseable.
   */
  useEffect(() => {
    const p = parseDob(local.dob);

    // if local.dob is empty, parseDob returns empty => DON'T override user's dropdown selection
    if (!p.dd && !p.mm && !p.yyyy) return;

    setDd(p.dd);
    setMm(p.mm);
    setYyyy(p.yyyy);
  }, [local.dob]);

  // Month labels
  const months = useMemo(() => {
    const en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const th = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const labels = lang === "th" ? th : en;
    return labels.map((label, idx) => ({ value: pad2(idx + 1), label }));
  }, [lang]);

  // Days list: 01..31 (ALWAYS)
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => pad2(i + 1)), []);

  // Years (AD stored; Thai shows BE)
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const start = now - 100;
    const end = now;
    const list = [];
    for (let y = end; y >= start; y--) {
      if (lang === "th") list.push({ value: String(y), label: String(y + 543) });
      else list.push({ value: String(y), label: String(y) });
    }
    return list;
  }, [lang]);

  /**
   * When dropdown changes, update local.dob as "DD/MM/YYYY"
   * - If not all selected yet => dobStr = "" (keep same behavior)
   * - But we prevent the effect above from wiping dropdowns when dobStr is ""
   */
  const commitDob = useCallback(
    (nextDd, nextMm, nextYyyy) => {
      const all = nextDd && nextMm && nextYyyy;
      const dobStr = all ? `${nextDd}/${nextMm}/${nextYyyy}` : "";
      set("dob", dobStr);
    },
    [set]
  );

  // Validate DOB immediately when all 3 selected
  useEffect(() => {
    // Only validate when all selected
    if (!dd || !mm || !yyyy) {
      // remove invalid date error while selecting
      setErrors((prev) => {
        const next = { ...prev };
        if (next.dob && next.dob !== (t?.required || "Required")) delete next.dob;
        return next;
      });
      return;
    }

    const maxD = maxDaysInMonth(mm, yyyy);
    if (Number(dd) > maxD) {
      setErrors((prev) => ({
        ...prev,
        dob: t?.invalidDate || (lang === "th" ? "วันที่ไม่ถูกต้อง" : "Invalid date"),
      }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        if (next.dob && next.dob !== (t?.required || "Required")) delete next.dob;
        return next;
      });
    }
  }, [dd, mm, yyyy, t, lang]);

  // Weekday pill (only if valid date)
  const weekdayPill = useMemo(() => {
    if (!isValidDateParts(dd, mm, yyyy)) return null;
    const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return weekdayInfo(dt, lang);
  }, [dd, mm, yyyy, lang]);

  const validate = useCallback(() => {
    const e = {};
    ["firstName", "lastName", "dob"].forEach((k) => {
      if (!requiredOk(k)) e[k] = t?.required || "Required";
    });

    // keep invalid date error if it exists
    if (errors.dob && errors.dob !== (t?.required || "Required")) {
      e.dob = errors.dob;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [requiredOk, t?.required, errors.dob]);

  const save = useCallback(() => {
    if (!validate()) return;
    onSave?.(local);
  }, [local, onSave, validate]);

  /**
   * ✅ FIX #2: DD dropdown must show 01..31 ALWAYS (no filter by month/year)
   * So we DO NOT use maxDaysInMonth to filter dropdown options.
   */
  const daysForDropdown = days;

  return (
    <div className="p-4">
      {/* Gender */}
      <div className="mb-3">
        <div className="text-sm text-slate-600 mb-1">
          {t?.passengerDetails || "Passenger details"}
        </div>
        <div className="inline-flex border border-slate-300 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => set("gender", "M")}
            className={`px-3 py-2 text-sm ${
              local.gender === "M" ? "bg-sky-50 text-sky-700" : "bg-white text-slate-800"
            }`}
          >
            {t?.male || "Male"}
          </button>
          <button
            type="button"
            onClick={() => set("gender", "F")}
            className={`px-3 py-2 text-sm border-l border-slate-300 ${
              local.gender === "F" ? "bg-sky-50 text-sky-700" : "bg-white text-slate-800"
            }`}
          >
            {t?.female || "Female"}
          </button>
        </div>
      </div>

      {/* Names */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <input
            placeholder={t?.firstName || "First/Given name"}
            value={local.firstName || ""}
            onChange={(e) => set("firstName", e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              errors.firstName ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.firstName && (
            <div className="text-red-600 text-xs mt-1">{errors.firstName}</div>
          )}
        </div>

        <div>
          <input
            placeholder={t?.lastName || "Family name/Surname"}
            value={local.lastName || ""}
            onChange={(e) => set("lastName", e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              errors.lastName ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.lastName && (
            <div className="text-red-600 text-xs mt-1">{errors.lastName}</div>
          )}
        </div>
      </div>

      {/* Country + DOB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div>
          <select
            value={local.country || "Thailand"}
            onChange={(e) => set("country", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option>Thailand</option>
            <option>Singapore</option>
            <option>Malaysia</option>
            <option>Vietnam</option>
            <option>Indonesia</option>
          </select>
        </div>

        {/* DOB as 3 dropdowns + weekday pill */}
        <div>
          <div className="flex items-center gap-2">
            {/* DD */}
            <select
              value={dd}
              onChange={(e) => {
                const v = e.target.value;
                setDd(v);
                commitDob(v, mm, yyyy);
              }}
              className={`rounded-lg border px-3 py-2 text-sm bg-white ${
                errors.dob ? "border-red-400" : "border-slate-300"
              }`}
            >
              <option value="">{lang === "th" ? "วัน" : "DD"}</option>
              {daysForDropdown.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* MMM */}
            <select
              value={mm}
              onChange={(e) => {
                const v = e.target.value;
                setMm(v);

                // ✅ Don't clear dd. Just validate later.
                commitDob(dd, v, yyyy);
              }}
              className={`rounded-lg border px-3 py-2 text-sm bg-white ${
                errors.dob ? "border-red-400" : "border-slate-300"
              }`}
            >
              <option value="">{lang === "th" ? "เดือน" : "MMM"}</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* YYYY */}
            <select
              value={yyyy}
              onChange={(e) => {
                const v = e.target.value;
                setYyyy(v);

                // ✅ Don't clear dd. Just validate later.
                commitDob(dd, mm, v);
              }}
              className={`rounded-lg border px-3 py-2 text-sm bg-white flex-1 ${
                errors.dob ? "border-red-400" : "border-slate-300"
              }`}
            >
              <option value="">{lang === "th" ? "ปี (พ.ศ.)" : "YYYY"}</option>
              {years.map((y) => (
                <option key={y.value} value={y.value}>
                  {lang === "th" ? `${y.label} พ.ศ.` : y.label}
                </option>
              ))}
            </select>

            {/* Weekday pill */}
            {weekdayPill && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${weekdayPill.className}`}
              >
                {weekdayPill.label}
              </span>
            )}
          </div>

          {errors.dob && (
            <div className="text-red-600 text-xs mt-1">{errors.dob}</div>
          )}
        </div>
      </div>

      {showSave && (
        <div className="flex justify-end mt-4">
          <button
            onClick={save}
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold"
          >
            {t?.save || "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

const TravellerForm = memo(TravellerFormBase);
export default TravellerForm;
export { TravellerForm };
