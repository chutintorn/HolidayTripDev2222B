// src/pages/PriceHeader.jsx
import React, { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import * as searchSlice from "../redux/searchSlice";
import * as pricingSlice from "../redux/pricingSlice";
import * as seatMapSlice from "../redux/seatMapSlice";
import * as seatSelectionSlice from "../redux/seatSelectionSlice";
import * as offerSelectionSlice from "../redux/offerSelectionSlice";

// ✅ Logo (make sure file exists)
import NokAirLogo from "../assets/NokAirLogo.png";

function safeDispatch(dispatch, actionCreator) {
  if (typeof actionCreator === "function") dispatch(actionCreator());
}

export default function PriceHeader({
  headerRef,
  containerPad,
  lang,
  setLang,
  t,
  scrollToPassengerTop,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const backToStart = useCallback(() => {
    safeDispatch(dispatch, searchSlice?.clearResults || searchSlice?.resetSearch || null);
    safeDispatch(dispatch, pricingSlice?.resetPricing || pricingSlice?.clearPricing || null);
    safeDispatch(dispatch, seatMapSlice?.resetSeatMap || seatMapSlice?.clearSeatMap || null);
    safeDispatch(dispatch, seatSelectionSlice?.resetAllSeats || seatSelectionSlice?.clearAllSeats || null);
    safeDispatch(
      dispatch,
      offerSelectionSlice?.clearSelectedOfferLegs || offerSelectionSlice?.clearSelectedOffers || null
    );

    navigate("/", { replace: true });
  }, [dispatch, navigate]);

  return (
    <div
      ref={headerRef}
      className="sticky top-0 z-20 w-full border-b bg-[#e3f8ff]"
      style={{ minHeight: 64 }}
    >
      <div className={`mx-auto max-w-6xl ${containerPad} py-3`}>
        {/* ✅ Row 1 (MOBILE): Brand + Language buttons in ONE line */}
        <div className="flex items-center justify-between gap-2">
          {/* Brand */}
          <Link
            to="/"
            className="group flex items-center gap-2 min-w-0"
            aria-label="Go to homepage"
          >
            <img
              src={NokAirLogo}
              alt="Nok Air"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-slate-200 bg-white object-contain flex-none"
              draggable="false"
            />

            <div className="min-w-0 leading-tight">
              <div className="font-extrabold text-[16px] sm:text-[20px] text-blue-600 tracking-tight truncate">
                Demo
              </div>
            </div>
          </Link>

          {/* Language Buttons (small on mobile, still one line) */}
          <div className="flex items-center gap-2 flex-none">
            <button
              type="button"
              onClick={() => {
                setLang("th");
                requestAnimationFrame(scrollToPassengerTop);
              }}
              className={[
                "h-9 sm:h-11",
                "px-3 sm:px-5",
                "rounded-2xl border",
                "text-[13px] sm:text-[15px] font-semibold transition",
                "whitespace-nowrap",
                lang === "th"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-blue-600 border-blue-600",
              ].join(" ")}
            >
              ไทย
            </button>

            <button
              type="button"
              onClick={() => {
                setLang("en");
                requestAnimationFrame(scrollToPassengerTop);
              }}
              className={[
                "h-9 sm:h-11",
                "px-3 sm:px-5",
                "rounded-2xl border",
                "text-[13px] sm:text-[15px] font-semibold transition",
                "whitespace-nowrap",
                lang === "en"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-blue-600 border-blue-600",
              ].join(" ")}
            >
              English
            </button>
          </div>
        </div>

        {/* ✅ Row 2: Back button (full width like your screenshot) */}
        <div className="mt-2">
          <button
            type="button"
            onClick={backToStart}
            className={[
              "h-10 sm:h-11",
              "w-full sm:w-[360px]",
              "rounded-2xl border px-6",
              "text-[14px] sm:text-[15px] font-medium",
              "border-white/70 text-[#0b4f73]",
              "bg-gradient-to-b from-white/60 via-[#d9f6ff] to-[#ecfbff]",
              "shadow-[0_6px_14px_rgba(26,167,214,0.10)]",
              "hover:brightness-[1.04] active:translate-y-[1px] active:text-white",
              "active:bg-gradient-to-b active:from-[#8fe8ff] active:to-[#bfefff]",
            ].join(" ")}
          >
            ← {t?.backToStart || "Back to start"}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className={`mx-auto max-w-6xl ${containerPad} pb-3`}>
        <h1 className="text-xl font-bold text-blue-600">{t?.title}</h1>
      </div>
    </div>
  );
}