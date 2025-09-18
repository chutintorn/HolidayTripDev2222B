// src/redux/filtersSlice.js
import { createSlice } from "@reduxjs/toolkit";

/**
 * Filters follow your HTML: Asia-only, stops, trip/layover sliders, cabin, airline.
 * Keep it simple first: only fields we can reliably filter with the data we have.
 */
const initialState = {
  asiaOnly: true,
  stops: "all",             // 'all' | 'nonstop' | 'max1' | 'max2'
  tripHoursMax: 59,         // slider "Up to 59 hours"
  layoverHoursMax: 25,      // slider "Up to 25 hours"
  cabin: "eco",             // 'eco' | 'prem' | 'biz' | 'first'
  airlines: {               // checkbox list; start with Nok only (can expand)
    NOK: true,              // Nok Air
  },
};

const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    setAsiaOnly: (s, a) => { s.asiaOnly = !!a.payload; },
    setStops: (s, a) => { s.stops = a.payload; },
    setTripHoursMax: (s, a) => { s.tripHoursMax = Number(a.payload) || 0; },
    setLayoverHoursMax: (s, a) => { s.layoverHoursMax = Number(a.payload) || 0; },
    setCabin: (s, a) => { s.cabin = a.payload; },
    toggleAirline: (s, a) => { const k = a.payload; s.airlines[k] = !s.airlines[k]; },
    clearAll: () => initialState,
  },
});

export const {
  setAsiaOnly, setStops, setTripHoursMax, setLayoverHoursMax,
  setCabin, toggleAirline, clearAll,
} = filtersSlice.actions;

export const selectFilters = (state) => state.filters;

/** --- Row filtering helper used by JourneyTable --- */
const ASIA_IATA = new Set([
  // quick heuristic; add more as needed
  "DMK","BKK","CNX","HKT","KBV","SIN","KUL","HAN","SGN","DAD","PNH","REP","RGN","LPQ","VTE","TPE","KHH","ICN","GMP","NRT","HND","KIX","CTS","HKG","MFM","DEL","BOM","BLR","HYD",
]);

const parseMinutes = (row) => {
  // prefer a numeric field if your backend gives it; else quick parse like "1h 20m"
  if (typeof row.durationMinutes === "number") return row.durationMinutes;
  const t = (row.duration || "").toLowerCase();
  const h = /(\d+)\s*h/.exec(t)?.[1] ?? 0;
  const m = /(\d+)\s*m/.exec(t)?.[1] ?? 0;
  return Number(h) * 60 + Number(m);
};

export function filterRows(rows, f) {
  return rows.filter((r) => {
    // Asia-only: both endpoints in our quick Asia list
    if (f.asiaOnly) {
      if (!ASIA_IATA.has((r.origin||"").toUpperCase()) ||
          !ASIA_IATA.has((r.destination||"").toUpperCase())) {
        return false;
      }
    }

    // Stops: treat missing as nonstop
    const stops = typeof r.stops === "number" ? r.stops : 0;
    if (f.stops === "nonstop" && stops !== 0) return false;
    if (f.stops === "max1" && stops > 1) return false;
    if (f.stops === "max2" && stops > 2) return false;

    // Trip duration slider (compare minutes)
    const tripMin = parseMinutes(r);
    if (tripMin > f.tripHoursMax * 60) return false;

    // Layover slider (optional, only filter if we have a value)
    if (typeof r.maxLayoverMinutes === "number") {
      if (r.maxLayoverMinutes > f.layoverHoursMax * 60) return false;
    }

    // Cabin: simple mapping
    const cabin = (r.cabin || "eco").toLowerCase();
    const want = f.cabin; // 'eco' | 'prem' | 'biz' | 'first'
    if (want === "eco" && cabin !== "eco" && cabin !== "economy") return false;
    if (want === "prem" && !/prem/.test(cabin)) return false;
    if (want === "biz"  && !/bus|biz/.test(cabin)) return false;
    if (want === "first"&& !/first/.test(cabin)) return false;

    // Airlines: keep only Nok when set (use carrier code or name)
    const carrierCode = (r.marketingCarrierCode || r.carrierCode || "").toUpperCase();
    const carrierName = (r.marketingCarrier || r.carrierName || "").toLowerCase();
    const isNok = carrierCode === "DD" || /nok/.test(carrierName);
    if (f.airlines.NOK && !isNok) return false;

    return true;
  });
}

export default filtersSlice.reducer;
