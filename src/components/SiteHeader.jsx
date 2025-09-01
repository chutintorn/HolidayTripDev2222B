import { useDispatch, useSelector } from "react-redux";
import { setLanguage } from "../redux/languageSlice";

export default function SiteHeader() {
  const dispatch = useDispatch();
  const lang = useSelector((s) => s.language?.value || "en");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-skyBlue-50 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        {/* Left: logo + title (unchanged) */}
        <div className="flex items-center gap-3">
          <img src="/src/assets/nOKaiR.png" alt="Logo" className="h-8 w-8" />
          <span className="font-bold text-[150%]   text-blue-600 tracking-tight">Nok Holiday</span>
        </div>

        {/* Right: tagline + language toggle */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-xs text-gray-500">
            Simple • Fast • Reliable
          </span>

          <div className="inline-flex rounded-lg border overflow-hidden" role="group" aria-label="Language">
            <button
              type="button"
              onClick={() => dispatch(setLanguage("en"))}
              aria-pressed={lang === "en"}
              className={`px-3 py-1.5 text-sm ${lang === "en" ? "bg-blue-600 text-white" : "bg-skyBlue-20"}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => dispatch(setLanguage("th"))}
              aria-pressed={lang === "th"}
              className={`px-3 py-1.5 text-sm border-l ${lang === "th" ? "bg-blue-600 text-white" : "bg-skyBlue-20"}`}
            >
              TH
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
