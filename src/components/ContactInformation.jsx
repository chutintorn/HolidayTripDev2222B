// src/components/ContactInformation.jsx
import React, { memo, useEffect, useState, useCallback } from "react";

/**
 * ContactInformation
 * Props:
 *  - t: i18n dict with keys { contact, mobilePhone, emailAddress, required }
 *  - value: { dialCode, phone, email, optIn }
 *  - onChange: (next) => void
 *  - showErrors: boolean (when true, shows required errors)
 */
function ContactInformationBase({ t, value, onChange, showErrors }) {
  const [local, setLocal] = useState(
    value || { dialCode: "+66", phone: "", email: "", optIn: false }
  );

  // keep in sync with parent updates
  useEffect(() => {
    setLocal(value || { dialCode: "+66", phone: "", email: "", optIn: false });
  }, [value]);

  const set = useCallback(
    (k, v) => {
      const next = { ...local, [k]: v };
      setLocal(next);
      onChange?.(next);
    },
    [local, onChange]
  );

  const phoneErr = !!(showErrors && !String(local.phone || "").trim());
  const emailErr = !!(showErrors && !String(local.email || "").trim());

  const label = useCallback(
    (text) => (
      <span>
        {text} <span className="text-red-500">*</span>
      </span>
    ),
    []
  );

  return (
    <div className="mt-3 bg-slate-100 rounded-xl p-4 border border-slate-300">
      <h3 className="mt-0 text-base font-semibold">{t?.contact || "Contact"}</h3>

      <div className="grid grid-cols-[140px_1fr] max-[480px]:grid-cols-1 gap-2">
        {/* Dial code */}
        <div>
          <div className="text-xs text-slate-600 mb-1">{label("+ Code")}</div>
          <select
            value={local.dialCode}
            onChange={(e) => set("dialCode", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="+66">+66</option>
            <option value="+60">+60</option>
            <option value="+65">+65</option>
            <option value="+84">+84</option>
            <option value="+62">+62</option>
          </select>
        </div>

        {/* Email */}
        <div>
          <div className="text-xs text-slate-600 mb-1">
            {label(t?.emailAddress || "E-mail")}
          </div>
          <input
            value={local.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="name@example.com"
            className={`w-full rounded-lg border px-3 py-2 bg-white ${
              emailErr ? "border-red-400" : "border-slate-300"
            }`}
            inputMode="email"
            autoComplete="email"
          />
          {emailErr && (
            <div className="text-red-600 text-xs mt-1">
              {t?.required || "Required"}
            </div>
          )}
        </div>
      </div>

      {/* Phone */}
      <div className="mt-2">
        <div className="text-xs text-slate-600 mb-1">
          {label(t?.mobilePhone || "Mobile Phone")}
        </div>
        <input
          value={local.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="8x-xxxxxxx"
          className={`w-full rounded-lg border px-3 py-2 bg-white ${
            phoneErr ? "border-red-400" : "border-slate-300"
          }`}
          inputMode="tel"
          autoComplete="tel"
        />
        {phoneErr && (
          <div className="text-red-600 text-xs mt-1">
            {t?.required || "Required"}
          </div>
        )}
      </div>

      {/* Marketing opt-in */}
      <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={!!local.optIn}
          onChange={(e) => set("optIn", e.target.checked)}
        />
        {t?.marketingOptIn ||
          "I would like to receive news and special offers and accept the privacy policy."}
      </label>
    </div>
  );
}

const ContactInformation = memo(ContactInformationBase);
export default ContactInformation;
export { ContactInformation };
