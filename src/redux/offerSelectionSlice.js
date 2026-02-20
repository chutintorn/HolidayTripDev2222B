// src/redux/offerSelectionSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // legs = [{ direction:'OUT'|'IN'|'', fareKey:'', journeyKey:'', securityToken:'', currency:'' }]
  legs: [],
};

const offerSelectionSlice = createSlice({
  name: "offerSelection",
  initialState,
  reducers: {
    setSelectedOfferLegs(state, action) {
      const legs = Array.isArray(action.payload) ? action.payload : [];
      state.legs = legs;
    },
    clearSelectedOfferLegs(state) {
      state.legs = [];
    },
  },
});

export const { setSelectedOfferLegs, clearSelectedOfferLegs } =
  offerSelectionSlice.actions;

export const selectSelectedOfferLegs = (state) => state.offerSelection?.legs || [];

export default offerSelectionSlice.reducer;
