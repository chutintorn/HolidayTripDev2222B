// src/redux/pricingSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

/** ----------------- Utilities ----------------- */
function normalizeOffersArg(arg, state) {
  const single = arg?.offer ? [arg.offer] : [];
  const many   = Array.isArray(arg?.offers) ? arg.offers : [];
  const list   = [...single, ...many].filter(Boolean);

  const selections = list
    .map((o) => ({
      fareKey: o.fareKey || o.id || o.token || "",
      journeyKey: o.journeyKey || "",
      securityToken: o.securityToken || "",
    }))
    // ensure stable requestKey regardless of click order
    .sort((a, b) => (a.journeyKey + a.fareKey).localeCompare(b.journeyKey + b.fareKey));

  // From args → selections → store (fallback)
  const secFromSel = selections.find((x) => x.securityToken)?.securityToken || "";
  const secFromState =
    state?.search?.params?.securityToken ||
    state?.search?.securityToken ||
    "";

  const secToken = arg?.securityToken || secFromSel || secFromState || "";

  const requestKey =
    selections.map((s) => s.fareKey || "?").join("+") || "unknown";

  return { selections, secToken, requestKey };
}

function makeCorrelationId() {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return `cid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function tryPickTotal(d) {
  if (!d) return undefined;
  const n1 = Number(d.total);
  if (Number.isFinite(n1)) return n1;
  const n2 = Number(d?.total?.amount);
  if (Number.isFinite(n2)) return n2;
  const n3 = Number(d?.grandTotal?.amount);
  if (Number.isFinite(n3)) return n3;
  const n4 = Number(d?.priceSummary?.grandTotal);
  if (Number.isFinite(n4)) return n4;
  const n5 = Number(d?.priceSummary?.grandTotal?.amount);
  if (Number.isFinite(n5)) return n5;
  return undefined;
}

/** Merge multiple direct-mode leg responses into one object */
function mergeDirectDetails(details) {
  const legs = details.filter(Boolean);
  const first = legs[0] || {};
  const totals = legs.map(tryPickTotal);
  const allNumeric = totals.every((n) => Number.isFinite(n));
  const total = allNumeric ? totals.reduce((a, b) => a + b, 0) : undefined;

  const currency =
    first.currency ||
    first?.priceSummary?.currency ||
    first?.total?.currency ||
    undefined;

  return { currency, total, legs };
}

/** fetch with timeout + minimal retry on transient errors */
async function fetchWithRetry(
  url,
  opts,
  { retries = 1, backoffMs = 700, timeoutMs = 20000 } = {}
) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;

      // Retry on classic transient statuses
      if (![500, 502, 503, 504].includes(res.status) || attempt === retries) {
        let txt = "";
        try { txt = await res.text(); } catch {}
        const err = new Error(
          `HTTP ${res.status}${txt ? ` – ${txt.slice(0, 800)}` : ""}`
        );
        err.status = res.status;
        throw err;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Modes:
 *  proxy  -> POST `${VITE_API_BASE||http://localhost:3100}/pricedetails` (or /pricedetails-with-seats if arg.includeSeats)
 *            headers: securitytoken
 *            body:    [{ fareKey, journeyKey }, ...]
 *
 *  direct -> POST `VITE_PRICING_URL || https://uat-ota.nokair.com/v1/pricing-details`
 *            headers: securitytoken + security-token + client_id + client_secret + X-Correlation-Id
 *            body:    { agencyCode, flightFareKey:[{ fareKey, journeyKey }], includeExtraServices:true }
 *            NOTE: if multiple legs, call API once per leg (server 500s on multi-item arrays)
 */
export const fetchPriceDetail = createAsyncThunk(
  "pricing/fetchDetail",
  async (arg, { rejectWithValue, signal, getState }) => {
    try {
      const state = getState?.();
      const MODE = (import.meta.env.VITE_PRICING_MODE || "proxy").toLowerCase();
      const { selections, secToken, requestKey } = normalizeOffersArg(arg, state);

      if (!selections.length) throw new Error("No offers provided for pricing.");

      if (MODE === "direct") {
        const PRICING_URL =
          import.meta.env.VITE_PRICING_URL ||
          "https://uat-ota.nokair.com/v1/pricing-details";
        const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || "";
        const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET || "";

        const agencyCode = state?.search?.params?.agencyCode ?? "";

        const baseHeaders = {
          "Content-Type": "application/json",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        };
        if (secToken) {
          baseHeaders["securitytoken"] = secToken;     // lowercase
          baseHeaders["security-token"] = secToken;    // hyphen variant
        }

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

          const res = await fetchWithRetry(
            PRICING_URL,
            {
              method: "POST",
              headers,
              body: JSON.stringify(body),
              signal,
            },
            { retries: 1, backoffMs: 700, timeoutMs: 25000 }
          );

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
      const BASE = import.meta.env.VITE_API_BASE || "http://localhost:3100";
      const wantsSeats = !!arg?.includeSeats;
      const endpoint = wantsSeats ? "/pricedetails-with-seats" : "/pricedetails";

      const body = selections.map((s) => ({
        fareKey: s.fareKey,
        journeyKey: s.journeyKey,
      }));

      const headers = { "Content-Type": "application/json" };
      if (secToken) headers["securitytoken"] = secToken; // lowercase for consistency

      const res = await fetchWithRetry(
        `${BASE}${endpoint}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal,
        },
        { retries: 1, backoffMs: 700, timeoutMs: 20000 }
      );

      if (!res.ok) throw new Error(`Price failed: ${res.status}`);
      const detail = await res.json();

      return { requestKey, detail };
    } catch (e) {
      const msg = (e?.message || "Price detail failed").replace(/\s+/g, " ").slice(0, 900);
      return rejectWithValue(msg);
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
      const { requestKey } = normalizeOffersArg(a.meta.arg, undefined);
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
      const { requestKey } = normalizeOffersArg(a.meta.arg, undefined);
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
