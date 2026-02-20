// src/redux/store.js
import { configureStore } from "@reduxjs/toolkit";
import language from "./languageSlice";
import search from "./searchSlice";
import pricing from "./pricingSlice";
import airports from "./airportsSlice"; // keep if you have it
import filters from "./filtersSlice"; // keep if you have it
import seatMap from "./seatMapSlice"; // seat map reducer

// ✅ selected offer (fareKey/journeyKey) for 1-way / round-trip
import offerSelection from "./offerSelectionSlice";

// ✅ NEW (Phase 1): seat selection (draft/saved per pax + journeyKey)
import seatSelection from "./seatSelectionSlice";

// Load initial language from localStorage (fallback 'en')
function loadPreloadedState() {
  try {
    const raw = localStorage.getItem("app.lang");
    const value = raw ? JSON.parse(raw) : "en";
    return { language: { value } };
  } catch {
    return { language: { value: "en" } };
  }
}

export const store = configureStore({
  reducer: {
    language, // existing language state
    search, // flight search state/results
    pricing, // price detail per offer
    airports, // optional
    filters, // optional
    seatMap, // seat map state

    // ✅ existing
    offerSelection,

    // ✅ NEW (Phase 1)
    seatSelection,
  },
  preloadedState: loadPreloadedState(),
  // default middleware & devTools are fine
});

// Persist language changes only
store.subscribe(() => {
  try {
    const lang = store.getState().language?.value ?? "en";
    localStorage.setItem("app.lang", JSON.stringify(lang));
  } catch {
    // ignore persistence errors
  }
});
