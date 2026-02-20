// src/redux/mealSelectionSlice.js
import { createSlice } from "@reduxjs/toolkit";

/**
 * Passenger × FlightLeg (journeyKey)
 * - draft: เลือกไว้แต่ยังไม่กด Confirm
 * - saved: Confirm แล้ว
 *
 * state.draft[paxId][journeyKey] = { meals: service[], drinks: service[] }
 * state.saved[paxId][journeyKey] = { meals: service[], drinks: service[] }
 *
 * service minimal shape (keep whole object for UI):
 * { ssrCode, description, amount, currency, ... }
 */

const initialState = {
  draft: {},
  saved: {},
};

function norm(v) {
  return String(v || "").trim().replace(/\s+/g, "").toUpperCase();
}

function ensureLeg(obj, paxId, journeyKey) {
  const p = String(paxId);
  const j = String(journeyKey || "");
  if (!p || !j) return null;

  if (!obj[p]) obj[p] = {};
  if (!obj[p][j]) obj[p][j] = { meals: [], drinks: [] };
  return { p, j };
}

function listKey(service) {
  return norm(service?.ssrCode);
}

function toggleInList(list, service, max = 99) {
  const code = listKey(service);
  if (!code) return list;

  const exists = (list || []).some((x) => listKey(x) === code);
  if (exists) return (list || []).filter((x) => listKey(x) !== code);

  const next = [...(list || []), service];
  return next.slice(0, Math.max(0, Number(max) || 99));
}

const slice = createSlice({
  name: "mealSelection",
  initialState,
  reducers: {
    toggleDraftMeal(state, action) {
      const { paxId, journeyKey, kind, service, max } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const ref = ensureLeg(state.draft, paxId, journeyKey);
      if (!ref) return;

      const k = norm(kind);
      const bucket = k === "DRINK" ? "drinks" : "meals"; // default MEAL

      const current = state.draft[ref.p][ref.j][bucket] || [];
      state.draft[ref.p][ref.j][bucket] = toggleInList(current, service, max);
    },

    saveMealSelection(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);

      const draftLeg = state.draft?.[p]?.[j] || { meals: [], drinks: [] };
      if (!state.saved[p]) state.saved[p] = {};
      state.saved[p][j] = {
        meals: Array.isArray(draftLeg.meals) ? draftLeg.meals : [],
        drinks: Array.isArray(draftLeg.drinks) ? draftLeg.drinks : [],
      };
    },

    clearDraftMealSelection(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);

      if (state.draft?.[p]) {
        delete state.draft[p][j];
        if (Object.keys(state.draft[p]).length === 0) delete state.draft[p];
      }
    },

    clearSavedMealSelection(state, action) {
      const { paxId, journeyKey } = action.payload || {};
      if (paxId == null || !journeyKey) return;

      const p = String(paxId);
      const j = String(journeyKey);

      if (state.saved?.[p]) {
        delete state.saved[p][j];
        if (Object.keys(state.saved[p]).length === 0) delete state.saved[p];
      }
    },

    resetPassengerMeals(state, action) {
      const { paxId } = action.payload || {};
      if (paxId == null) return;
      const p = String(paxId);
      delete state.draft[p];
      delete state.saved[p];
    },

    resetAllMeals(state) {
      state.draft = {};
      state.saved = {};
    },
  },
});

export const {
  toggleDraftMeal,
  saveMealSelection,
  clearDraftMealSelection,
  clearSavedMealSelection,
  resetPassengerMeals,
  resetAllMeals,
} = slice.actions;

/* ------------------------ Selectors (IMPORTANT: return null if missing) ------------------------ */
export const selectDraftMealSelection =
  (paxId, journeyKey) =>
  (state) =>
    state.mealSelection?.draft?.[String(paxId)]?.[String(journeyKey)] ?? null;

export const selectSavedMealSelection =
  (paxId, journeyKey) =>
  (state) =>
    state.mealSelection?.saved?.[String(paxId)]?.[String(journeyKey)] ?? null;

export const selectAllSavedMeals = (state) => state.mealSelection?.saved ?? {};
export const selectAllDraftMeals = (state) => state.mealSelection?.draft ?? {};

export default slice.reducer;
