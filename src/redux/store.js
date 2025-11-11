// src/redux/store.js
import { configureStore } from '@reduxjs/toolkit';
import language from './languageSlice';
import search from './searchSlice';
import pricing from './pricingSlice';
import airports from './airportsSlice';   // keep if you have it
import filters from './filtersSlice';     // keep if you have it
import seatMap from './seatMapSlice';     // ⬅ NEW: register seat map reducer

// Load initial language from localStorage (fallback 'en')
function loadPreloadedState() {
  try {
    const raw = localStorage.getItem('app.lang');
    const value = raw ? JSON.parse(raw) : 'en';
    return { language: { value } };
  } catch {
    return { language: { value: 'en' } };
  }
}

export const store = configureStore({
  reducer: {
    language,   // existing language state
    search,     // flight search state/results
    pricing,    // price detail per offer
    airports,   // optional
    filters,    // optional
    seatMap,    // ⬅ NEW: seat map state (required if you dispatch fetchSeatMap)
  },
  preloadedState: loadPreloadedState(),
  // default middleware & devTools are fine
});

// Persist language changes only
store.subscribe(() => {
  try {
    const lang = store.getState().language?.value ?? 'en';
    localStorage.setItem('app.lang', JSON.stringify(lang));
  } catch {
    // ignore persistence errors
  }
});
