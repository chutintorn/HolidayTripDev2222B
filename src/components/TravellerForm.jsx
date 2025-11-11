// src/components/TravellerForm.jsx
import React, { memo, useCallback, useEffect, useState } from "react";

/**
 * TravellerForm
 * - Controlled-ish form with internal state mirroring `value`
 * - Validates firstName, lastName, dob (required)
 *
 * Props:
 *  - t: i18n dict (expects keys used below)
 *  - value: initial traveller object { gender, firstName, lastName, country, dob, memberId, email }
 *  - onChange(next) => void
 *  - onSave(next) => void  (only used when showSave = true)
 *  - showSave: boolean (default false)
 *  - points: number (display purpose only)
 */
function TravellerFormBase({
  t,
  value,
  onChange,
  onSave,
  showSave = true,
  points = 95,
}) {
  const [local, setLocal] = useState(value || {});
  const [errors, setErrors] = useState({});

  // keep in sync when parent `value` changes
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

  const validate = useCallback(() => {
    const e = {};
    ["firstName", "lastName", "dob"].forEach((k) => {
      if (!requiredOk(k)) e[k] = t?.required || "Required";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [requiredOk, t?.required]);

  const save = useCallback(() => {
    if (!validate()) return;
    onSave?.(local);
  }, [local, onSave, validate]);

  return (
    <div className="p-4">
      {/* Gender */}
      <div className="mb-3">
        <div className="text-sm text-slate-600 mb-1">{t?.passengerDetails || "Passenger details"}</div>
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
            <div className="text-red-600 text-xs mt-1">{t?.required || "Required"}</div>
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
            <div className="text-red-600 text-xs mt-1">{t?.required || "Required"}</div>
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
        <div>
          <input
            placeholder={t?.dob || "Date of birth (DD/MM/YYYY)"}
            value={local.dob || ""}
            onChange={(e) => set("dob", e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              errors.dob ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.dob && (
            <div className="text-red-600 text-xs mt-1">{t?.required || "Required"}</div>
          )}
        </div>
      </div>

      {/* Member & email (optional) */}
      <div className="mt-3">
        <input
          placeholder={t?.memberId || "Member ID"}
          value={local.memberId || ""}
          onChange={(e) => set("memberId", e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3"
        />

        <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
          <div className="text-slate-900 mb-2">• {t?.earnPoints || "Earn points for this guest"}</div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <input
              placeholder={t?.email || "Email address (optional)"}
              value={local.email || ""}
              onChange={(e) => set("email", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-cyan-500 text-cyan-700 font-semibold bg-white"
              onClick={() => alert("🔎 Lookup member by email (stub)")}
            >
              {t?.search || "Search"}
            </button>
          </div>
        </div>

        <div className="mt-3 text-slate-900">
          {(t?.pointsAfter || "Points after flight:")}{" "}
          <span className="font-bold">{points} {(t?.points || "points")}</span>
        </div>
      </div>

      {showSave && (
        <div className="flex justify-end gap-2 mt-4">
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
