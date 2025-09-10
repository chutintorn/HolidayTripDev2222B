// src/redux/pricingSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

/** ----------------- Utilities ----------------- */
function normalizeOffersArg(arg) {
  const single = arg?.offer ? [arg.offer] : [];
  const many   = Array.isArray(arg?.offers) ? arg.offers : [];
  const list   = [...single, ...many].filter(Boolean);

  const selections = list.map((o) => ({
    fareKey: o.fareKey || o.id || o.token || "",
    journeyKey: o.journeyKey || "",
    securityToken: o.securityToken || "",
  }));

  const secToken =
    selections.find((x) => x.securityToken)?.securityToken || "";

  const requestKey =
    selections.map((s) => s.fareKey || "?").join("+") || "unknown";

  return { selections, secToken, requestKey };
}

function makeCorrelationId() {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return `cid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Merge multiple direct-mode leg responses into one object */
function mergeDirectDetails(details) {
  const legs = details.filter(Boolean);
  const first = legs[0] || {};
  const total = legs.reduce((sum, d) => {
    const n = Number(d?.total);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
  const hasNumeric = legs.some((d) => Number.isFinite(Number(d?.total)));
  return {
    currency: first.currency || undefined,
    total: hasNumeric ? total : undefined,
    legs,
  };
}

/**
 * Modes:
 *  proxy  -> POST `${VITE_API_BASE||https://nodebasic-production-76d7.up.railway.app}/pricedetails`
 *            headers: securityToken
 *            body:    [{ fareKey, journeyKey }, ...]
 *
 *  direct -> POST `VITE_PRICING_URL || https://uat-ota.nokair.com/v1/pricing-details`
 *            headers: securitytoken + security-token + client_id + client_secret + X-Correlation-Id
 *            body:    { agencyCode, flightFareKey:[{ fareKey, journeyKey }], includeExtraServices:true }
 *            NOTE: if 2 legs, we call API TWICE (one per leg) and merge results (server 500s on multi-item arrays)
 */
export const fetchPriceDetail = createAsyncThunk(
  "pricing/fetchDetail",
  async (arg, { rejectWithValue, signal, getState }) => {
    try {
      const MODE = (import.meta.env.VITE_PRICING_MODE || "proxy").toLowerCase();
      const { selections, secToken, requestKey } = normalizeOffersArg(arg);
      if (!selections.length) throw new Error("No offers provided for pricing.");

      if (MODE === "direct") {
        const PRICING_URL =
          import.meta.env.VITE_PRICING_URL ||
          "https://uat-ota.nokair.com/v1/pricing-details";
        const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || "";
        const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET || "";

        const state = getState?.();
        const agencyCode = state?.search?.params?.agencyCode ?? "";

        const baseHeaders = {
          "Content-Type": "application/json",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        };
        if (secToken) {
          baseHeaders["securitytoken"] = secToken;
          baseHeaders["security-token"] = secToken;
        }

        // Call one leg per request to avoid 500 with multi items
        const perLegDetails = [];
        for (let i = 0; i < selections.length; i++) {
          const s = selections[i];
          const body = {
            agencyCode,
            flightFareKey: [{ fareKey: s.fareKey, journeyKey: s.journeyKey }],
            includeExtraServices: true,
          };
          const headers = {
            ...baseHeaders,
            "X-Correlation-Id": makeCorrelationId(),
          };

          const res = await fetch(PRICING_URL, {
            method: "POST",
            headers,
            signal,
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            let err = `Price failed (leg ${i + 1}/${selections.length}): ${res.status}`;
            try {
              const txt = await res.text();
              if (txt) err += ` – ${txt.slice(0, 800)}`;
            } catch {}
            throw new Error(err);
          }

          const detail = await res.json();
          perLegDetails.push(detail);
        }

        const merged = mergeDirectDetails(perLegDetails);
        return { requestKey, detail: merged };
      }

      // ---- proxy mode (your local Node server) ----
      const BASE = import.meta.env.VITE_API_BASE || "https://nodebasic-production-76d7.up.railway.app";
      const body = selections.map((s) => ({
        fareKey: s.fareKey,
        journeyKey: s.journeyKey,
      }));

      const headers = { "Content-Type": "application/json" };
      if (secToken) headers["securityToken"] = secToken;

      const res = await fetch(`${BASE}/pricedetails`, {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Price failed: ${res.status}`);
      const detail = await res.json();

      return { requestKey, detail };
    } catch (e) {
      return rejectWithValue(e.message || "Price detail failed");
    }
  }
);

/** ----------------- Slice ----------------- */
const pricingSlice = createSlice({
  name: "pricing",
  initialState: {
    lastRequestKey: null,
    byKey: {},   // { [requestKey]: detail }
    status: {},  // { [requestKey]: 'idle'|'loading'|'succeeded'|'failed' }
    error: {},   // { [requestKey]: message }
  },
  reducers: {
    resetPricing(state) {
      state.lastRequestKey = null;
      state.byKey = {};
      state.status = {};
      state.error = {};
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchPriceDetail.pending, (s, a) => {
      const { requestKey } = normalizeOffersArg(a.meta.arg);
      s.status[requestKey] = "loading";
      s.error[requestKey] = null;
      s.lastRequestKey = requestKey;
    });
    b.addCase(fetchPriceDetail.fulfilled, (s, a) => {
      const { requestKey, detail } = a.payload;
      s.status[requestKey] = "succeeded";
      s.byKey[requestKey] = detail;
    });
    b.addCase(fetchPriceDetail.rejected, (s, a) => {
      const { requestKey } = normalizeOffersArg(a.meta.arg);
      s.status[requestKey] = "failed";
      s.error[requestKey] = a.payload || "Price detail failed";
    });
  },
});

export const { resetPricing } = pricingSlice.actions;
export const selectPricing = (state) => state.pricing;
export const selectPriceFor = (requestKey) => (state) => state.pricing.byKey[requestKey];
export const selectPricingStatus = (requestKey) => (state) =>
  state.pricing.status[requestKey] || "idle";

export default pricingSlice.reducer;
