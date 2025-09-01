import { useDispatch, useSelector } from "react-redux";
import { setLanguage } from "../redux/languageSlice";

export default function LanguageToggle({ compact = false }) {
  const dispatch = useDispatch();
  const lang = useSelector((s) => s.language.value);

  const btn = (code, left = false) => (
    <button
      type="button"
      onClick={() => dispatch(setLanguage(code))}
      aria-pressed={lang === code}
      className={[
        "px-3 py-1.5 text-sm",
        left ? "" : "border-l",
        lang === code ? "bg-blue-600 text-white" : "bg-white",
      ].join(" ")}
    >
      {code.toUpperCase()}
    </button>
  );

  return (
    <div
      className={[
        "inline-flex rounded-lg border overflow-hidden",
        compact ? "scale-90 origin-right" : "",
      ].join(" ")}
      role="group"
      aria-label="Language"
    >
      {btn("en", true)}
      {btn("th")}
    </div>
  );
}
