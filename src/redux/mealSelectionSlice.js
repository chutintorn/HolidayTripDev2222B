// src/redux/mealSelectionSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  draft: {}, // draft[paxId][journeyKey] = { meal: service|null, bev: service|null }
  saved: {}, // saved[paxId][journeyKey] = { meal: service|null, bev: service|null }
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
  if (!obj[k.p][k.j]) obj[k.p][k.j] = { meal: null, bev: null };
  return k;
}

const slice = createSlice({
  name: "mealSelection",
  initialState,
  reducers: {
    // --- RADIO setters (เหมือน baggage: เลือกได้ 1 ต่อกลุ่ม) ---
    setDraftMealRadio(state, action) {
      const { paxId, journeyKey, service } = action.payload || {};
      const k = ensureLeg(state.draft, paxId, journeyKey);
      if (!k) return;
      state.draft[k.p][k.j].meal = service || null;
    },
    setDraftBeverageRadio(state, action) {
      const { paxId, journeyKey, service } = action.payload || {};
      const k = ensureLeg(state.draft, paxId, journeyKey);
      if (!k) return;
      state.draft[k.p][k.j].bev = service || null;
    },

    // --- Confirm (commit draft -> saved) ---
    saveMealSelection(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      const k = key(paxId, journeyKey);
      if (!k) return;

      const leg = state.draft?.[k.p]?.[k.j];
      const next = {
        meal: leg?.meal ?? null,
        bev: leg?.bev ?? null,
      };

      if (!state.saved[k.p]) state.saved[k.p] = {};
      state.saved[k.p][k.j] = next;
    },

    // --- Release draft (กลับไปแสดง saved) ---
    clearDraftMealSelection(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      const k = key(paxId, journeyKey);
      if (!k) return;
      if (!state.draft?.[k.p]) return;

      delete state.draft[k.p][k.j];
      if (Object.keys(state.draft[k.p]).length === 0) delete state.draft[k.p];
    },

    // optional hard reset saved
    clearSavedMealSelection(state, action) {
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
  setDraftMealRadio,
  setDraftBeverageRadio,
  saveMealSelection,
  clearDraftMealSelection,
  clearSavedMealSelection,
} = slice.actions;

// selectors (return null if missing)
export const selectDraftMealSelection =
  (paxId, journeyKey) =>
  (state) =>
    state.mealSelection?.draft?.[String(paxId)]?.[String(journeyKey)] ?? null;

export const selectSavedMealSelection =
  (paxId, journeyKey) =>
  (state) =>
    state.mealSelection?.saved?.[String(paxId)]?.[String(journeyKey)] ?? null;

export default slice.reducer;
