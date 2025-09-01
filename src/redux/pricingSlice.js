import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

// Thunk: POST /pricedetails
export const fetchPriceDetail = createAsyncThunk(
  "pricing/fetchDetail",
  async ({ offer }, { rejectWithValue, getState, signal }) => {
    try {
      const BASE = import.meta.env.VITE_API_BASE || "http://localhost:3100";
      const { search } = getState();
      const p = search?.params || {};
      const passengers = offer?.passengers || [
        { type: "ADT", count: p?.adult || 1 },
        { type: "CHD", count: p?.child || 0 },
        { type: "INF", count: p?.infant || 0 },
      ];

      const res = await fetch(`${BASE}/pricedetails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          offerId: offer.id || offer.token || offer.fareKey,
          passengers,
          // If your server needs these extras, include them:
          securityToken: offer.securityToken,
          journeyKey: offer.journeyKey,
        }),
      });
      if (!res.ok) throw new Error(`Price failed: ${res.status}`);
      const detail = await res.json(); // { total, taxes, base, brand, fareKey, rules, currency }
      return { offerId: offer.id || offer.token || offer.fareKey, offer, detail };
    } catch (e) {
      return rejectWithValue(e.message || "Price detail failed");
    }
  }
);

const pricingSlice = createSlice({
  name: "pricing",
  initialState: {
    lastSelectedOfferId: null,
    byOfferId: {}, // { [offerId]: detail }
    status: {},    // { [offerId]: 'idle'|'loading'|'succeeded'|'failed' }
    error: {},     // { [offerId]: message }
  },
  reducers: {
    resetPricing(state) {
      state.lastSelectedOfferId = null;
      state.byOfferId = {};
      state.status = {};
      state.error = {};
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchPriceDetail.pending, (s, a) => {
      const id = a.meta.arg.offer.id || a.meta.arg.offer.token || a.meta.arg.offer.fareKey;
      s.status[id] = "loading";
      s.error[id] = null;
      s.lastSelectedOfferId = id;
    });
    b.addCase(fetchPriceDetail.fulfilled, (s, a) => {
      const { offerId, detail } = a.payload;
      s.status[offerId] = "succeeded";
      s.byOfferId[offerId] = detail;
    });
    b.addCase(fetchPriceDetail.rejected, (s, a) => {
      const id = a.meta.arg.offer.id || a.meta.arg.offer.token || a.meta.arg.offer.fareKey;
      s.status[id] = "failed";
      s.error[id] = a.payload || "Price detail failed";
    });
  },
});

export const { resetPricing } = pricingSlice.actions;
export const selectPricing = (state) => state.pricing;
export const selectPriceFor = (offerId) => (state) => state.pricing.byOfferId[offerId];
export const selectPricingStatus = (offerId) => (state) => state.pricing.status[offerId] || "idle";
export default pricingSlice.reducer;
