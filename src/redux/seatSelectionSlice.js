// src/redux/seatSelectionSlice.js
import { createSlice } from "@reduxjs/toolkit";

/**
 * Seat Selection State (Passenger-centric)
 * - draft: user is clicking/browsing (NOT committed)
 * - saved: user clicked Save (committed)
 *
 * Keying:
 *   paxId: string | number  (must be stable per passenger)
 *   journeyKey: string      (depart/return or actual journeyKey)
 *
 * seatObj (recommended minimal shape):
 * {
 *   seatCode, rowNumber, seat, amount, currency, vat,
 *   serviceCode, description, flightNumber
 * }
 */

const initialState = {
  draft: {}, // draft[paxId][journeyKey] = seatObj
  saved: {}, // saved[paxId][journeyKey] = seatObj
};

function ensurePath(obj, paxId, journeyKey) {
  const p = String(paxId);
  if (!obj[p]) obj[p] = {};
  if (journeyKey != null && journeyKey !== "") {
    const j = String(journeyKey);
    if (!obj[p][j]) obj[p][j] = null;
    return { p, j };
  }
  return { p, j: null };
}

const seatSelectionSlice = createSlice({
  name: "seatSelection",
  initialState,
  reducers: {
    // Click seat -> draft only
    setDraftSeat(state, action) {
      const { paxId, journeyKey, seat } = action.payload || {};
      if (paxId == null || !journeyKey) return;
      const { p, j } = ensurePath(state.draft, paxId, journeyKey);
      state.draft[p][j] = seat || null;
    },

    // Save button -> draft -> saved
    saveSeat(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);
      const seat = state.draft?.[p]?.[j] ?? null;

      if (!state.saved[p]) state.saved[p] = {};
      state.saved[p][j] = seat;
    },

    // Cancel/Close -> clear draft only (saved stays)
    clearDraftSeat(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);
      if (state.draft?.[p]) {
        delete state.draft[p][j];
        if (Object.keys(state.draft[p]).length === 0) delete state.draft[p];
      }
    },

    // ✅ Release committed seat (so other pax can pick it in this session)
    clearSavedSeat(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);
      if (state.saved?.[p]) {
        delete state.saved[p][j];
        if (Object.keys(state.saved[p]).length === 0) delete state.saved[p];
      }
    },

    // Optional: reset one passenger seats
    resetPassengerSeats(state, action) {
      const { paxId } = action.payload || {};
      if (paxId == null) return;

      const p = String(paxId);
      if (state.draft[p]) delete state.draft[p];
      if (state.saved[p]) delete state.saved[p];
    },

    // Optional: reset all
    resetAllSeats(state) {
      state.draft = {};
      state.saved = {};
    },
  },
});

export const {
  setDraftSeat,
  saveSeat,
  clearDraftSeat,
  clearSavedSeat,
  resetPassengerSeats,
  resetAllSeats,
} = seatSelectionSlice.actions;

/* ------------------------ Selectors ------------------------ */
export const selectDraftSeat =
  (paxId, journeyKey) =>
  (state) =>
    state.seatSelection?.draft?.[String(paxId)]?.[String(journeyKey)] ?? null;

export const selectSavedSeat =
  (paxId, journeyKey) =>
  (state) =>
    state.seatSelection?.saved?.[String(paxId)]?.[String(journeyKey)] ?? null;

export const selectSavedSeatsForPassenger =
  (paxId) =>
  (state) =>
    state.seatSelection?.saved?.[String(paxId)] ?? {};

// ✅ for realtime lock calculation
export const selectAllSavedSeats = (state) => state.seatSelection?.saved ?? {};
export const selectAllDraftSeats = (state) => state.seatSelection?.draft ?? {};

export default seatSelectionSlice.reducer;
