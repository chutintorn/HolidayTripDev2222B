// src/components/ContactInformation.jsx
import React, { memo, useEffect, useState, useCallback } from "react";

function ContactInformationBase({ t, value, onChange, showErrors }) {
  const [local, setLocal] = useState(
    value || { dialCode: "+66", phone: "", email: "", optIn: false }
  );

  // keep sync with parent
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

  return (
    <div className="mt-3 bg-slate-100 rounded-xl p-4 border border-slate-300">
      <h3 className="mt-0 text-base font-semibold">
        {t?.contact || "Contact Information / ข้อมูลติดต่อ"}
      </h3>

      {/* ================= EMAIL FIRST : OPTIONAL ================= */}
      <div>
        <div className="text-xs text-slate-600 mb-1 font-medium">
          {t?.emailAddress || "E-mail / อีเมล"}{" "}
          <span className="text-slate-500 font-normal">
            ({t?.optionalLabel || "Optional / ไม่บังคับ"})
          </span>
        </div>

        <input
          value={local.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="name@example.com"
          className="w-full rounded-lg border px-3 py-2 bg-white border-slate-300"
          inputMode="email"
          autoComplete="email"
        />

        <div className="text-[11px] text-slate-500 mt-1">
          {t?.emailOptionalHint || "Optional / ไม่บังคับ"}
        </div>
      </div>

      {/* ================= CODE + PHONE SAME LINE : REQUIRED ================= */}
      <div className="mt-3">
        <div className="text-xs text-slate-600 mb-1 font-medium">
          {t?.mobilePhone || "Mobile Phone / เบอร์โทรศัพท์"}{" "}
          <span className="text-red-500">*</span>{" "}
          <span className="text-red-600 font-normal">
            ({t?.requiredLabel || "Required / จำเป็น"})
          </span>
        </div>

        <div className="flex gap-2">
          <select
            value={local.dialCode}
            onChange={(e) => set("dialCode", e.target.value)}
            className="w-[110px] rounded-lg border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="+66">+66</option>
            <option value="+60">+60</option>
            <option value="+65">+65</option>
            <option value="+84">+84</option>
            <option value="+62">+62</option>
          </select>

          <input
            value={local.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder={t?.phonePlaceholder || "8x-xxxxxxx"}
            className={`flex-1 rounded-lg border px-3 py-2 bg-white ${
              phoneErr ? "border-red-400" : "border-slate-300"
            }`}
            inputMode="tel"
            autoComplete="tel"
          />
        </div>

        {phoneErr && (
          <div className="text-red-600 text-xs mt-1 font-medium">
            {t?.pleaseEnterPhoneInline ||
              "Please enter phone number / กรุณากรอกหมายเลขโทรศัพท์"}
          </div>
        )}
      </div>

      {/* ================= PRIVACY ================= */}
      <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={!!local.optIn}
          onChange={(e) => set("optIn", e.target.checked)}
        />
        {t?.acceptPrivacyPolicy ||
          "I accept Privacy Policy / ฉันยอมรับนโยบายความเป็นส่วนตัว"}
      </label>
    </div>
  );
}

const ContactInformation = memo(ContactInformationBase);
export default ContactInformation;
export { ContactInformation };