// src/redux/priorityBoardingSelectionSlice.js
import { createSlice } from "@reduxjs/toolkit";

/**
 * Priority Boarding (PBOD)
 * Passenger × FlightLeg (journeyKey)
 *
 * draft: เลือกไว้แต่ยังไม่กด Save
 * saved: กด Save แล้ว
 *
 * state.draft[paxId][journeyKey] = { pbod: service|null }
 * state.saved[paxId][journeyKey] = { pbod: service|null }
 *
 * service minimal:
 * { ssrCode, description, amount, currency, vat, flightNumber, departureDate }
 */

const initialState = {
  draft: {},
  saved: {},
};

function key(paxId, journeyKey) {
  const p = String(paxId ?? "");
  const j = String(journeyKey ?? "");
  if (!p || !j) return null;
  return { p, j };
}

function ensureLeg(obj, paxId, journeyKey) {
  const k = key(paxId, journeyKey);
  if (!k) return null;
  if (!obj[k.p]) obj[k.p] = {};
  if (!obj[k.p][k.j]) obj[k.p][k.j] = { pbod: null };
  return k;
}

const slice = createSlice({
  name: "priorityBoardingSelection",
  initialState,
  reducers: {
    // RADIO: เลือก PBOD หรือ none (null)
    setDraftPriorityBoarding(state, action) {
      const { paxId, journeyKey, service } = action.payload || {};
      const k = ensureLeg(state.draft, paxId, journeyKey);
      if (!k) return;
      state.draft[k.p][k.j].pbod = service || null;
    },

    // Confirm: commit draft -> saved
    savePriorityBoarding(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      const k = key(paxId, journeyKey);
      if (!k) return;

      const leg = state.draft?.[k.p]?.[k.j];
      const next = { pbod: leg?.pbod ?? null };

      if (!state.saved[k.p]) state.saved[k.p] = {};
      state.saved[k.p][k.j] = next;
    },

    // Cancel: ล้าง draft เพื่อกลับไปใช้ saved
    clearDraftPriorityBoarding(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      const k = key(paxId, journeyKey);
      if (!k) return;
      if (!state.draft?.[k.p]) return;

      delete state.draft[k.p][k.j];
      if (Object.keys(state.draft[k.p]).length === 0) delete state.draft[k.p];
    },

    // (optional) ล้าง saved (ถ้าต้องการปุ่ม reset)
    clearSavedPriorityBoarding(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      const k = key(paxId, journeyKey);
      if (!k) return;
      if (!state.saved?.[k.p]) return;

      delete state.saved[k.p][k.j];
      if (Object.keys(state.saved[k.p]).length === 0) delete state.saved[k.p];
    },
  },
});

export const {
  setDraftPriorityBoarding,
  savePriorityBoarding,
  clearDraftPriorityBoarding,
  clearSavedPriorityBoarding,
} = slice.actions;

// selectors
export const selectDraftPriorityBoarding =
  (paxId, journeyKey) =>
  (state) =>
    state.priorityBoardingSelection?.draft?.[String(paxId)]?.[String(journeyKey)] ?? null;

export const selectSavedPriorityBoarding =
  (paxId, journeyKey) =>
  (state) =>
    state.priorityBoardingSelection?.saved?.[String(paxId)]?.[String(journeyKey)] ?? null;

export const selectAllSavedPriorityBoarding = (state) =>
  state.priorityBoardingSelection?.saved || {};

export default slice.reducer;
