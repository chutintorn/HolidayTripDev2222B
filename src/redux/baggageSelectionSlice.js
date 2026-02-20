// src/redux/baggageSelectionSlice.js
import { createSlice } from "@reduxjs/toolkit";

/**
 * Passenger × FlightLeg (journeyKey)
 * - draft: เลือกไว้แต่ยังไม่กด Save
 * - saved: กด Save แล้ว
 *
 * state.draft[paxId][journeyKey] = { bg: service|null, sb: service|null }
 * state.saved[paxId][journeyKey] = { bg: service|null, sb: service|null }
 *
 * service minimal:
 * { ssrCode, description, amount, currency, vat, flightNumber, departureDate }
 */

const initialState = {
  draft: {},
  saved: {},
};

function ensureLeg(obj, paxId, journeyKey) {
  const p = String(paxId);
  const j = String(journeyKey || "");
  if (!p || !j) return null;

  if (!obj[p]) obj[p] = {};
  if (!obj[p][j]) obj[p][j] = { bg: null, sb: null };
  return { p, j };
}

const slice = createSlice({
  name: "baggageSelection",
  initialState,
  reducers: {
    setDraftBaggage(state, action) {
      const { paxId, journeyKey, kind, service } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const k = String(kind || "").toUpperCase(); // "BG" or "SB"
      if (k !== "BG" && k !== "SB") return;

      const ref = ensureLeg(state.draft, paxId, journeyKey);
      if (!ref) return;

      state.draft[ref.p][ref.j][k === "BG" ? "bg" : "sb"] = service || null;
    },

    saveBaggage(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);

      const draftLeg = state.draft?.[p]?.[j] || { bg: null, sb: null };
      if (!state.saved[p]) state.saved[p] = {};
      state.saved[p][j] = { bg: draftLeg.bg ?? null, sb: draftLeg.sb ?? null };
    },

    clearDraftBaggage(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);

      if (state.draft?.[p]) {
        delete state.draft[p][j];
        if (Object.keys(state.draft[p]).length === 0) delete state.draft[p];
      }
    },

    clearSavedBaggage(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);

      if (state.saved?.[p]) {
        delete state.saved[p][j];
        if (Object.keys(state.saved[p]).length === 0) delete state.saved[p];
      }
    },

    resetPassengerBaggage(state, action) {
      const { paxId } = action.payload || {};
      if (paxId == null) return;
      const p = String(paxId);
      delete state.draft[p];
      delete state.saved[p];
    },

    resetAllBaggage(state) {
      state.draft = {};
      state.saved = {};
    },
  },
});

export const {
  setDraftBaggage,
  saveBaggage,
  clearDraftBaggage,
  clearSavedBaggage,
  resetPassengerBaggage,
  resetAllBaggage,
} = slice.actions;

/* ------------------------ Selectors ------------------------ */
export const selectDraftBaggage =
  (paxId, journeyKey) =>
  (state) =>
    state.baggageSelection?.draft?.[String(paxId)]?.[String(journeyKey)] || { bg: null, sb: null };

export const selectSavedBaggage =
  (paxId, journeyKey) =>
  (state) =>
    state.baggageSelection?.saved?.[String(paxId)]?.[String(journeyKey)] || { bg: null, sb: null };

export const selectAllSavedBaggage = (state) => state.baggageSelection?.saved || {};
export const selectAllDraftBaggage = (state) => state.baggageSelection?.draft || {};

export default slice.reducer;
