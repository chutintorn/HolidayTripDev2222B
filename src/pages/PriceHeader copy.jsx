// src/pages/PriceHeader.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function PriceHeader({ headerRef, containerPad, lang, setLang, t, scrollToPassengerTop }) {
  return (
    <div ref={headerRef} className="sticky top-0 z-20 w-full border-b bg-[#e3f8ff]" style={{ minHeight: 64 }}>
      <div className={`mx-auto max-w-6xl ${containerPad} py-3`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="group flex items-center gap-3" aria-label="Go to homepage">
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHBKoufNO6L_f1AvGmnvXR7b5TfMiDQGjH6w&s"
                alt="Nok Holiday logo"
                className="h-8 w-8 rounded"
                width={32}
                height={32}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="font-bold text-[170%] text-blue-600 tracking-tight transition-colors duration-300 group-hover:text-[#ffe657]">
                Nok Holiday
              </span>
            </Link>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setLang("th");
                requestAnimationFrame(scrollToPassengerTop);
              }}
              className={`flex-1 sm:flex-none px-3 py-1 border rounded ${
                lang === "th" ? "bg-blue-600 text-white" : "border-blue-600 text-blue-600"
              }`}
            >
              ไทย
            </button>
            <button
              onClick={() => {
                setLang("en");
                requestAnimationFrame(scrollToPassengerTop);
              }}
              className={`flex-1 sm:flex-none px-3 py-1 border rounded ${
                lang === "en" ? "bg-blue-600 text-white" : "border-blue-600 text-blue-600"
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      <div className={`mx-auto max-w-6xl ${containerPad} pb-3`}>
        <h1 className="text-xl font-bold text-blue-600">{t.title}</h1>
      </div>
    </div>
  );
}
