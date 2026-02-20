// src/redux/store.js
import { configureStore } from "@reduxjs/toolkit";

import language from "./languageSlice";
import search from "./searchSlice";
import pricing from "./pricingSlice";
import airports from "./airportsSlice"; // keep if you have it
import filters from "./filtersSlice";   // keep if you have it
import seatMap from "./seatMapSlice";

// ✅ selections (you already use these in UI/components)
import seatSelection from "./seatSelectionSlice";
import baggageSelection from "./baggageSelectionSlice";

// ✅ NEW (Phase: meal)
import mealSelection from "./mealSelectionSlice";

// ✅ OPTIONAL: keep only if you have this file in your project
// If you don't have it, remove both this import + reducer entry below.
import offerSelection from "./offerSelectionSlice";

/* ------------------------ Load initial language ------------------------ */
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
    language,
    search,
    pricing,
    airports,
    filters,
    seatMap,

    // ✅ Required if components use these selectors/actions
    seatSelection,
    baggageSelection,

    // ✅ New meal
    mealSelection,

    // ✅ Optional
    offerSelection,
  },
  preloadedState: loadPreloadedState(),
});

/* ------------------------ Persist language changes only ------------------------ */
store.subscribe(() => {
  try {
    const lang = store.getState().language?.value ?? "en";
    localStorage.setItem("app.lang", JSON.stringify(lang));
  } catch {
    // ignore persistence errors
  }
});
