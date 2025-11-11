// src/redux/seatMapSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

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

async function fetchWithRetry(url, opts, { retries = 1, backoffMs = 700, timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      if (![500,502,503,504].includes(res.status) || attempt === retries) {
        let txt = "";
        try { txt = await res.text(); } catch {}
        const err = new Error(`HTTP ${res.status}${txt ? ` – ${txt.slice(0,800)}` : ""}`);
        err.status = res.status;
        throw err;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt === retries) break;
      await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Seat map thunk (proxy mode only)
 * POST `${VITE_API_BASE||http://localhost:3100}/seat-map`
 * headers: securitytoken (lowercase)
 * body:    [{ fareKey, journeyKey }, ...]
 */
export const fetchSeatMap = createAsyncThunk(
  "seatMap/fetch",
  async (arg, { rejectWithValue }) => {
    try {
      const { selections, secToken, requestKey } = normalizeOffersArg(arg);
      if (!selections.length) throw new Error("No offers for seat map.");

      const BASE = import.meta.env.VITE_API_BASE || "http://localhost:3100";
      const headers = { "Content-Type": "application/json" };
      if (secToken) headers["securitytoken"] = secToken;

      const body = selections.map(s => ({ fareKey: s.fareKey, journeyKey: s.journeyKey }));

      const res = await fetchWithRetry(`${BASE}/seat-map`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }, { retries: 1, backoffMs: 700, timeoutMs: 20000 });

      if (!res.ok) throw new Error(`Seat map failed: ${res.status}`);

      let data = await res.json();
      if (data == null) data = { legs: [] };

      return { requestKey, data };
    } catch (e) {
      const msg = (e?.message || "Seat map failed").replace(/\s+/g, " ").slice(0, 900);
      return rejectWithValue(msg);
    }
  }
);

const seatMapSlice = createSlice({
  name: "seatMap",
  initialState: {
    byKey: {},
    status: {},
    error: {},
  },
  reducers: {
    resetSeatMap(state) {
      state.byKey = {};
      state.status = {};
      state.error = {};
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchSeatMap.pending, (s, a) => {
      const { requestKey } = normalizeOffersArg(a.meta.arg);
      s.status[requestKey] = "loading";
      s.error[requestKey] = null;
    });
    b.addCase(fetchSeatMap.fulfilled, (s, a) => {
      const { requestKey, data } = a.payload;
      s.status[requestKey] = "succeeded";
      s.byKey[requestKey] = data;
    });
    b.addCase(fetchSeatMap.rejected, (s, a) => {
      const { requestKey } = normalizeOffersArg(a.meta.arg);
      s.status[requestKey] = "failed";
      s.error[requestKey] = a.payload || "Seat map failed";
    });
  },
});

export const { resetSeatMap } = seatMapSlice.actions;
export const selectSeatMapFor = (requestKey) => (state) => state.seatMap.byKey[requestKey];
export const selectSeatMapStatus = (requestKey) => (state) => state.seatMap.status[requestKey] || "idle";
export default seatMapSlice.reducer;
