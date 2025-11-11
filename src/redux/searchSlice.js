// src/redux/searchSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

// Thunk: POST /flights
export const fetchSearchResults = createAsyncThunk(
  "search/fetch",
  async (form, { rejectWithValue, signal }) => {
    try {
      const BASE = import.meta.env.VITE_API_BASE || "http://localhost:3100";
    //const BASE = import.meta.env.VITE_API_BASE || "https://nodebasic-production-76d7.up.railway.app";
     //const BASE = import.meta.env.VITE_API_BASE || "https://nodebasic-production.up.railway.app";

      // Normalize IATA + dates
      const origin = String(form.origin || "").trim().toUpperCase();
      const destination = String(form.destination || "").trim().toUpperCase();
      const depart = String(form.depart || "");
      const ret = form.ret ? String(form.ret) : null;

      // Build journeys[] (robust: add reverse leg whenever ret exists)
      const journeys = [];
      if (origin && destination && depart) {
        journeys.push({ origin, destination, departureDate: depart });

        // Previously: if (form.tripType === "roundtrip" && ret) { ... }
        // Now: be tolerant—if a return date is present, add the reverse leg.
        if (ret) {
          journeys.push({
            origin: destination,
            destination: origin,
            departureDate: ret,
          });
        }
      }

      // Flatten pax counts (fallback to form.pax if present)
      const adtIn = Number(form.adult ?? form?.pax?.ADT ?? 0);
      const chdIn = Number(form.child ?? form?.pax?.CHD ?? 0);
      const infIn = Number(form.infant ?? form?.pax?.INF ?? 0);

      const adult = Number.isFinite(adtIn) ? adtIn : 0;
      const child = Number.isFinite(chdIn) ? chdIn : 0;
      // Safety: infants cannot exceed adults
      const infantRaw = Number.isFinite(infIn) ? infIn : 0;
      const infant = Math.max(0, Math.min(infantRaw, adult));

      // Assemble backend/NOK payload
      const payload = {
        agencyCode: form.agencyCode ?? "",
        currency: form.currency ?? "THB",
        adult,
        child,
        infant,
        journeys,
        // Only include promoCode when non-empty (avoid null)
        ...(typeof form.promoCode === "string" && form.promoCode.trim()
          ? { promoCode: form.promoCode.trim() }
          : {}),
      };

      const res = await fetch(`${BASE}/flights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`);
      }

      // expected: { itineraries: [...], currency?, ... }
      return await res.json();
    } catch (e) {
      return rejectWithValue(e.message || "Search failed");
    }
  }
);

const initialState = {
  params: null,
  results: null,
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    clearResults(state) {
      state.params = null;
      state.results = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchSearchResults.pending, (s, a) => {
      s.status = "loading";
      s.error = null;
      s.params = a.meta.arg;
    });
    b.addCase(fetchSearchResults.fulfilled, (s, a) => {
      s.status = "succeeded";
      s.results = a.payload || null;
    });
    b.addCase(fetchSearchResults.rejected, (s, a) => {
      s.status = "failed";
      s.error = a.payload || "Search failed";
    });
  },
});

export const { clearResults } = searchSlice.actions;
export const selectSearch = (state) => state.search;
export const selectResults = (state) => state.search.results;
export default searchSlice.reducer;
